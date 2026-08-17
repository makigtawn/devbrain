import { getSession, refreshSession } from "./auth";
import { API_BASE_URL } from "./config";

export async function saveEntry(input: {
  title: string;
  content: string;
  sourceUrl?: string;
}) {
  let session = await getSession();

  if (!session) {
    throw new Error("Not signed in");
  }

  let res = await fetch(`${API_BASE_URL}/api/extension/entries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(input),
  });

  // Handle access token expiration with silent refresh and retry
  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      throw new Error("Session expired. Please sign in again.");
    }

    res = await fetch(`${API_BASE_URL}/api/extension/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshed.accessToken}`,
      },
      body: JSON.stringify(input),
    });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : "Save failed");
  }

  return res.json() as Promise<{ id: string }>;
}
