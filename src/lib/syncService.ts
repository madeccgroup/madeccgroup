import { auth } from './firebase.ts';

// Helper to retrieve correct headers for both standard and administrative bypass authentication
async function getAuthHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const bypassToken = sessionStorage.getItem('admin_token');
  if (bypassToken) {
    headers['Authorization'] = `Bearer ${bypassToken}`;
  } else if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      console.error('Failed to get Firebase token during sync headers acquisition:', e);
    }
  }
  return headers;
}

/**
 * Fetches all persistent states synced in the Neon PostgreSQL database for the current logged-in user.
 */
export async function fetchUserSyncData(): Promise<Record<string, any>> {
  try {
    const headers = await getAuthHeaders();
    if (!headers['Authorization']) {
      return {};
    }

    const res = await fetch('/api/user-sync', { headers });
    if (res.ok) {
      const { data } = await res.json();
      const parsed: Record<string, any> = {};
      for (const key of Object.keys(data)) {
        try {
          parsed[key] = JSON.parse(data[key]);
        } catch (e) {
          parsed[key] = data[key];
        }
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error fetching user sync data from Neon:', err);
  }
  return {};
}

/**
 * Saves a persistent state key-value pair to the live Neon database, falling back to local cache if logged out.
 */
export async function saveUserSyncData(key: string, value: any): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    if (!headers['Authorization']) {
      // Local caching for unauthenticated or preview mode
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      return false;
    }

    // Clear local storage copy to ensure absolute single-source-of-truth in Neon database
    localStorage.removeItem(key);

    const res = await fetch('/api/user-sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ key, value })
    });
    return res.ok;
  } catch (err) {
    console.error(`Error saving user sync data for key ${key}:`, err);
    return false;
  }
}
