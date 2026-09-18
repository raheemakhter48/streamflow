// Only public metadata belongs here, never credentials or user data.
export const createCatalogCache = ({ ttlMs = 300000, staleMs = 3600000, maxEntries = 500, now = Date.now } = {}) => {
  const entries = new Map();
  const pending = new Map();
  return {
    get(key, loader, canServeStale = () => false) {
      const cached = entries.get(key);
      if (cached && now() - cached.savedAt < ttlMs) return Promise.resolve(cached.data);
      if (pending.has(key)) return pending.get(key);
      const request = Promise.resolve().then(loader).then((data) => {
        entries.delete(key);
        entries.set(key, { data, savedAt: now() });
        while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
        return data;
      }).catch((error) => {
        if (cached && now() - cached.savedAt < ttlMs + staleMs && canServeStale(error)) return cached.data;
        throw error;
      }).finally(() => pending.delete(key));
      pending.set(key, request);
      return request;
    }
  };
};
