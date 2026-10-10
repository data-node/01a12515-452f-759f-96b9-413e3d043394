import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata, validateOllamaUrl, embed, enrichItem } from '../electron/ai.ts';
import { LibraryService } from '../electron/service.ts';
import { Store } from '../electron/store.ts';
import { DEFAULT_SETTINGS, type Item } from '../shared/types.ts';

test('AI JSON is validated and tags are deduplicated', () => {
  assert.deepEqual(parseMetadata('```json\n{"title":"Claude","summary":"Project root","tags":["ai","ai",7],"keywords":["agents"]}\n```'), { title: 'Claude', summary: 'Project root', tags: ['ai'], keywords: ['agents'] });
  assert.throws(() => parseMetadata('{"title":7}')); assert.throws(() => parseMetadata('plain prose'));
});
test('Ollama accepts loopback HTTP and verified remote HTTPS, rejecting credentials and URL tricks', () => {
  assert.equal(validateOllamaUrl('http://127.0.0.1:11434'), 'http://127.0.0.1:11434');
  assert.equal(validateOllamaUrl('https://models.example.org'), 'https://models.example.org');
  for (const url of ['http://remote.example.org', 'http://127.0.0.1:11434/path', 'http://user:key@localhost', 'file:///tmp', 'http://localhost?key=value']) assert.throws(() => validateOllamaUrl(url));
});
test('captures are persisted before provider failure and remain searchable', async () => {
  const db = new Store(':memory:');
  const service = new LibraryService(db, () => ({ ...DEFAULT_SETTINGS, provider: 'anthropic' }), () => undefined, () => {});
  const result = service.capture({ locator: 'C:\\Claude', description: 'Claude root folder' });
  assert.equal(db.stats().total, 1); await service.idle(); assert.equal(db.get(result.item.id)!.status, 'error');
  assert.match(db.get(result.item.id)!.error, /API key/); assert.equal((await service.search({ query: 'root' }))[0].locator, 'C:\\Claude'); db.close();
});
test('provider adapter sends selected model, preserves verification and handles authentication errors without echoing secrets', async t => {
  const item = { title: 'Test', locator: 'https://example.org', description: 'a link', tags: [] } as unknown as Item;
  let body: any;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => { body = JSON.parse(String(init.body)); assert.equal(init.redirect, 'error'); return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"title":"Example","summary":"A link","tags":[],"keywords":[]}' }] }), { status: 200 }); });
  const result = await enrichItem(item, { ...DEFAULT_SETTINGS, provider: 'anthropic', anthropicModel: 'custom-model' }, 'test-key');
  assert.equal(body.model, 'custom-model'); assert.equal(result.title, 'Example');
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => new Response('test-secret-response', { status: 401 }));
  await assert.rejects(enrichItem(item, { ...DEFAULT_SETTINGS, provider: 'anthropic' }, 'test-key'), /authentication failed/);
});
test('semantic service falls back to actual BM25 when the embedding endpoint is offline', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  const db = new Store(':memory:'); db.capture({ locator: 'https://sqlite.org', description: 'SQLite full text reference' });
  const service = new LibraryService(db, () => ({ ...DEFAULT_SETTINGS, embeddings: true }), () => undefined, () => {});
  const result = await service.search({ query: 'sqlite' }); assert.equal(result.length, 1); assert.equal(result[0].match, 'text'); db.close();
});
test('stale AI work cannot overwrite a newer duplicate capture', async t => {
  const resolves: ((value: Response) => void)[] = [];
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>(resolve => resolves.push(resolve)));
  const db = new Store(':memory:');
  const service = new LibraryService(db, () => ({ ...DEFAULT_SETTINGS, provider: 'ollama' }), () => undefined, () => {});
  const result = service.capture({ locator: 'C:\\Claude', description: 'old description' });
  service.capture({ locator: 'C:\\Claude', description: 'new description' });
  const response = (title: string) => new Response(JSON.stringify({ message: { content: JSON.stringify({ title, summary: title, tags: [], keywords: [] }) } }));
  resolves[1](response('New title')); resolves[0](response('Stale title'));
  await service.idle(); assert.equal(db.get(result.item.id)!.title, 'New title'); assert.equal(db.get(result.item.id)!.description, 'new description'); db.close();
});
test('deleting while AI is in flight never recreates the item', async t => {
  let resolve!: (value: Response) => void;
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>(r => { resolve = r; }));
  const db = new Store(':memory:'); const service = new LibraryService(db, () => ({ ...DEFAULT_SETTINGS, provider: 'ollama' }), () => undefined, () => {});
  const result = service.capture({ locator: 'https://example.org', description: 'a reference' }); service.remove(result.item.id);
  resolve(new Response(JSON.stringify({ message: { content: '{"title":"Removed","summary":"safe","tags":[],"keywords":[]}' } })));
  await service.idle(); assert.equal(db.stats().total, 0); db.close();
});
test('embedding adapter validates numerical output', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ embeddings: [[1, 0.5, 0]] })));
  assert.deepEqual(await embed('test', DEFAULT_SETTINGS), [1, 0.5, 0]);
  t.mock.restoreAll(); t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ embeddings: [[]] })));
  await assert.rejects(embed('test', DEFAULT_SETTINGS), /invalid vector/);
});
