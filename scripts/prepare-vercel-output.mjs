import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'vercel-dist');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const publicFiles = [
  'index.html',
  'about.html',
  'technology.html',
  'command.html',
  'responsive.css',
  'site-chitti.js',
  'pic1.png',
  'pic2.png',
  'pic3.png',
];

for (const file of publicFiles) {
  await cp(path.join(root, file), path.join(output, file));
}

await cp(
  path.join(root, 'roadguard-webapp', 'shield-logo.svg'),
  path.join(output, 'shield-logo.svg'),
);

const adminDirectory = path.join(output, 'admin');
await mkdir(adminDirectory, { recursive: true });
await cp(
  path.join(root, 'roadguard-admin', 'sigin and signup', 'signin.html'),
  path.join(adminDirectory, 'signin.html'),
);
await cp(
  path.join(root, 'roadguard-admin', 'sigin and signup', 'signup.html'),
  path.join(adminDirectory, 'signup.html'),
);

await cp(
  path.join(root, 'roadguard-admin', 'dashboard', 'dist'),
  path.join(adminDirectory, 'ui'),
  { recursive: true },
);

console.log('Prepared Vercel static output in vercel-dist/');
