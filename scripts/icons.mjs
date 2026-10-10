// Dependency-free, repeatable generation of the app's own vector-like brand icon.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
function crc32(data) { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
function chunk(name, data) { const type = Buffer.from(name), size = Buffer.alloc(4), crc = Buffer.alloc(4); size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data]))); return Buffer.concat([size, type, data, crc]); }
function png(size, tray = false) {
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0, 0];
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
      const u = (x + (sx + .5) / 3) / size, v = (y + (sy + .5) / 3) / size;
      const cornerX = Math.max(.2 - u, 0, u - .8), cornerY = Math.max(.2 - v, 0, v - .8);
      const inside = cornerX ** 2 + cornerY ** 2 < .18 ** 2 && u > .02 && u < .98 && v > .02 && v < .98;
      const slant = u + .2 * (v - .5);
      const mark = (slant > .32 && slant < .43 && v > .28 && v < .72) || (slant > .55 && slant < .66 && v > .4 && v < .72);
      const rgba = mark ? [tray ? 225 : 201, tray ? 235 : 224, tray ? 229 : 209, 255] : inside && !tray ? [Math.round(69 - 28 * v), Math.round(73 - 28 * v), Math.round(78 - 26 * v), 255] : [0, 0, 0, 0];
      rgba.forEach((n, i) => { sum[i] += n / 9; });
    }
    const at = y * (size * 4 + 1) + x * 4 + 1; sum.forEach((n, i) => { rows[at + i] = Math.round(n); });
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
mkdirSync('assets', { recursive: true });
const icon = png(256); writeFileSync('assets/icon.png', icon); writeFileSync('assets/tray.png', png(32, true));
const icoHeader = Buffer.alloc(22); icoHeader.writeUInt16LE(1, 2); icoHeader.writeUInt16LE(1, 4); icoHeader.writeUInt16LE(1, 10); icoHeader.writeUInt16LE(32, 12); icoHeader.writeUInt32LE(icon.length, 14); icoHeader.writeUInt32LE(22, 18);
writeFileSync('assets/icon.ico', Buffer.concat([icoHeader, icon]));
console.log('Generated Notch application and tray icons.');
