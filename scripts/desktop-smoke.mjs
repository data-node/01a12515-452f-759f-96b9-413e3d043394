import { _electron as electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

// This isolated smoke collection never touches the real user's library.
const dataDir = await mkdtemp(path.join(tmpdir(), 'notch-smoke-'));
await mkdir('test-results', { recursive: true });
const args = process.env.NOTCH_SMOKE_EXECUTABLE ? ['--disable-gpu'] : ['.', '--disable-gpu'];
const launchOptions = { args, ...(process.env.NOTCH_SMOKE_EXECUTABLE ? { executablePath: path.resolve(process.env.NOTCH_SMOKE_EXECUTABLE) } : {}), env: { ...process.env, NOTCH_DATA_DIR: dataDir, NOTCH_DEV_URL: '' }, timeout: 30000 };
// Only constrained Linux CI may explicitly opt out of Chromium's OS sandbox.
// The shipped app and normal development command never set this flag.
if (process.env.NOTCH_SMOKE_NO_SANDBOX === '1') args.push('--no-sandbox');
let desktop;
async function libraryWindow(app) {
  for (let i = 0; i < 100; i++) {
    const page = app.windows().find(p => p.url().includes('index.html') && !p.url().includes('window=capture'));
    if (page) return page;
    await setTimeout(100);
  }
  throw new Error('The native library did not load.');
}
try {
  desktop = await electron.launch(launchOptions);
  const library = await libraryWindow(desktop);
  await library.waitForFunction(() => Boolean(window.notch));
  await expect(library.getByRole('heading', { name: 'A place for your next thought.' })).toBeVisible();
  assert.equal(await library.getByText('Preview · sample data').count(), 0);
  const result = await library.evaluate(async () => {
    const saved = await window.notch.capture({ locator: 'C:\\Projects\\Claude', description: 'This is the Claude root folder for prompts and agents.', tags: ['ai', 'development'] });
    const hits = await window.notch.search({ query: 'claude root folder' });
    await window.notch.favorite(saved.item.id);
    return { saved, hits, stats: await window.notch.stats(), settings: await window.notch.settings() };
  });
  assert.equal(result.hits[0].locator, 'C:\\Projects\\Claude'); assert.equal(result.stats.favorites, 1); assert.equal(result.saved.item.status, 'local');
  assert.equal('apiKey' in result.settings, false);
  const isolation = await library.evaluate(() => ({ require: typeof window.require, process: typeof window.process }));
  assert.deepEqual(isolation, { require: 'undefined', process: 'undefined' });
  await library.evaluate(() => window.notch.showCapture());
  const capture = desktop.windows().find(page => page.url().includes('window=capture'));
  assert.ok(capture, 'Native capture window exists');
  await expect(capture.getByRole('textbox', { name: 'Link or folder path' })).toBeVisible();
  await capture.getByRole('textbox', { name: 'Link or folder path' }).fill('https://sqlite.org/fts5.html');
  await capture.getByRole('textbox', { name: 'Description', exact: true }).fill('SQLite full text search and BM25 reference.');
  await capture.getByRole('textbox', { name: 'Tags (optional)' }).fill('reference, development');
  await capture.screenshot({ path: 'test-results/native-capture.png', animations: 'disabled' });
  await capture.getByRole('button', { name: 'Keep it' }).click();
  await expect(capture.getByRole('heading', { name: 'A little less to remember.' })).toBeVisible();
  await capture.getByRole('button', { name: 'Your space', exact: true }).click();
  await expect(library.getByRole('heading', { name: 'Claude', exact: true })).toBeVisible();
  await library.getByRole('textbox', { name: 'Search your space' }).fill('BM25');
  await expect(library.getByRole('heading', { name: 'sqlite.org/fts5.html', exact: true })).toBeVisible();
  await library.getByRole('textbox', { name: 'Search your space' }).fill('');
  await library.screenshot({ path: 'test-results/native-library.png', animations: 'disabled' });
  const native = await desktop.evaluate(({ BrowserWindow, globalShortcut }) => ({ windows: BrowserWindow.getAllWindows().length, shortcut: globalShortcut.isRegistered('Control+I'), captureOnTop: BrowserWindow.getAllWindows().some(w => w.isAlwaysOnTop()) }));
  assert.equal(native.windows, 2); assert.equal(native.shortcut, true); assert.equal(native.captureOnTop, true);
  const expanded = await library.evaluate(async () => {
    const hits = await window.notch.search({query: 'type:folder tag:ai'});
    const root = hits[0];
    await window.notch.edit(root.id, {locator: root.locator, title: 'My Claude root', description: 'Orchestration home for my agents.', kind: 'folder', tags: ['ai']});
    const saved = await window.notch.saveSearch('Agent roots', {query: 'type:folder tag:ai'});
    await window.notch.archive(root.id);
    const active = await window.notch.search({query: 'orchestration'});
    const archived = await window.notch.search({query: 'orchestration', scope: 'archived'});
    await window.notch.remove(root.id);
    const trash = await window.notch.search({query: 'orchestration', scope: 'trash'});
    await window.notch.restore(root.id);
    return {active, archived, trash, saved, restored: await window.notch.search({query: 'orchestration'})};
  });
  assert.equal(expanded.active.length,0); assert.equal(expanded.archived.length,1); assert.equal(expanded.trash.length,1); assert.equal(expanded.restored[0].title,'My Claude root');
  // Close/relaunch confirms saved SQLite persistence, not just renderer state.
  await desktop.close(); desktop = undefined;
  desktop = await electron.launch(launchOptions);
  const restored = await libraryWindow(desktop); await restored.waitForFunction(() => Boolean(window.notch));
  const after = await restored.evaluate(async () => ({ stats: await window.notch.stats(), saved: await window.notch.savedSearches(), hits: await window.notch.search({ query: 'orchestration' }) }));
  assert.equal(after.saved.length,1); assert.equal(after.stats.total, 2); assert.equal(after.stats.favorites, 1); assert.equal(after.hits[0].locator, 'C:\\Projects\\Claude');
  console.log('Desktop smoke passed: isolated IPC, actual SQLite capture/search, native notch, shortcut registration, editing, saved filters, archive/trash/restore, favorites, and restart persistence.');
} finally { await desktop?.close(); await rm(dataDir, { recursive: true, force: true }); }
