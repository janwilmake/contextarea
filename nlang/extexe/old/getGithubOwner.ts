export interface GitHubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export async function getGithubOwner(apiKey: string): Promise<{
  status: number;
  message?: string;
  data?: GitHubUser;
}> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${apiKey}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "GitHubUsernameRetriever",
      },
    });

    if (!response.ok) {
      return {
        status: response.status,
        message: `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      status: 200,
      data,
    };
  } catch (error: any) {
    console.error("Error fetching GitHub username:", error);
    return { status: 500, message: error.message };
  }
}

export async function getGithubUser(
  apiKey: string,
  username: string,
): Promise<{
  status: number;
  message?: string;
  data?: GitHubUser;
}> {
  try {
    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        Authorization: `token ${apiKey}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "GitHubUsernameRetriever",
      },
    });

    if (!response.ok) {
      return {
        status: response.status,
        message: `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      status: 200,
      data,
    };
  } catch (error: any) {
    console.error("Error fetching GitHub username:", error);
    return { status: 500, message: error.message };
  }
}
