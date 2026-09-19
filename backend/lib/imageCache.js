// Public, immutable artwork only. Bound by bytes as well as entry count.
export const createImageCache = ({ maxBytes = 32 * 1024 * 1024, maxEntries = 500, ttlMs = 86400000, now = Date.now } = {}) => {
  const entries = new Map();
  const pending = new Map();
  let bytes = 0;
  const remove = (key) => {
    bytes -= entries.get(key).value.data.length;
    entries.delete(key);
  };
  return {
    async get(key, fetchImage) {
      const cached = entries.get(key);
      if (cached && cached.expires > now()) {
        entries.delete(key);
        entries.set(key, cached);
        return cached.value;
      }
      if (cached) remove(key);
      if (pending.has(key)) return pending.get(key);
      const request = Promise.resolve().then(fetchImage).then((value) => {
        if (value.data.length <= maxBytes && maxEntries > 0) {
          if (entries.has(key)) remove(key);
          while (entries.size && (bytes + value.data.length > maxBytes || entries.size >= maxEntries)) {
            remove(entries.keys().next().value);
          }
          entries.set(key, { value, expires: now() + ttlMs });
          bytes += value.data.length;
        }
        return value;
      });
      // Avoid retaining an unbounded number of in-flight cache keys.
      if (pending.size < 64) pending.set(key, request);
      try { return await request; }
      finally { if (pending.get(key) === request) pending.delete(key); }
    }
  };
};
