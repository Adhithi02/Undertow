type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
const TTL_MS = 30_000;

export async function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await compute();
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}