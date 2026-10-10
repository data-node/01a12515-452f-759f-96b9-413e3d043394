import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Command, CornerDownLeft, Hash, Link2, LoaderCircle, X } from 'lucide-react';
import { api } from './api';
import { Brand } from './components';
import type { Item } from '../shared/types';

export function Capture({ standalone = false, onClose }: { standalone?: boolean; onClose?: () => void }) {
  const [locator, setLocator] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Item | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const close = useCallback(() => { if (standalone) void api.hide(); else onClose?.(); }, [standalone, onClose]);
  const reset = useCallback(() => { setLocator(''); setDescription(''); setTags(''); setSaved(null); setError(''); requestAnimationFrame(() => input.current?.focus()); }, []);
  useEffect(() => { input.current?.focus(); return api.onCaptureOpened(reset); }, [reset]);
  useEffect(() => api.onChanged(() => { if (saved) void api.search({ query: '' }).then(items => { const item = items.find(i => i.id === saved.id); if (item) setSaved(item); }); }), [saved?.id]);
  useEffect(() => { if (!standalone) return; const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, [close, standalone]);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (saving || saved) return;
    setSaving(true); setError('');
    try { const result = await api.capture({ locator, description, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }); setSaved(result.item); setDuplicate(result.duplicate); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Try again.'); }
    finally { setSaving(false); }
  }
  return <div className={`capture-shell ${standalone ? 'standalone' : ''}`}>
    <div className="capture-header"><div className="capture-brand"><Brand small /><span>notch</span><span className="capture-divider" /><span className="muted">a thought, kept.</span></div><button className="icon-button" aria-label="Close capture" onClick={close}><X size={16} /></button></div>
    {saved ? <div className="capture-success" role="status"><div className="success-orbit"><Check size={28} /></div><h2>{duplicate ? 'Already here. Now updated.' : 'A little less to remember.'}</h2><p>{saved.status === 'indexing' ? 'Saved to your space. AI is adding search context…' : saved.status === 'error' ? 'Saved locally. AI needs attention in your space.' : 'Saved to your space. Ready whenever you need it.'}</p><div className="success-actions"><button className="text-button" onClick={reset}>Save another <ArrowDownLeft size={15} /></button><button className="primary-button" onClick={close}>Done <Check size={15} /></button></div></div> : <form onSubmit={submit}>
      <label className="capture-input-wrap"><Link2 size={18} /><input ref={input} aria-label="Link or folder path" placeholder="Paste a link or folder path…" value={locator} onChange={e => setLocator(e.target.value)} maxLength={4096} required spellCheck={false} disabled={saving} /></label>
      <textarea aria-label="Description" placeholder="What is it? How would you look for it later?" value={description} onChange={e => setDescription(e.target.value)} maxLength={8000} required disabled={saving} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); } }} />
      <label className="capture-tags"><Hash size={12} /><input aria-label="Tags (optional)" placeholder="Tags, separated by commas (optional)" value={tags} onChange={e => setTags(e.target.value)} maxLength={1000} disabled={saving} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="capture-footer"><span><Command size={12} /> <kbd>Ctrl</kbd> <kbd>↵</kbd> to save</span><button type="submit" className="primary-button" disabled={saving || !locator.trim() || !description.trim()}>{saving ? <><LoaderCircle className="spin" size={15} /> Saving</> : <>Keep it <CornerDownLeft size={15} /></>}</button></div>
    </form>}
    <div className="capture-bottom"><span><span className="status-dot" /> Stored on your device</span><button onClick={() => { if (standalone) void api.showLibrary(); else onClose?.(); }}>Your space <ArrowUpRight size={12} /></button></div>
  </div>;
}
