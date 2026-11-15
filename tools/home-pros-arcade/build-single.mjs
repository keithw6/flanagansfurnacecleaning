/* Bundles the game into one self-contained HTML file (dist/home-pros-arcade.html)
   for previewing, emailing, or dropping onto any web host as a single page.
   Run: node tools/home-pros-arcade/build-single.mjs                          */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(here, f), 'utf8');
const safe = js => js.replace(/<\/script/gi, '<\\/script');

let html = read('index.html');
html = html.replace('<link rel="stylesheet" href="css/arcade.css">', () => '<style>\n' + read('css/arcade.css') + '\n</style>');
html = html.replace(/<script src="js\/([a-z-]+)\.js"><\/script>/g, (_, name) => '<script>\n' + safe(read(`js/${name}.js`)) + '\n</script>');

mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist/home-pros-arcade.html'), html);
console.log('built dist/home-pros-arcade.html (' + Math.round(html.length / 1024) + ' KB)');
