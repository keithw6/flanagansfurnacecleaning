/* Bundles the app into one self-contained HTML file that works offline
   from anywhere: a USB stick, a phone's files app, an email attachment.
   Run: node tools/prep-planner/build-single.mjs                        */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(here, f), 'utf8');
const safe = js => js.replace(/<\/script/gi, '<\\/script');

let html = read('index.html');
html = html.replace(/<link rel="manifest"[^>]*>\n/, '');
html = html.replace(/<link rel="icon"[^>]*>/,
  '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(read('icon.svg').trim()) + '">');
html = html.replace(/<link rel="stylesheet" href="css\/app\.css">/, () => '<style>\n' + read('css/app.css') + '\n</style>');
html = html.replace('<script src="js/scenarios.js"></script>', '<script>window.PP_SINGLE = true;</script>\n<script src="js/scenarios.js"></script>');
html = html.replace(/<script src="js\/([a-z-]+)\.js"><\/script>/g, (_, name) => '<script>\n' + safe(read(`js/${name}.js`)) + '\n</script>');

mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist/prep-planner.html'), html);
console.log('built dist/prep-planner.html (' + Math.round(html.length / 1024) + ' KB)');
