import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/movieSources.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
});
const { SOURCES, DEFAULT_MOVIE_SOURCE } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const provider = SOURCES.find((item) => item.id === '2embed');

test('2Embed receives a TMDB or IMDb movie ID in its documented path', () => {
  assert.equal(provider.buildUrl('tt0172495', 98), 'https://www.2embed.cc/embed/98');
  assert.equal(provider.buildUrl('tt0172495'), 'https://www.2embed.cc/embed/tt0172495');
});

test('2Embed receives TV ID, season and episode using its embedtv route', () => {
  assert.equal(provider.buildUrl(undefined, 1399, 'tv', 2, 3), 'https://www.2embed.cc/embedtv/1399&s=2&e=3');
  assert.equal(provider.buildUrl('tt0944947', undefined, 'tv', 1, 1), 'https://www.2embed.cc/embedtv/tt0944947&s=1&e=1');
});

test('default source points to the corrected provider and all tabs remain available', () => {
  assert.equal(DEFAULT_MOVIE_SOURCE, '2embed');
  assert.deepEqual(SOURCES.map((item) => item.id), ['vidsrc', 'smashy', 'moviesapi', 'autoembed', '2embed', 'videasy']);
});
