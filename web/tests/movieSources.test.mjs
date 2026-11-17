import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/movieSources.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
});
const { SOURCES, DEFAULT_MOVIE_SOURCE } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const vidsrcStream = SOURCES.find((item) => item.id === 'vidsrc_stream');
const autoEmbed = SOURCES.find((item) => item.id === 'autoembed');
const twoEmbed = SOURCES.find((item) => item.id === '2embed');

test('VidSrc Stream builds proper movie and tv urls', () => {
  assert.equal(vidsrcStream.buildUrl('tt0172495', 98), 'https://vidsrc.stream/embed/movie/98');
  assert.equal(vidsrcStream.buildUrl(undefined, 1399, 'tv', 2, 3), 'https://vidsrc.stream/embed/tv/1399/2/3');
});

test('AutoEmbed builds proper movie and tv urls', () => {
  assert.equal(autoEmbed.buildUrl('tt0172495', 98), 'https://autoembed.to/movie/tmdb/98');
  assert.equal(autoEmbed.buildUrl(undefined, 1399, 'tv', 1, 1), 'https://autoembed.to/tv/tmdb/1399-1-1');
});

test('2Embed builds proper movie and tv urls', () => {
  assert.equal(twoEmbed.buildUrl('tt0172495', 98), 'https://2embed.skin/embed/movie?tmdb=98');
  assert.equal(twoEmbed.buildUrl(undefined, 1399, 'tv', 2, 3), 'https://2embed.skin/embed/tv?tmdb=1399&s=2&e=3');
});

test('default source points to verified provider and all working servers are present', () => {
  assert.equal(DEFAULT_MOVIE_SOURCE, 'vidsrc_stream');
  assert.deepEqual(SOURCES.map((item) => item.id), ['vidsrc_stream', 'vidsrc_me', 'autoembed', '2embed', 'multiembed', 'vidjoy']);
});
