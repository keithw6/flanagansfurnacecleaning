/* Bundles the app into one self-contained HTML file.
   Two outputs from the same source:
     dist/20-year-test.html   a normal standalone page, opens anywhere
     dist/artifact.html       the same page without the outer document
                              wrapper, for hosts that supply their own
   Run: node tools/20-year-test/build-single.mjs                        */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(here, f), 'utf8');
/* A literal </script> inside the JS would close the tag early. */
const safe = js => js.replace(/<\/script/gi, '<\\/script');

let html = read('index.html');

/* Inline the media library so the single file needs no request for it.
   The asset paths stay relative, so photographs and clips only appear
   when the media/ folder sits beside the bundle; without it the page
   falls back to the procedural background, which is by design. */
let manifestTag = '';
try {
  manifestTag = '<script>window.BCB_MEDIA_MANIFEST = ' +
    JSON.stringify(JSON.parse(read('media/manifest.json'))) + ';<\/script>\n';
} catch (e) {
  console.warn('no media manifest to inline:', e.message);
}
html = html.replace(
  /<link rel="stylesheet" href="css\/app\.css">/,
  '<style>\n' + read('css/app.css') + '\n</style>'
);
html = html.replace(/<script src="js\/media\.js"><\/script>/,
  manifestTag + '<script>\n' + safe(read('js/media.js')) + '\n</script>');
html = html.replace(/<script src="js\/([a-z]+)\.js"><\/script>/g,
  (_, name) => '<script>\n' + safe(read(`js/${name}.js`)) + '\n</script>');

mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist/20-year-test.html'), html);

/* The artifact host wraps content in its own document, so hand it the
   page body with the title and styles kept, and nothing else. */
const head = html.match(/<title>[\s\S]*?<\/style>/)[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync(join(here, 'dist/artifact.html'), head + '\n' + body.trim() + '\n');

console.log('built dist/20-year-test.html and dist/artifact.html');
