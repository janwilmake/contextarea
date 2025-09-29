const main = async () => {
  const apiKey = process.env.GITHUB_MASTER_SECRET;
  const files: any[] = [];
  const repos = [
    "generativeweb",
    "openapi-augmentation",
    "openapi-search-text",
    "shuffle-hackernews",
    "shufflesite-text",
    "edge-util",
    "shuffle-agents",
    "irfc-cloud",
  ];

  const response = await fetch("http://localhost:3000/irfc-admin/syncBranch", {
    method: "POST",
    body: JSON.stringify({
      owner: "codefromanywhere",
      branch: "main",
      repo: "xinzuo",
      // without force, it would just look at the last commit
      force: true,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
    },
  });

  if (!response.ok || !response.body) {
    console.error(response.status, await response.text());
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const events = chunk.split("\n\n").filter(Boolean);

    for (const event of events) {
      const [, data] = event.split("data: ");
      if (data) {
        try {
          const parsedData = JSON.parse(data);
          console.log(JSON.stringify(parsedData));
        } catch (error) {
          console.log("Raw event data:", data);
        }
      }
    }
  }
};

main().catch(console.error);
