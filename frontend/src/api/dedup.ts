// In-flight request deduplication.
//
// React 18 StrictMode mounts effects twice in development (mount -> unmount ->
// remount). For data-fetching effects this means an identical GET is fired
// twice in quick succession. This helper collapses concurrent identical
// requests into a single network call so the browser only sees one request,
// while every caller still receives the resolved data.
//
// It only deduplicates requests that are *concurrently* in flight (same key
// issued before the previous one settles). Sequential calls with the same key
// are normal separate requests.

const inflight = new Map<string, Promise<unknown>>();

export function dedupeConcurrent<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = factory();
  // Drop the entry once the request settles so subsequent calls start fresh.
  promise.finally(() => {
    if (inflight.get(key) === promise) {
      inflight.delete(key);
    }
  });
  inflight.set(key, promise);
  return promise;
}
