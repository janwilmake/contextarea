interface RepoDetails {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  archived: boolean;
  default_branch: string;
  pushed_at: string | null;
  created_at: string;
  homepage: string | null;
  topics: string[] | null;
  updated_at: string;
  owner: {
    login: string;
    id: number;
    // ... other owner properties
  };
  // ... other repository properties
}

export async function fetchRepoDetails(
  token: string | undefined,
  owner: string,
  repo: string,
): Promise<{ status: number; result?: RepoDetails }> {
  const headers: { [key: string]: string } = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  console.log("checking", url, headers);
  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    return { status: response.status };
  }

  const data: RepoDetails = await response.json();
  return { result: data, status: response.status };
}

// fetchRepoDetails(undefined, "brunabaudel", "brunabaudel.github.io").then(
//   console.log,
// );
