import { contextBridge, ipcRenderer } from 'electron';
import type { NotchAPI } from '../shared/types.js';

const subscribe = (channel: string, callback: () => void) => {
  const handler = () => callback();
  ipcRenderer.on(channel, handler);
  return () => { ipcRenderer.removeListener(channel, handler); };
};
const api: NotchAPI = {
  search: input => ipcRenderer.invoke('search', input),
  capture: input => ipcRenderer.invoke('capture', input),
  stats: () => ipcRenderer.invoke('stats'),
  favorite: id => ipcRenderer.invoke('favorite', id),
  edit: (id, input) => ipcRenderer.invoke('edit', id, input),
  archive: id => ipcRenderer.invoke('archive', id),
  restore: id => ipcRenderer.invoke('restore', id),
  related: id => ipcRenderer.invoke('related', id),
  savedSearches: () => ipcRenderer.invoke('saved-searches'),
  saveSearch: (name, input) => ipcRenderer.invoke('save-search', name, input),
  deleteSearch: id => ipcRenderer.invoke('delete-search', id),
  retryFailed: () => ipcRenderer.invoke('retry-failed'),
  remove: id => ipcRenderer.invoke('remove', id),
  open: id => ipcRenderer.invoke('open', id),
  copy: text => ipcRenderer.invoke('copy', text),
  settings: () => ipcRenderer.invoke('settings'),
  saveSettings: settings => ipcRenderer.invoke('save-settings', settings),
  testAI: () => ipcRenderer.invoke('test-ai'),
  retry: id => ipcRenderer.invoke('retry', id),
  exportData: () => ipcRenderer.invoke('export'),
  importData: () => ipcRenderer.invoke('import'),
  showCapture: () => ipcRenderer.invoke('show-capture'),
  showLibrary: () => ipcRenderer.invoke('show-library'),
  hide: () => ipcRenderer.invoke('hide'),
  hideLibrary: () => ipcRenderer.invoke('hide-library'),
  minimize: () => ipcRenderer.invoke('minimize'),
  onChanged: callback => subscribe('changed', callback),
  onCaptureOpened: callback => subscribe('capture-opened', callback),
};
contextBridge.exposeInMainWorld('notch', api);
