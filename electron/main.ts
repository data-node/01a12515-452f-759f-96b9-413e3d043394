import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, safeStorage, screen, shell, Tray } from 'electron';
import { mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SETTINGS, type Item, type SearchInput, type Settings, type SettingsUpdate } from '../shared/types.js';
import { validateOllamaUrl, enrichItem, embed } from './ai.js';
import { Store } from './store.js';
import { LibraryService } from './service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (process.env.NOTCH_DATA_DIR) app.setPath('userData', path.resolve(process.env.NOTCH_DATA_DIR));
let library: BrowserWindow;
let capture: BrowserWindow;
let tray: Tray;
let store: Store;
let service: LibraryService;
let quitting = false;
let currentShortcut = '';
let settings: Settings = { ...DEFAULT_SETTINGS };
const devUrl = process.env.NOTCH_DEV_URL;
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => showCapture());
  void app.whenReady().then(initialize).catch(error => { dialog.showErrorBox('Notch could not start', error instanceof Error ? error.message : String(error)); app.quit(); });
}

function canStoreKey() {
  return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text');
}
function apiKey(): string | undefined {
  if (process.env.NOTCH_ANTHROPIC_API_KEY) return process.env.NOTCH_ANTHROPIC_API_KEY;
  const encrypted = store.preference('anthropic-key');
  if (!encrypted || !canStoreKey()) return undefined;
  try { return safeStorage.decryptString(Buffer.from(encrypted, 'base64')); } catch { return undefined; }
}
function publicSettings(): Settings { return { ...settings, hasApiKey: Boolean(apiKey()), canStoreApiKey: canStoreKey() }; }
function changed() { for (const window of [library, capture]) if (window && !window.isDestroyed()) window.webContents.send('changed'); }

async function initialize() {
  mkdirSync(app.getPath('userData'), { recursive: true });
  store = new Store(path.join(app.getPath('userData'), 'notch.sqlite'));
  const saved = store.preference('settings');
  if (saved) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved), hasApiKey: false, canStoreApiKey: false };
  service = new LibraryService(store, publicSettings, apiKey, changed);
  Menu.setApplicationMenu(null);
  library = createWindow(false);
  capture = createWindow(true);
  library.on('close', event => { if (!quitting) { event.preventDefault(); library.hide(); } });
  capture.on('close', event => { if (!quitting) { event.preventDefault(); capture.hide(); } });
  createTray();
  registerHandlers();
  try { changeShortcut(settings.shortcut); }
  catch { void dialog.showMessageBox(library, { type: 'warning', message: 'Your capture shortcut is already in use.', detail: 'Open Notch from the tray and choose another shortcut in Settings.' }); }
  library.once('ready-to-show', () => { if (!process.argv.includes('--tray')) library.show(); });
  app.on('activate', showLibrary);
}

