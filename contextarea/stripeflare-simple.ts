import { Stripe } from "stripe";
import { getMultiStub } from "multistub";
import { DurableObject } from "cloudflare:workers";
import { Queryable, QueryableHandler } from "queryable-object";
import { Migratable } from "migratable-object";

@Migratable({
  migrations: {
    1: [
      `CREATE TABLE users (
        user_id TEXT PRIMARY KEY,
        balance INTEGER DEFAULT 0,
        name TEXT,
        email TEXT
      )`,
      `CREATE INDEX idx_users_balance ON users(balance)`,
      `CREATE INDEX idx_users_email ON users(email)`,
    ],
  },
})
@Queryable()
export class DORM extends DurableObject {
  sql: SqlStorage;
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sql = state.storage.sql;
    this.env = env;
  }
}

const AGGREGATE_NAME = "aggregate";

export interface Env {
  DORM_NAMESPACE: DurableObjectNamespace<DORM & QueryableHandler>;
  STRIPE_PAYMENT_LINK: string;
  STRIPE_SECRET: string;
  STRIPE_WEBHOOK_SIGNING_SECRET: string;
  STRIPEFLARE_VERSION: string;
}

export type StripeUser = {
  userId: string;
  balance: number;
  name: string | null;
  email: string | null;
  paymentLink: string;
  charge: (
    amountCent: number,
    allowNegativeBalance: boolean,
  ) => Promise<{
    charged: boolean;
    message: string;
  }>;
};

const streamToBuffer = async (
  readableStream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  const reader = readableStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);

  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }

  return result;
};

/**
 * Get user balance and payment information
 */
export async function getStripeflareUser(
  userId: string | null,
  env: Env,
  ctx: ExecutionContext,
): Promise<StripeUser | null> {
  if (!userId) {
    return null;
  }
  if (
    !env.STRIPE_PAYMENT_LINK ||
    !env.STRIPE_SECRET ||
    !env.STRIPEFLARE_VERSION ||
    !env.STRIPE_WEBHOOK_SIGNING_SECRET
  ) {
    throw new Error("Missing Stripe configuration");
  }

  const stubName = `${env.STRIPEFLARE_VERSION}-user-${userId}`;
  const client = getMultiStub(
    env.DORM_NAMESPACE,
    [
      { name: stubName },
      { name: `${env.STRIPEFLARE_VERSION}-${AGGREGATE_NAME}` },
    ],
    ctx,
  );

  let user: StripeUser | null = null;

  try {
    const userResult = (await client.exec(
      "SELECT * FROM users WHERE user_id = ?",
      userId,
    )) as unknown as { array: StripeUser[] };

    user = userResult.array?.[0] || null;
  } catch (e: any) {
    // User not found, will create a record when they make first payment
    console.log({ err: e.message });
  }

  const balance = user?.balance || 0;
  const email = user?.email || null;
  const name = user?.name || null;
  const paymentLink = `${
    env.STRIPE_PAYMENT_LINK
  }?client_reference_id=${encodeURIComponent(userId)}`;

  async function charge(
    amountCent: number,
    allowNegativeBalance: boolean,
  ): Promise<{
    charged: boolean;
    message: string;
  }> {
    if (!user) {
      return {
        charged: false,
        message: "User has not made a payment yet",
      };
    }

    const client = getMultiStub(
      env.DORM_NAMESPACE,
      [
        { name: stubName },
        { name: `${env.STRIPEFLARE_VERSION}-${AGGREGATE_NAME}` },
      ],
      ctx,
    );

    const result = allowNegativeBalance
      ? await client.exec(
          "UPDATE users SET balance = balance - ? WHERE user_id = ?",
          amountCent,
          userId,
        )
      : await client.exec(
          "UPDATE users SET balance = balance - ? WHERE user_id = ? AND balance >= ?",
          amountCent,
          userId,
          amountCent,
        );

    if (result.rowsWritten === 0) {
      return { charged: false, message: "Insufficient balance" };
    }

    return { charged: true, message: "Successfully charged" };
  }

  return { userId, balance, email, name, paymentLink, charge };
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!request.body) {
    return new Response(JSON.stringify({ error: "No body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await streamToBuffer(request.body);
  const rawBodyString = new TextDecoder().decode(rawBody);

  const stripe = new Stripe(env.STRIPE_SECRET, {
    apiVersion: "2025-09-30.clover",
  });

  const stripeSignature = request.headers.get("stripe-signature");
  if (!stripeSignature) {
    return new Response(JSON.stringify({ error: "No signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBodyString,
      stripeSignature,
      env.STRIPE_WEBHOOK_SIGNING_SECRET,
    );
  } catch (err: any) {
    console.log("Webhook error:", err.message);
    return new Response(`Webhook error: ${String(err)}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.payment_status !== "paid" || !session.amount_total) {
      return new Response("Payment not completed", { status: 400 });
    }

    const { client_reference_id, customer_details, amount_total } = session;

    if (!client_reference_id) {
      return new Response("Missing client_reference_id", { status: 400 });
    }

    if (!customer_details?.email) {
      return new Response("Missing customer email", { status: 400 });
    }

    const userId = client_reference_id;

    const client = getMultiStub(
      env.DORM_NAMESPACE,
      [
        { name: `${env.STRIPEFLARE_VERSION}-user-${userId}` },
        { name: `${env.STRIPEFLARE_VERSION}-${AGGREGATE_NAME}` },
      ],
      ctx,
    );

    // Check if user exists
    const userResult: any = await client.exec(
      "SELECT * FROM users WHERE user_id = ?",
      userId,
    );

    const existingUser = userResult.array?.[0] as StripeUser | undefined;

    if (existingUser) {
      // Update existing user
      await client.exec(
        "UPDATE users SET balance = balance + ?, email = ?, name = ? WHERE user_id = ?",
        amount_total,
        customer_details.email,
        customer_details.name || null,
        userId,
      );
    } else {
      // Create new user
      await client.exec(
        "INSERT INTO users (user_id, balance, email, name) VALUES (?, ?, ?, ?)",
        userId,
        amount_total,
        customer_details.email,
        customer_details.name || null,
      );
    }

    return new Response("Payment processed successfully", { status: 200 });
  }

  return new Response("Event not handled", { status: 200 });
}
