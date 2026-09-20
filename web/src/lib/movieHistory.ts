const LEGACY_KEY = 'streamflow_recently_watched_movies';

// The decoded ID only partitions local UI data; backend authentication still
// verifies the JWT. Never use the token itself as a storage key.
export const movieHistoryKey = (token: string | null) => {
  try {
    if (!token) return null;
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    if (typeof payload.id !== 'string' || !payload.id) return null;
    return `${LEGACY_KEY}:user:${encodeURIComponent(payload.id)}`;
  } catch { return null; }
};

export const readMovieHistory = (token = localStorage.getItem('auth_token')): any[] => {
  try {
    localStorage.removeItem(LEGACY_KEY); // Ownership of legacy data is unknown.
    const key = movieHistoryKey(token);
    if (!key) return [];
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
};

export const saveMovieHistory = (movie: { id: number; [key: string]: unknown }, token: string | null) => {
  try {
    if (token !== localStorage.getItem('auth_token')) return;
    const key = movieHistoryKey(token);
    if (!key) return;
    const previous = readMovieHistory(token).filter((item) => item?.id !== movie.id);
    localStorage.setItem(key, JSON.stringify([movie, ...previous].slice(0, 15)));
  } catch { /* Storage may be unavailable. */ }
};

export const clearMovieHistory = () => {
  localStorage.removeItem(LEGACY_KEY);
  const key = movieHistoryKey(localStorage.getItem('auth_token'));
  if (key) localStorage.removeItem(key);
};