function createWindow(notch: boolean) {
  const window = new BrowserWindow({
    width: notch ? 570 : 1200, height: notch ? 350 : 800,
    minWidth: notch ? 570 : 900, minHeight: notch ? 350 : 620,
    show: false, frame: false, transparent: notch, backgroundColor: notch ? '#00000000' : '#17181b',
    resizable: !notch, maximizable: !notch, alwaysOnTop: notch, skipTaskbar: notch,
    title: 'Notch', icon: path.join(root, 'assets/icon.png'),
    webPreferences: { preload: path.join(root, 'dist-electron/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !app.isPackaged },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  if (devUrl) {
    const url = new URL(devUrl);
    if (url.origin !== 'http://127.0.0.1:5173') throw new Error('Unsupported development server.');
    if (notch) url.searchParams.set('window', 'capture');
    void window.loadURL(url.href);
  } else void window.loadFile(path.join(root, 'dist/index.html'), { query: notch ? { window: 'capture' } : {} });
  return window;
}
function showCapture() {
  if (!capture || capture.isDestroyed()) return;
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  capture.setPosition(Math.round(workArea.x + (workArea.width - 570) / 2), workArea.y + 10);
  capture.show(); capture.focus(); capture.webContents.send('capture-opened');
}
function showLibrary() { if (library) { library.show(); if (library.isMinimized()) library.restore(); library.focus(); } }
function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(root, 'assets/tray.png')));
  tray.setToolTip('Notch · save a thought, find it later');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Capture something', click: showCapture },
    { label: 'Open your space', click: showLibrary },
    { type: 'separator' },
    { label: 'Quit Notch', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', showCapture);
  tray.on('double-click', showLibrary);
}
function changeShortcut(shortcut: string) {
  if (shortcut === currentShortcut) return;
  if (!/^(?:(?:Control|Ctrl|Alt|Shift|Super|CommandOrControl)\+){1,3}[A-Za-z0-9]$/.test(shortcut)) throw new Error('Use a shortcut such as Control+I or Control+Shift+I.');
  if (!globalShortcut.register(shortcut, showCapture)) throw new Error('That shortcut is already in use. Choose another combination.');
  if (currentShortcut) globalShortcut.unregister(currentShortcut);
  currentShortcut = shortcut;
}
function requireItem(id: unknown): Item {
  if (typeof id !== 'string') throw new Error('Invalid item.');
  const item = store.get(id);
  if (!item) throw new Error('This item has been removed.');
  return item;
}
function registerHandlers() {
  // Only our isolated, top-level app windows may use the desktop bridge.
  const handle = (channel: string, handler: (...args: any[]) => unknown) => ipcMain.handle(channel, (event, ...args) => {
    if (![library.webContents, capture.webContents].includes(event.sender) || event.senderFrame !== event.sender.mainFrame) throw new Error('Untrusted request.');
    return handler(...args);
  });
  handle('search', (input: SearchInput) => {
    if (!input || typeof input.query !== 'string' || ![undefined, 'all', 'favorites', 'link', 'folder', 'file'].includes(input.filter) || ![undefined, 'relevance', 'newest', 'oldest'].includes(input.sort) || (input.tag !== undefined && typeof input.tag !== 'string')) throw new Error('Invalid search.');
    return service.search(input);
  });
  handle('capture', input => service.capture(input));
  handle('stats', () => store.stats());
  handle('settings', publicSettings);
  handle('save-settings', (input: SettingsUpdate) => {
    if (!input || typeof input !== 'object') throw new Error('Invalid settings.');
    const next = { ...settings };
    if (input.provider !== undefined) { if (!['none', 'anthropic', 'ollama'].includes(input.provider)) throw new Error('Invalid provider.'); next.provider = input.provider; }
    for (const key of ['anthropicModel', 'ollamaModel', 'embeddingModel', 'shortcut'] as const) if (input[key] !== undefined) {
      if (typeof input[key] !== 'string' || !input[key]!.trim() || input[key]!.length > 150) throw new Error(`Invalid ${key}.`);
      next[key] = input[key]!.trim();
    }
    if (input.ollamaUrl !== undefined) next.ollamaUrl = validateOllamaUrl(input.ollamaUrl);
    for (const key of ['embeddings', 'launchAtLogin'] as const) if (input[key] !== undefined) { if (typeof input[key] !== 'boolean') throw new Error('Invalid setting.'); next[key] = input[key]!; }
    if (input.apiKey !== undefined && (typeof input.apiKey !== 'string' || input.apiKey.length > 2000)) throw new Error('Invalid API key.');
    if (input.apiKey?.trim() && !canStoreKey()) throw new Error('Secure key storage is unavailable. Set NOTCH_ANTHROPIC_API_KEY in your environment instead.');
    if (process.platform === 'win32' && next.launchAtLogin && !app.isPackaged) throw new Error('Start with Windows is available in the packaged app. Build or install Notch first.');
    changeShortcut(next.shortcut);
    if (process.platform === 'win32' && app.isPackaged) app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, path: process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe'), args: ['--tray'] });
    if (input.apiKey !== undefined) store.setPreference('anthropic-key', input.apiKey.trim() ? safeStorage.encryptString(input.apiKey.trim()).toString('base64') : '');
    settings = next;
    store.setPreference('settings', JSON.stringify({ ...next, hasApiKey: false, canStoreApiKey: false }));
    changed();
    return publicSettings();
  });
  handle('test-ai', async () => {
    if (settings.provider === 'none' && !settings.embeddings) return 'Local search is ready. No AI provider is enabled.';
    if (settings.provider !== 'none') await enrichItem({ title: 'Connection test', locator: 'https://example.com', description: 'A sample website for a connection test.', tags: [] } as unknown as Item, publicSettings(), apiKey());
    if (settings.embeddings) await embed('A connection test', settings);
    return 'Connected. Your selected models are responding.';
  });
  handle('retry', id => { requireItem(id); service.retry(id); });
  handle('favorite', id => { requireItem(id); store.favorite(id); changed(); });
  handle('remove', id => { requireItem(id); service.remove(id); });
  handle('copy', text => { if (typeof text !== 'string' || text.length > 20000) throw new Error('Invalid clipboard content.'); clipboard.writeText(text); });
  handle('open', async id => {
    const item = requireItem(id);
    if (item.kind === 'link') {
      const url = new URL(item.locator);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('This link cannot be opened.');
      await shell.openExternal(url.href);
    } else {
      let stats;
      try { stats = statSync(item.locator); } catch { throw new Error('This path does not exist on this computer. You can still copy it.'); }
      if (stats.isDirectory()) { const error = await shell.openPath(item.locator); if (error) throw new Error(error); }
      else shell.showItemInFolder(item.locator);
    }
  });
  handle('export', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(library, { defaultPath: `notch-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'Notch backup', extensions: ['json'] }] });
    if (canceled || !filePath) return null;
    writeFileSync(filePath, JSON.stringify(store.exportData(), null, 2), { mode: 0o600 });
    return filePath;
  });
  handle('import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(library, { properties: ['openFile'], filters: [{ name: 'Notch backup', extensions: ['json'] }] });
    if (canceled || !filePaths[0]) return null;
    if (statSync(filePaths[0]).size > 25 * 1024 * 1024) throw new Error('Choose a backup smaller than 25 MB.');
    const count = store.importData(JSON.parse(readFileSync(filePaths[0], 'utf8')));
    changed(); return count;
  });
  handle('show-capture', showCapture);
  handle('show-library', () => { capture.hide(); showLibrary(); });
  handle('hide', () => { capture.hide(); });
  handle('minimize', () => library.minimize());
  handle('hide-library', () => library.hide());
}
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* The tray owns the application's lifetime. */ });
app.on('will-quit', () => { globalShortcut.unregisterAll(); tray?.destroy(); });
