import sharp from 'sharp';
import fs from 'node:fs';

const mark = (size, pad = 0) => {
  const s = size - pad * 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="#1E1713"/>
    <g transform="translate(${pad} ${pad})">
      <circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.3}" fill="none" stroke="#F4EAD8" stroke-width="${Math.max(2, s * 0.025)}"/>
      <circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.12}" fill="none" stroke="#F4EAD8" stroke-width="${Math.max(2, s * 0.02)}"/>
      <circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.045}" fill="#E39A3B"/>
    </g>
  </svg>`);
};

fs.mkdirSync('public', { recursive: true });
await sharp(mark(32)).png().toFile('public/favicon.png');
await sharp(mark(180)).png().toFile('public/apple-touch-icon.png');
await sharp(mark(192)).png().toFile('public/icon-192.png');
await sharp(mark(512)).png().toFile('public/icon-512.png');
await sharp(mark(512, 64)).png().toFile('public/icon-maskable-512.png');
console.log('icons written');
