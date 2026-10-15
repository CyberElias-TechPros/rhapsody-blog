#!/usr/bin/env node
/**
 * Regenerates every raster icon from the one vector mark (an open book on the warm gradient):
 *
 *   public/favicon.ico            16, 32 and 48 px (PNG-in-ICO, what browsers ask for first)
 *   public/icon-192.png           Android / PWA install icon
 *   public/icon-512.png           PWA splash + store-quality icon
 *   public/icon-maskable-512.png  full-bleed version that survives circle/squircle masks
 *   public/apple-touch-icon.png   180 px, full-bleed (iOS rounds the corners itself)
 *
 * Run after changing the mark: `npm run icons`. Outputs are committed — they are small, and a
 * build must not depend on an image toolchain. `sharp` ships with Next, so nothing extra to install.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (file) => path.join(root, 'public', file);

const GRADIENT = `
  <linearGradient id="warmth" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#d97706"/>
    <stop offset="0.55" stop-color="#b45309"/>
    <stop offset="1" stop-color="#92400e"/>
  </linearGradient>`;

const BOOK = `
  <path d="M13 19.5c6.4-3.2 12.6-3.2 18.2 0v27c-5.6-3.2-11.8-3.2-18.2 0z" fill="#fff8ec"/>
  <path d="M51 19.5c-6.4-3.2-12.6-3.2-18.2 0v27c5.6-3.2 11.8-3.2 18.2 0z" fill="#fff8ec" opacity="0.82"/>
  <rect x="31.2" y="20" width="1.6" height="26" rx="0.8" fill="#b45309" opacity="0.55"/>`;

/** Full-bleed square, the book scaled into the central 70% safe zone a mask never crops. */
const fullBleed = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRADIENT}</defs>
  <rect width="64" height="64" fill="url(#warmth)"/>
  <g transform="translate(32 33) scale(${scale}) translate(-32 -33)">${BOOK}</g>
</svg>`;

async function png(svg, size) {
  return sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
}

/** ICO container holding PNG images (supported by every browser since IE Vista-era). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

const mark = await readFile(out('icon.svg'), 'utf8');

const written = [];
const write = async (file, data) => {
  await writeFile(out(file), data);
  written.push(`${file} (${data.length.toLocaleString()} bytes)`);
};

await write('icon-192.png', await png(mark, 192));
await write('icon-512.png', await png(mark, 512));
await write('icon-maskable-512.png', await png(fullBleed(0.78), 512));
await write('apple-touch-icon.png', await png(fullBleed(0.86), 180));
await write(
  'favicon.ico',
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(mark, size) }))))
);

console.log(`Wrote:\n  ${written.join('\n  ')}`);
