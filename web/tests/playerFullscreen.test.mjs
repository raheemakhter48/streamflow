import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/playerFullscreen.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
});
const { enterPlayerFullscreen, exitPlayerFullscreen, ownsPlayerFullscreen } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('native fullscreen targets the wrapper with the correct receiver', async () => {
  const wrapper = { async requestFullscreen() { assert.equal(this, wrapper); } };
  assert.equal(await enterPlayerFullscreen(wrapper), true);
});

test('missing or denied fullscreen API falls back to in-page expansion', async () => {
  assert.equal(await enterPlayerFullscreen({}), false);
  assert.equal(await enterPlayerFullscreen({ requestFullscreen() { throw new Error('denied'); } }), false);
  assert.equal(await enterPlayerFullscreen({ async requestFullscreen() { throw new Error('denied'); } }), false);
});

test('wrapper and nested provider fullscreen are recognized and can exit', async () => {
  const frame = {};
  const wrapper = { contains: (element) => element === wrapper || element === frame };
  let exits = 0;
  for (const fullscreenElement of [wrapper, frame]) {
    const doc = { fullscreenElement, async exitFullscreen() { exits++; } };
    assert.equal(ownsPlayerFullscreen(wrapper, doc), true);
    await exitPlayerFullscreen(wrapper, doc);
  }
  assert.equal(exits, 2);
});

test('exit does not affect unrelated fullscreen elements', async () => {
  const wrapper = { contains: () => false };
  const doc = { fullscreenElement: {}, async exitFullscreen() { assert.fail('unrelated fullscreen exited'); } };
  assert.equal(ownsPlayerFullscreen(wrapper, doc), false);
  await exitPlayerFullscreen(wrapper, doc);
  doc.fullscreenElement = null;
  await exitPlayerFullscreen(wrapper, doc);
});
