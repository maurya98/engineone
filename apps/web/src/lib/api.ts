import { getToken } from './authToken';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...authHeaders(),
    ...(options.headers as Record<string, string>),
  };
  const res = await window.fetch(path, {
    ...options,
    credentials: 'include',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(err.message || err.error || res.statusText);
  }
  return res.json();
}

/** Like apiFetch but returns response text; sends JWT when available. */
export async function apiFetchText(
  path: string,
  options: RequestInit = {}
): Promise<string> {
  const headers: Record<string, string> = {
    ...authHeaders(),
    ...(options.headers as Record<string, string>),
  };
  const res = await window.fetch(path, {
    ...options,
    credentials: 'include',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(err.message || err.error || res.statusText);
  }
  return res.text();
}
