import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let stopping = false;
function cleanup() { if (stopping) return; stopping = true; for (const child of children) child.kill(); }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { cleanup(); process.exit(0); });
process.on('exit', cleanup);
function run(command, args, env = process.env) {
  const child = spawn(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  children.push(child); child.on('error', error => { console.error(error.message); cleanup(); process.exit(1); }); return child;
}
async function compile() {
  const child = run(npm, ['exec', '--', 'tsc', '-p', 'tsconfig.electron.json']);
  const code = await new Promise(resolve => child.on('exit', resolve));
  if (code !== 0) process.exit(code || 1);
  const preload = run(process.execPath, ['scripts/preload.mjs']);
  const preloadCode = await new Promise(resolve => preload.on('exit', resolve));
  if (preloadCode !== 0) process.exit(preloadCode || 1);
}
await compile();
const vite = run(npm, ['run', 'dev:web']);
vite.on('exit', code => { if (!stopping) { cleanup(); process.exit(code || 1); } });
let ready = false;
for (let i = 0; i < 60; i++) {
  try { const res = await fetch('http://127.0.0.1:5173'); if (res.ok) { ready = true; break; } } catch {}
  await setTimeout(250);
}
if (!ready) { console.error('Vite did not start on port 5173.'); cleanup(); process.exit(1); }
const electron = run(npm, ['exec', '--', 'electron', '.'], { ...process.env, NOTCH_DEV_URL: 'http://127.0.0.1:5173' });
electron.on('exit', code => { cleanup(); process.exit(code || 0); });
