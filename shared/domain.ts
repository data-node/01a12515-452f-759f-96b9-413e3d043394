import path from 'node:path';
import type { CaptureInput, Kind } from './types.js';

export function normalizeCapture(input: CaptureInput) {
  if (!input || typeof input.locator !== 'string' || typeof input.description !== 'string') throw new Error('Add a link or path and a description.');
  const raw = input.locator.trim().replace(/^"(.*)"$/, '$1');
  const description = input.description.trim();
  if (!raw || raw.length > 4096) throw new Error('Enter a link or path under 4,096 characters.');
  if (!description || description.length > 8000) throw new Error('Add a description under 8,000 characters so you can find this later.');
  let locator: string;
  let kind: Kind;
  let title: string;
  let canonical: string;
  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    if (url.username || url.password) throw new Error('Links with embedded credentials cannot be saved.');
    locator = url.href;
    kind = 'link';
    title = url.hostname.replace(/^www\./, '') + (url.pathname !== '/' ? decodeURIComponentSafe(url.pathname).replace(/\/$/, '') : '');
    canonical = locator;
  } else if (/^(?:[a-z]:[\\/]|\\\\[^\\]+\\[^\\]+|\/)/i.test(raw)) {
    const windows = /^[a-z]:|^\\\\/i.test(raw);
    locator = windows ? path.win32.normalize(raw) : path.posix.normalize(raw);
    title = (windows ? path.win32.basename(locator) : path.posix.basename(locator)) || locator;
    kind = /\.[a-z0-9]{1,10}$/i.test(title) ? 'file' : 'folder';
    canonical = windows ? locator.toLowerCase().replace(/[\\/]+$/, '') : locator.replace(/\/$/, '') || '/';
  } else {
    throw new Error('Use a full https:// link or an absolute folder or file path, such as C:\\Projects\\Claude.');
  }
  if (input.kind !== undefined) {
    if (!['link', 'file', 'folder'].includes(input.kind) || (kind === 'link') !== (input.kind === 'link')) throw new Error('Choose a kind that matches the link or path.');
    kind = input.kind;
  }
  const tags = cleanWords(input.tags ?? []);
  return { locator, description, kind, title: title.slice(0, 180), canonical, tags };
}

function decodeURIComponentSafe(value: string) { try { return decodeURIComponent(value); } catch { return value; } }
export function cleanWords(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === 'string').map(x => x.trim().slice(0, 60)).filter(Boolean))].slice(0, 16) : [];
}
export function ftsQuery(query: string): string {
  return [...new Set(query.match(/[\p{L}\p{N}_]+/gu) ?? [])].slice(0, 24).map(word => `"${word}"*`).join(' OR ');
}
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
