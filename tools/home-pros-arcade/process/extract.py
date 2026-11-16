"""Pull the "Our Process" section (styles, animated diagram, script) out of a saved
copy of https://homeprosgroup.com/index.html and write:
  js/process.js            the arcade's copy, injected when someone opens it
  process/our-process.html a standalone page with just that section

  curl -sSL -o /tmp/hp.html https://homeprosgroup.com/index.html
  python3 tools/home-pros-arcade/process/extract.py /tmp/hp.html
"""
import json, re, sys
from pathlib import Path

src = Path(sys.argv[1]).read_text(encoding='utf-8')
here = Path(__file__).resolve().parent
root = here.parent

# styles: the <style> block that starts with the OUR PROCESS SECTION comment
m = re.search(r'<style>\s*/\* =+ OUR PROCESS SECTION =+ \*/(.*?)</style>', src, re.S)
css = '/* ============ OUR PROCESS SECTION ============ */' + m.group(1)
# markup: the section itself
a = src.index('<section id="our-process"')
b = src.index('</section>', a) + len('</section>')
section = src[a:b]
# script: the first <script> after the section
s = src.index('<script>', b) + len('<script>')
e = src.index('</script>', s)
script = src[s:e].strip()
assert 'opScene' in script and 'op-step' in section and '#our-process' in css

js = """/* "How we clean your ducts": the Our Process section from homeprosgroup.com,
   made by process/extract.py. HP_PROCESS.mount(el) puts it in el the first time
   it is opened; the website's own script then runs it (play/pause, tap a step). */
(function (root) {
  'use strict';
  const CSS = %s;
  const HTML = %s;
  let mounted = false;
  root.HP_PROCESS = {
    mount(el) {
      if (mounted) return;
      mounted = true;
      const st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);
      el.innerHTML = HTML;
      // the website's script, unchanged
      %s
    },
  };
})(window);
""" % (json.dumps(css), json.dumps(section), script.replace('\n', '\n      '))
(root / 'js' / 'process.js').write_text(js, encoding='utf-8')

page = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>How we clean your ducts</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Sora:wght@400;600&display=swap" rel="stylesheet">
<style>body{margin:0;background:#0c0e0d}%s</style>
</head>
<body>
%s
<script>
%s
</script>
</body>
</html>
""" % (css, section, script)
(here / 'our-process.html').write_text(page, encoding='utf-8')
print('css', len(css), 'html', len(section), 'script', len(script))
