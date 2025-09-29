export async function getLastCommitBeforeDate(
  owner: string,
  repo: string,
  timestamp: number | null,
  token: string,
): Promise<{
  message?: string;
  status: number;
  sha?: string;
}> {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/commits`;

  let url = baseUrl + `?per_page=1`;

  if (timestamp) {
    const date = new Date(timestamp);
    const isoDate = date.toISOString();
    url += `&until=${isoDate}`;
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      return { status: response.status };
    }

    const commits = await response.json();

    if (commits.length > 0) {
      return { sha: commits[0].sha, status: 200 }; // Return the first (most recent) commit
    } else {
      return { status: 200 }; // No commits found
    }
  } catch (error: any) {
    console.error("Error fetching commit:", error);
    return { status: 500, message: error.message };
  }
}
