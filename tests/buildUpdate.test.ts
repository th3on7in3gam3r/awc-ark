import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arkRefreshUrl, fetchArkUpdate } from '../src/lib/buildUpdate';

const base = 'https://awc-connect.vercel.app/ark/';
const signal = new AbortController().signal;

test('detects a different deployment through the same-origin noncached Ark manifest', async () => {
  const update = await fetchArkUpdate('running', base, signal, async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://awc-connect.vercel.app');
    assert.equal(url.pathname, '/ark/build-version.json');
    assert.ok(url.searchParams.get('check'));
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.signal, signal);
    return Response.json({ version: 'new-build' });
  });
  assert.equal(update, 'new-build');
});

test('does not request a refresh for the same build or an invalid manifest', async () => {
  for (const value of ['running', '', '../different-app', null, 123]) {
    assert.equal(await fetchArkUpdate('running', base, signal, async () => Response.json({ version: value })), null);
  }
  assert.equal(await fetchArkUpdate('running', base, signal, async () => new Response('unavailable', { status: 503 })), null);
});

test('refresh revalidates the page and preserves the current game route', () => {
  assert.equal(arkRefreshUrl(`${base}?arkBuild=old&theme=cream#/play/snake`, 'new-build'),
    `${base}?arkBuild=new-build&theme=cream#/play/snake`);
});
