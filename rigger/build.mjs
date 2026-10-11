// Bundles src/main.js (with three.js) into one self-contained index.html that works offline.
// Usage: npm install && npm run build
import { build } from 'esbuild';
import fs from 'node:fs';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2018',          // old and low-end browsers
  legalComments: 'none',
  write: false,
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync('src/template.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
fs.writeFileSync('index.html', html);
console.log(`index.html written: ${(html.length / 1024).toFixed(0)} KB`);
