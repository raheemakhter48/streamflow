import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/lib/movieHistory.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
});
const { readMovieHistory, saveMovieHistory, clearMovieHistory, movieHistoryKey } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const token = (id, extra = {}) => `header.${Buffer.from(JSON.stringify({ id, ...extra })).toString('base64url')}.signature`;

test('history is isolated across accounts, guests, renewed tokens and late writes', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) };
  const a = token('user-a');
  const b = token('guest-b');
  store.set('streamflow_recently_watched_movies', JSON.stringify([{ id: 999 }]));
  store.set('auth_token', a);
  assert.deepEqual(readMovieHistory(), []);
  assert.equal(store.has('streamflow_recently_watched_movies'), false);
  saveMovieHistory({ id: 1, title: 'A' }, a);
  store.set('auth_token', b);
  assert.deepEqual(readMovieHistory(), []);
  saveMovieHistory({ id: 2, title: 'Late A response' }, a);
  assert.deepEqual(readMovieHistory(), []);
  saveMovieHistory({ id: 3, title: 'B' }, b);
  clearMovieHistory();
  assert.deepEqual(readMovieHistory(), []);
  store.set('auth_token', token('user-a', { iat: 123 }));
  assert.deepEqual(readMovieHistory().map((item) => item.id), [1]);
  store.delete('auth_token');
  assert.deepEqual(readMovieHistory(), []);
  assert.equal(movieHistoryKey('invalid'), null);
});
