import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHindiMovies, readHindiMovies } from '../lib/hindiCatalog.js';

const fixture = { tmdbId: 98, title: 'Fixture', playerUrl: 'https://example.com/embed/98',
  audioLanguage: 'hi', verified: true, verifiedAt: '2020-01-01T00:00:00Z' };

test('verified Hindi entry retains exact player URL and movie identity', () => {
  const [entry] = validateHindiMovies([fixture]);
  assert.equal(entry.tmdbId, 98);
  assert.equal(entry.playerUrl, fixture.playerUrl);
});

test('unverified, wrong-language, duplicate, unsafe and invalid records fail closed', () => {
  for (const override of [{ verified: false }, { audioLanguage: 'en' }, { verifiedAt: 'invalid' },
    { verifiedAt: '2999-01-01' }, { tmdbId: 0 }, { title: '' },
    { playerUrl: 'javascript:alert(1)' }, { playerUrl: 'https://user:secret@example.com/' }]) {
    assert.throws(() => validateHindiMovies([{ ...fixture, ...override }]));
  }
  assert.throws(() => validateHindiMovies([fixture, fixture]));
  assert.deepEqual(validateHindiMovies([]), []);
});

test('shipped catalog is parseable without any invented verified entries', async () => {
  assert.ok(Array.isArray(await readHindiMovies()));
});
