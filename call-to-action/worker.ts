/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";

export interface Env {
  TranscriptStore: DurableObjectNamespace<TranscriptStore>;
  DEEPGRAM_SECRET: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_SID: string;
  TWILIO_AUTH_TOKEN: string;
  PASSWORD: string;
}

interface Transcript {
  id: number;
  created_at: string;
  from_number: string;
  duration: string;
  transcript: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const required = [
      "DEEPGRAM_SECRET",
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "PASSWORD",
    ];
    for (const key of required) {
      if (!env[key as keyof Env]) {
        return new Response(`Missing required env: ${key}`, { status: 500 });
      }
    }

    const url = new URL(request.url);
    const store = env.TranscriptStore.get(
      env.TranscriptStore.idFromName("main"),
    );

    // Twilio webhooks - no auth needed
    if (url.pathname === "/record" && request.method === "POST") {
      return handleInitialCall(request);
    }

    if (url.pathname === "/recording-complete" && request.method === "POST") {
      return handleRecordingComplete(request, env, store);
    }

    // API routes - require auth
    if (url.pathname === "/api/login" && request.method === "POST") {
      const body = (await request.json()) as { password?: string };
      if (body.password === env.PASSWORD) {
        return new Response(
          JSON.stringify({ success: true, token: env.PASSWORD }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return new Response(JSON.stringify({ success: false }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/transcripts" && request.method === "GET") {
      if (!checkAuth(request, env)) {
        return new Response("Unauthorized", { status: 401 });
      }
      const transcripts = await store.list();
      return new Response(JSON.stringify(transcripts), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      url.pathname.startsWith("/api/transcripts/") &&
      request.method === "DELETE"
    ) {
      if (!checkAuth(request, env)) {
        return new Response("Unauthorized", { status: 401 });
      }
      const id = parseInt(url.pathname.split("/").pop() || "0");
      await store.delete(id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

function checkAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization");
  return auth === `Bearer ${env.PASSWORD}`;
}

async function handleInitialCall(request: Request): Promise<Response> {
  const formData = await request.text();
  const params = new URLSearchParams(formData);
  const from = params.get("From") || "Unknown";
  const to = params.get("To") || "Unknown";
  console.log(`Incoming call from ${from} to ${to}`);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record 
    timeout="10" 
    maxLength="3600"
    playBeep="true"
    recordingStatusCallback="${new URL(
      "/recording-complete",
      request.url,
    ).toString()}"
    recordingStatusCallbackMethod="POST"
    transcribe="false"
  />
  <Say>Thank you for your message. Goodbye.</Say>
</Response>`;

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}

async function handleRecordingComplete(
  request: Request,
  env: Env,
  store: DurableObjectStub<TranscriptStore>,
): Promise<Response> {
  try {
    const formData = await request.text();
    const params = new URLSearchParams(formData);
    const recordingUrl = params.get("RecordingUrl");
    const recordingSid = params.get("RecordingSid");
    const from = params.get("From") || "Unknown";
    const duration = params.get("RecordingDuration") || "0";

    if (!recordingUrl) {
      console.error("No recording URL provided");
      return respondWithEmptyTwiML();
    }

    console.log(`Processing recording: ${recordingUrl}`);
    await waitForRecording(recordingUrl);
    const transcript = await transcribeRecording(recordingUrl, env);

    if (transcript) {
      await store.add(from, duration, transcript);
    }

    if (recordingSid) {
      await deleteRecording(recordingSid, env);
    }

    console.log("Processing complete");
    return respondWithEmptyTwiML();
  } catch (error) {
    console.error("Error processing recording:", error);
    return respondWithEmptyTwiML();
  }
}

async function waitForRecording(url: string, maxAttempts = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        await response.arrayBuffer();
        return;
      }
    } catch (e) {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Recording not available after retries");
}

async function transcribeRecording(
  audioUrl: string,
  env: Env,
): Promise<string | null> {
  try {
    const response = await fetch("https://api.deepgram.com/v1/listen", {
      method: "POST",
      headers: {
        Authorization: `Token ${env.DEEPGRAM_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: audioUrl,
        model: "nova-3",
        diarize: true,
        detect_language: true,
        smart_format: true,
        punctuate: true,
        utterances: true,
      }),
    });

    if (!response.ok) {
      console.error("Deepgram API error:", await response.text());
      return null;
    }

    const result = (await response.json()) as any;
    const channels = result.results?.channels || [];
    if (channels.length === 0) return "";

    return (
      channels[0]?.alternatives?.map((a: any) => a.transcript).join("\n\n") ||
      ""
    );
  } catch (error) {
    console.error("Error transcribing:", error);
    return null;
  }
}

async function deleteRecording(recordingSid: string, env: Env): Promise<void> {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.json`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization:
          "Basic " + btoa(`${env.TWILIO_SID}:${env.TWILIO_AUTH_TOKEN}`),
      },
    });
    if (response.ok) {
      console.log(`Recording ${recordingSid} deleted successfully`);
    } else {
      console.error("Failed to delete recording:", await response.text());
    }
  } catch (error) {
    console.error("Error deleting recording:", error);
  }
}

function respondWithEmptyTwiML(): Response {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      headers: { "Content-Type": "text/xml" },
    },
  );
}

export class TranscriptStore extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sql = state.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT DEFAULT (datetime('now')),
        from_number TEXT,
        duration TEXT,
        transcript TEXT
      )
    `);
  }

  async add(from: string, duration: string, transcript: string): Promise<void> {
    this.sql.exec(
      "INSERT INTO transcripts (from_number, duration, transcript) VALUES (?, ?, ?)",
      from,
      duration,
      transcript,
    );
  }

  async list(): Promise<Transcript[]> {
    return this.sql
      .exec<Transcript>(
        "SELECT id, created_at, from_number, duration, transcript FROM transcripts ORDER BY created_at DESC",
      )
      .toArray();
  }

  async delete(id: number): Promise<void> {
    this.sql.exec("DELETE FROM transcripts WHERE id = ?", id);
  }
}
