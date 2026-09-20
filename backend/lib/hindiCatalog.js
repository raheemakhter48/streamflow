import { readFile } from 'node:fs/promises';

export const validateHindiMovies = (entries) => {
  if (!Array.isArray(entries)) throw new Error('Hindi catalog must be an array');
  const ids = new Set();
  return entries.map((entry) => {
    const url = new URL(entry.playerUrl);
    if (!Number.isSafeInteger(entry.tmdbId) || entry.tmdbId <= 0 || ids.has(entry.tmdbId)
      || !entry.title?.trim() || entry.audioLanguage !== 'hi' || entry.verified !== true
      || !Number.isFinite(Date.parse(entry.verifiedAt)) || Date.parse(entry.verifiedAt) > Date.now()
      || url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Invalid or unverified Hindi catalog entry');
    }
    ids.add(entry.tmdbId);
    return { tmdbId: entry.tmdbId, title: entry.title.trim(), playerUrl: url.href,
      audioLanguage: 'hi', verifiedAt: entry.verifiedAt };
  });
};

// Read on request so a corrected/revoked entry does not require a restart.
export const readHindiMovies = async () => validateHindiMovies(JSON.parse(
  await readFile(new URL('../data/hindiMovies.json', import.meta.url), 'utf8')
));
