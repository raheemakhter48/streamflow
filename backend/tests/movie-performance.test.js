import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

process.env.TMDB_API_TOKEN = 'test-token';
const { default: router } = await import('../routes/movies.js');

const request = async (path, params = {}, query = {}) => {
  const route = router.stack.find((layer) => layer.route?.path === path).route;
  let body;
  let failure;
  const res = { set() { return this; }, send(value) { body = value; return this; }, json(value) { body = value; return this; }, status() { return this; } };
  await route.stack.at(-1).handle({ params, query }, res, (error) => { failure = error; });
  if (failure) throw failure;
  return body;
};

test('movie loading performance and fallback behavior', async (t) => {
  const originalGet = axios.get;
  t.after(() => { axios.get = originalGet; });

  await t.test('movie and series pagination keep distinct pages and retry a failed page without resetting', async () => {
    const calls = [];
    axios.get = async (url, options) => {
      calls.push({ url, page: options.params.page });
      return { data: { page: options.params.page, total_pages: 10, results: [
        { id: options.params.page * 100, title: 'Page item', name: 'Page item' }
      ] } };
    };
    for (const route of ['/movies', '/series']) {
      for (const page of [2, 3, 4]) {
        const result = await request(route, {}, { page: String(page) });
        assert.equal(result.page, page);
        assert.equal(result.data[0].id, page * 100);
      }
    }
    assert.deepEqual(calls.map((call) => call.page), [2, 3, 4, 2, 3, 4]);
    const failedPages = [];
    axios.get = async (_url, options) => {
      failedPages.push(options.params.page);
      throw Object.assign(new Error('Unavailable'), { response: { status: 503 } });
    };
    await assert.rejects(request('/movies', {}, { page: '5' }), { statusCode: 502 });
    assert.deepEqual(failedPages, [5, 5]);
    axios.get = async (_url, options) => ({ data: { page: options.params.page, results: [{ id: 500, title: 'Recovered' }] } });
    assert.equal((await request('/movies', {}, { page: '5' })).page, 5);
  });

  await t.test('poster route reuses a complete image and rejects non-image responses', async () => {
    let calls = 0;
    axios.get = async (_url, options) => {
      calls++;
      assert.equal(options.responseType, 'arraybuffer');
      assert.equal(options.maxContentLength, 8 * 1024 * 1024);
      return { data: Buffer.from('poster'), headers: { 'content-type': 'image/jpeg' } };
    };
    const params = { size: 'w342', 0: 'cache-test.jpg' };
    const [a, b] = await Promise.all([
      request('/movies/assets/:size/*', params),
      request('/movies/assets/:size/*', params)
    ]);
    assert.equal(a.toString(), 'poster');
    assert.deepEqual(a, b);
    assert.equal(calls, 1);
    axios.get = async () => ({ data: Buffer.from('error'), headers: { 'content-type': 'text/html' } });
    await assert.rejects(request('/movies/assets/:size/*', { size: 'w342', 0: 'bad.jpg' }), /Invalid movie image/);
  });

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
    await Promise.resolve();
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
