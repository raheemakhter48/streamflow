import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

process.env.TMDB_API_TOKEN = 'test-token';
const { default: router } = await import('../routes/movies.js');

const request = async (path, params = {}, query = {}) => {
  const route = router.stack.find((layer) => layer.route?.path === path).route;
  let body;
  let failure;
  const res = { set() { return this; }, json(value) { body = value; return this; }, status() { return this; } };
  await route.stack.at(-1).handle({ params, query }, res, (error) => { failure = error; });
  if (failure) throw failure;
  return body;
};

test('movie loading performance and fallback behavior', async (t) => {
  const originalGet = axios.get;
  t.after(() => { axios.get = originalGet; });

  await t.test('simultaneous catalog misses share one upstream request and cache the result', async () => {
    let calls = 0;
    let release;
    axios.get = async () => {
      calls++;
      await new Promise((resolve) => { release = resolve; });
      return { data: { results: [{ id: 1, title: 'Test', poster_path: '/poster.jpg' }] } };
    };
    const first = request('/movies');
    const second = request('/movies');
    assert.equal(calls, 1);
    release();
    const [a, b] = await Promise.all([first, second]);
    assert.deepEqual(a, b);
    assert.equal(a.data[0].poster, '/api/movies/assets/w342/poster.jpg');
    await request('/movies');
    assert.equal(calls, 1);
  });

  await t.test('failed combined details fall back to playable basic details without optional request waterfall', async () => {
    const calls = [];
    axios.get = async (url, options) => {
      calls.push({ url, options });
      if (options.params.append_to_response) throw Object.assign(new Error('Unavailable'), { response: { status: 503 } });
      return { data: { id: 22, title: 'Fallback', imdb_id: 'tt22' } };
    };
    const response = await request('/movie/:id', { id: '22' });
    assert.equal(response.data.imdbId, 'tt22');
    assert.equal(calls.length, 3);
    assert.ok(calls.every(({ url, options }) => url.endsWith('/movie/22') && options.timeout === 6000));
  });

  await t.test('permanent upstream failures are not retried and failed promises are cleared', async () => {
    let calls = 0;
    axios.get = async () => {
      calls++;
      throw Object.assign(new Error('Missing'), { response: { status: 404 } });
    };
    await assert.rejects(request('/movie/:id', { id: '33' }), { statusCode: 404 });
    assert.equal(calls, 1);
    await assert.rejects(request('/movie/:id', { id: '33' }), { statusCode: 404 });
    assert.equal(calls, 2);
  });
});
