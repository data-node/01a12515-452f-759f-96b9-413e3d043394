import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowUpRight, FileText, Folder, Link2, X } from 'lucide-react';
import type { Kind } from '../shared/types';

export function Brand({ small = false }: { small?: boolean }) {
  return <span className={`brand-mark ${small ? 'small' : ''}`} aria-hidden="true"><span /><span /></span>;
}
export function KindIcon({ kind, size = 20 }: { kind: Kind; size?: number }) { return kind === 'folder' ? <Folder size={size} /> : kind === 'file' ? <FileText size={size} /> : <Link2 size={size} />; }
export function Modal({ children, onClose, label, className = '' }: { children: ReactNode; onClose: () => void; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current;
    const focusable = () => Array.from(element?.querySelectorAll<HTMLElement>('button, input, textarea, select, [tabindex="0"]') ?? []).filter(el => !el.hasAttribute('disabled'));
    (focusable()[0] ?? element)?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const elements = focusable(); const first = elements[0], last = elements.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    element?.addEventListener('keydown', handler);
    return () => { element?.removeEventListener('keydown', handler); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>{children}</div></div>;
}
export function CloseButton({ onClick }: { onClick: () => void }) { return <button className="icon-button" onClick={onClick} aria-label="Close"><X size={18} /></button>; }
export function ExternalGlyph() { return <ArrowUpRight size={15} />; }
export function niceDate(date: string) { const value = new Date(date); const today = new Date(); if (value.toDateString() === today.toDateString()) return 'Today'; const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); return value.toDateString() === yesterday.toDateString() ? 'Yesterday' : value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
