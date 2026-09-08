/* Bundles the app into one self-contained HTML file.
   Two outputs from the same source:
     dist/edc-builder.html    a normal standalone page, opens anywhere
     dist/artifact.html       the same page without the outer document
                              wrapper, for hosts that supply their own
   Run: node tools/edc-builder/build-single.mjs                        */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(here, f), 'utf8');
/* A literal </script> inside the JS would close the tag early. */
const safe = js => js.replace(/<\/script/gi, '<\\/script');

let html = read('index.html');

html = html.replace(
  /<link rel="stylesheet" href="css\/app\.css">/,
  '<style>\n' + read('css/app.css') + '\n</style>'
);

/* The media library is optional and normally empty. It is inlined
   anyway, because a bundle that silently lost someone's overrides
   would be a nasty surprise. Any path in it stays relative to media/,
   so local images only resolve when that folder sits beside the
   bundle; without it the drawings are used, which is the default and
   not a broken page. */
html = html.replace(/<script src="media\/manifest\.js"><\/script>/,
  '<script>\n' + safe(read('media/manifest.js')) + '\n</script>');

html = html.replace(/<script src="js\/([a-z]+)\.js"><\/script>/g,
  (_, name) => '<script>\n' + safe(read(`js/${name}.js`)) + '\n</script>');

if (/<script src=|<link rel="stylesheet"/.test(html)) {
  console.error('something did not get inlined:',
    html.match(/<script src=[^>]*>|<link rel="stylesheet"[^>]*>/g));
  process.exit(1);
}

mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist/edc-builder.html'), html);

/* The artifact host wraps content in its own document, so hand it the
   page body with the title and styles kept, and nothing else. */
const head = html.match(/<title>[\s\S]*?<\/style>/)[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync(join(here, 'dist/artifact.html'), head + '\n' + body.trim() + '\n');

const kb = f => Math.round(readFileSync(join(here, f)).length / 1024) + ' kB';
console.log('built dist/edc-builder.html (' + kb('dist/edc-builder.html') + ')' +
  ' and dist/artifact.html (' + kb('dist/artifact.html') + ')');
