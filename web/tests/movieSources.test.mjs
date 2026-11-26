import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/movieSources.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
});
const { SOURCES, DEFAULT_MOVIE_SOURCE } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const vidnest = SOURCES.find((item) => item.id === 'vidnest');
const embedwave = SOURCES.find((item) => item.id === 'embedwave');
const screenscape = SOURCES.find((item) => item.id === 'screenscape');
const autoEmbed = SOURCES.find((item) => item.id === 'autoembed');
const twoEmbed = SOURCES.find((item) => item.id === '2embed');

test('VidNest is default source and builds proper movie and tv urls', () => {
  assert.equal(DEFAULT_MOVIE_SOURCE, 'vidnest');
  assert.equal(vidnest.buildUrl('tt0172495', 98), 'https://vidnest.fun/movie/98');
  assert.equal(vidnest.buildUrl(undefined, 1399, 'tv', 2, 3), 'https://vidnest.fun/tv/1399/2/3');
});

test('EmbedWave and ScreenScape build proper movie and tv urls', () => {
  assert.equal(embedwave.buildUrl('tt0172495', 98), 'https://embedwave.cc/embed/movie/98');
  assert.equal(embedwave.buildUrl(undefined, 1399, 'tv', 2, 3), 'https://embedwave.cc/embed/tv/1399/2/3');
  assert.equal(screenscape.buildUrl('tt0172495', 98), 'https://screenscape.me/embed?tmdb=98&type=movie&lan=eng');
  assert.equal(screenscape.buildUrl('tt0172495', 98, 'movie', 1, 1, true), 'https://screenscape.me/embed?tmdb=98&type=movie&lan=hindi');
  assert.equal(screenscape.buildUrl(undefined, 1399, 'tv', 2, 3), 'https://screenscape.me/embed?tmdb=1399&type=tv&s=2&e=3&lan=eng');
});

test('AutoEmbed builds proper movie and tv urls', () => {
  assert.equal(autoEmbed.buildUrl('tt0172495', 98), 'https://autoembed.to/movie/tmdb/98');
  assert.equal(autoEmbed.buildUrl(undefined, 1399, 'tv', 1, 1), 'https://autoembed.to/tv/tmdb/1399-1-1');
});

test('2Embed builds proper movie and tv urls', () => {
  assert.equal(twoEmbed.buildUrl('tt0172495', 98), 'https://2embed.skin/embed/movie?tmdb=98');
  assert.equal(twoEmbed.buildUrl(undefined, 1399, 'tv', 2, 3), 'https://2embed.skin/embed/tv?tmdb=1399&s=2&e=3');
});

test('all working servers are present in order', () => {
  assert.deepEqual(SOURCES.map((item) => item.id), [
    'vidnest',
    'embedwave',
    'screenscape',
    'autoembed',
    '2embed',
    'multiembed'
  ]);
});
