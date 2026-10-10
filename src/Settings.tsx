import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, BrainCircuit, Check, ChevronRight, KeyRound, LoaderCircle, LockKeyhole, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Terminal } from 'lucide-react';
import { api, isPreview } from './api';
import { CloseButton } from './components';
import { DEFAULT_SETTINGS, type Settings } from '../shared/types';

export function SettingsPanel({ onClose, toast }: { onClose: () => void; toast: (message: string) => void }) {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [key, setKey] = useState('');
  const [clearKey, setClearKey] = useState(false);
  const [tab, setTab] = useState<'ai' | 'capture' | 'data'>('ai');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { void api.settings().then(setSettings).catch(e => setError(e.message)); }, []);
  function update<K extends keyof Settings>(name: K, value: Settings[K]) { setSettings(s => ({ ...s, [name]: value })); setMessage(''); }
  async function save() {
    setBusy('save'); setError(''); setMessage('');
    try {
      const { hasApiKey, canStoreApiKey, ...values } = settings;
      setSettings(await api.saveSettings({ ...values, ...(key || clearKey ? { apiKey: clearKey ? '' : key } : {}) }));
      setKey(''); setClearKey(false); setMessage('Settings saved. New captures will use these preferences.'); toast('Settings saved');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save settings.'); }
    finally { setBusy(''); }
  }
  async function action(name: string, fn: () => Promise<unknown>) {
    setBusy(name); setError(''); setMessage('');
    try { const result = await fn(); if (result !== null) setMessage(name === 'test' ? String(result) : name === 'import' ? `Imported ${result} new items. Existing items were preserved.` : 'Backup exported. Keep it somewhere safe.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'The operation failed.'); }
    finally { setBusy(''); }
  }
  return <>
    <div className="modal-header"><div><div className="eyebrow">MAKE YOURSELF AT HOME</div><h2>Settings</h2></div><CloseButton onClick={onClose} /></div>
    <div className="settings-tabs" role="tablist" aria-label="Settings sections">{([{ id: 'ai', label: 'Intelligence', icon: BrainCircuit }, { id: 'capture', label: 'Capture', icon: SlidersHorizontal }, { id: 'data', label: 'Your data', icon: ShieldCheck }] as const).map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}><t.icon size={15} />{t.label}</button>)}</div>
    <div className="settings-body">
      {tab === 'ai' && <>
        <h3>A little context goes a long way.</h3><p className="settings-intro">AI adds titles, categories, and related search terms to what you save. Your original description always stays intact.</p>
        <div className="provider-options">{([{ id: 'none', title: 'Local only', note: 'Fast, private full-text search', icon: LockKeyhole }, { id: 'anthropic', title: 'Anthropic', note: 'Claude, via your own API key', icon: Sparkles }, { id: 'ollama', title: 'Ollama', note: 'A model running on your device', icon: Terminal }] as const).map(p => <button key={p.id} className={settings.provider === p.id ? 'selected' : ''} onClick={() => update('provider', p.id)}><p.icon size={19} /><strong>{p.title}</strong><span>{p.note}</span>{settings.provider === p.id && <Check className="provider-check" size={13} />}</button>)}</div>
        {settings.provider === 'anthropic' && <div className="settings-section">
          <label>Model ID<input value={settings.anthropicModel} onChange={e => update('anthropicModel', e.target.value)} placeholder="Your available Claude model ID" /></label>
          <label>API key <span className="inline-note">{settings.hasApiKey ? 'A key is connected' : 'Not connected'}</span><div className="key-field"><KeyRound size={16} /><input type="password" autoComplete="off" value={key} placeholder={settings.hasApiKey ? 'Leave blank to keep your saved key' : 'Paste your Anthropic API key'} onChange={e => { setKey(e.target.value); setClearKey(false); }} disabled={isPreview || !settings.canStoreApiKey} /></div></label>
          {!settings.canStoreApiKey && <p className="muted small-text">{isPreview ? 'Keys are configured in the desktop app.' : 'Secure storage is unavailable here. Set NOTCH_ANTHROPIC_API_KEY before launching the app.'}</p>}
          {settings.hasApiKey && <label className="checkbox-label"><input type="checkbox" checked={clearKey} onChange={e => { setClearKey(e.target.checked); if (e.target.checked) setKey(''); }} />Remove the stored key when saving</label>}
          <div className="info-note"><ShieldCheck size={17} /><span>Enabling Anthropic sends the link or path and your description to its API. API usage may incur charges. Keys are encrypted by Windows.</span></div>
        </div>}
        {(settings.provider === 'ollama' || settings.embeddings) && <div className="settings-section"><label>Ollama server<input value={settings.ollamaUrl} onChange={e => update('ollamaUrl', e.target.value)} /></label>{settings.provider === 'ollama' && <label>Chat model<input value={settings.ollamaModel} onChange={e => update('ollamaModel', e.target.value)} /><span className="field-hint">Install the model first: ollama pull {settings.ollamaModel}</span></label>}</div>}
        <div className="setting-row"><div><strong><BrainCircuit size={16} /> Semantic search</strong><p>Combine BM25 with local embeddings using rank fusion.</p></div><button role="switch" aria-checked={settings.embeddings} aria-label="Semantic search" className={`switch ${settings.embeddings ? 'on' : ''}`} onClick={() => update('embeddings', !settings.embeddings)}><span /></button></div>
        {settings.embeddings && <div className="settings-section"><label>Embedding model<input value={settings.embeddingModel} onChange={e => update('embeddingModel', e.target.value)} /><span className="field-hint">Install: ollama pull {settings.embeddingModel}. Re-index older items from their detail panel.</span></label></div>}
        <div className="settings-tip">Full-text search works even when AI is offline. <button className="text-button" disabled={Boolean(busy)} onClick={() => void action('test', api.testAI)}>{busy === 'test' ? <LoaderCircle size={14} className="spin" /> : <Settings2 size={14} />} Test saved connection <ChevronRight size={12} /></button></div>
      </>}
      {tab === 'capture' && <>
        <h3>One shortcut. One less thing to lose.</h3><p className="settings-intro">Capture a link or path without breaking your flow. Notch lives in your system tray, ready when you are.</p>
        <div className="shortcut-preview"><span className="shortcut-notch" /><div><kbd>Ctrl</kbd><span>+</span><kbd>{settings.shortcut.split('+').at(-1)}</kbd></div><span>Your space is a keystroke away.</span></div>
        <label className="settings-section">Global capture shortcut<input value={settings.shortcut} onChange={e => update('shortcut', e.target.value)} /><span className="field-hint">Examples: Control+I or Control+Shift+I. Save to register the shortcut.</span></label>
        <div className="setting-row"><div><strong>Start with Windows</strong><p>Launch quietly in the tray when you sign in.</p></div><button role="switch" aria-checked={settings.launchAtLogin} aria-label="Start with Windows" className={`switch ${settings.launchAtLogin ? 'on' : ''}`} onClick={() => update('launchAtLogin', !settings.launchAtLogin)}><span /></button></div>
        <div className="info-note"><LockKeyhole size={17} /><span>Closing the control panel keeps Notch in the tray. To exit completely, choose “Quit Notch” from its tray menu.</span></div>
      </>}
      {tab === 'data' && <>
        <h3>Your space belongs to you.</h3><p className="settings-intro">Everything is stored in a SQLite database on your computer. No account. No automatic sync.</p>
        <div className="data-card"><div className="data-icon"><ArrowDownToLine size={22} /></div><div><h4>Take your space with you</h4><p>Export links, paths, notes, tags, and favorites as JSON. API keys are never included.</p></div><button className="secondary-button" disabled={Boolean(busy)} onClick={() => void action('export', api.exportData)}>Export</button></div>
        <div className="data-card"><div className="data-icon"><ArrowUpFromLine size={22} /></div><div><h4>Bring it all back</h4><p>Import a Notch backup. Existing items are preserved, and duplicates are skipped.</p></div><button className="secondary-button" disabled={Boolean(busy)} onClick={() => void action('import', api.importData)}>Import</button></div>
        <div className="info-note"><ShieldCheck size={17} /><span>The collection itself is not encrypted. Backups include your paths and descriptions. Store backups somewhere you trust.</span></div>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message" role="status"><Check size={14} />{message}</p>}
    </div>
    <div className="modal-footer"><span><span className="status-dot" /> A space of your own</span><button className="primary-button" disabled={Boolean(busy)} onClick={() => void save()}>{busy === 'save' ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}Save preferences</button></div>
  </>;
}
