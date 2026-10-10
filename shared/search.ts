import type { Item, SearchInput } from './types.js';

// Only known operators are consumed. Unknown syntax remains ordinary search text.
export function parseSearch(input: SearchInput) {
  const tags: string[] = input.tag ? [input.tag] : [];
  let kind: Item['kind'] | undefined = ['link', 'file', 'folder'].includes(input.filter ?? '') ? input.filter as Item['kind'] : undefined;
  let favorite = input.filter === 'favorites';
  let status: Item['status'] | undefined;
  const query = input.query.trim().slice(0, 2000).replace(/\b(type|tag|is|status):(?:"([^"]+)"|([^\s]+))/gi, (whole, operator: string, quoted: string, bare: string) => {
    const value = quoted ?? bare;
    const lower = value.toLowerCase();
    switch (operator.toLowerCase()) {
      case 'tag': tags.push(value); return '';
      case 'type': if (['link', 'folder', 'file'].includes(lower)) { kind = lower as Item['kind']; return ''; } break;
      case 'is': if (lower === 'favorite') { favorite = true; return ''; } break;
      case 'status': if (['local', 'ready', 'indexing', 'error'].includes(lower)) { status = lower as Item['status']; return ''; } break;
    }
    return whole;
  }).trim();
  const eligible = (item: Item) => {
    const scope = input.scope ?? 'active';
    const inScope = scope === 'trash' ? Boolean(item.deletedAt) : scope === 'archived' ? Boolean(item.archivedAt) && !item.deletedAt : !item.archivedAt && !item.deletedAt;
    return inScope && (!kind || item.kind === kind) && (!favorite || item.favorite) && tags.every(tag => item.tags.some(t => t.toLowerCase() === tag.toLowerCase())) && (!status || item.status === status);
  };
  return { query, eligible };
}

export function validateSearch(input: SearchInput): SearchInput {
  if (!input || typeof input.query !== 'string' || input.query.length > 2000 || ![undefined, 'active', 'archived', 'trash'].includes(input.scope) || ![undefined, 'all', 'favorites', 'link', 'folder', 'file'].includes(input.filter) || ![undefined, 'relevance', 'newest', 'oldest'].includes(input.sort) || (input.tag !== undefined && (typeof input.tag !== 'string' || input.tag.length > 60))) throw new Error('Invalid search.');
  return { query: input.query, ...(input.scope !== undefined ? {scope: input.scope} : {}), ...(input.filter !== undefined ? {filter: input.filter} : {}), ...(input.tag !== undefined ? {tag: input.tag} : {}), ...(input.sort !== undefined ? {sort: input.sort} : {}) };
}
