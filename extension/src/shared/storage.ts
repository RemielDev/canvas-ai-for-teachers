// Thin wrapper around chrome.storage.local with typed keys.
// Never store student PII, embeddings, or PAT plaintext here.
// See docs/EXTENSION.md#security-posture for the full rule set.

type StoredShape = {
  jwt: string | null;
  refreshToken: string | null;
  teacherId: string | null;
  canvasUrl: string | null;
  lastSignInAt: number | null;
};

const DEFAULTS: StoredShape = {
  jwt: null,
  refreshToken: null,
  teacherId: null,
  canvasUrl: null,
  lastSignInAt: null,
};

export async function get<K extends keyof StoredShape>(
  key: K
): Promise<StoredShape[K]> {
  const res = await chrome.storage.local.get(key);
  return (res[key] ?? DEFAULTS[key]) as StoredShape[K];
}

export async function set<K extends keyof StoredShape>(
  key: K,
  value: StoredShape[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.clear();
}
