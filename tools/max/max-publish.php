<?php
/* Home Pros Group: Max's publisher.
   Upload this one file to public_html (next to index.html). It lets Max, Home Pros Group's
   marketing assistant, ADD blog articles and their images to homeprosgroup.com, and update
   blog.html and sitemap.xml (with a backup first). It cannot delete anything, cannot write
   PHP or any other kind of file, and cannot touch any other page.

   Security: every request must carry the header  X-Max-Key: <secret>.
   The first request within 3 days of uploading this file sets the secret (only its hash is
   kept, in .max-publish/key). After that, only that secret works. To reset: delete the
   .max-publish folder in File Manager and upload this file again.                        */

header('Content-Type: application/json');
header('X-Robots-Tag: noindex');
$DIR = __DIR__;
$STATE = $DIR . '/.max-publish';
$MAX_BYTES = 6 * 1024 * 1024;

function out($code, $data) { http_response_code($code); echo json_encode($data); exit; }

if (!is_dir($STATE)) { @mkdir($STATE, 0750, true); @file_put_contents($STATE . '/.htaccess', "Require all denied\nDeny from all\n"); }
if (!is_dir($STATE)) out(500, ['error' => 'cannot create .max-publish folder']);

$key = $_SERVER['HTTP_X_MAX_KEY'] ?? '';
if (strlen($key) < 16) out(401, ['error' => 'missing or short key']);
$keyFile = $STATE . '/key';
if (!file_exists($keyFile)) {
  if (time() - filemtime(__FILE__) > 3 * 86400) out(403, ['error' => 'setup window closed: upload the file again to set the key']);
  file_put_contents($keyFile, password_hash($key, PASSWORD_DEFAULT));
  out(200, ['ok' => true, 'setup' => 'key saved']);
}
if (!password_verify($key, trim(file_get_contents($keyFile)))) { usleep(800000); out(403, ['error' => 'wrong key']); }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['error' => 'POST only']);
$raw = file_get_contents('php://input');
if (strlen($raw) > $MAX_BYTES * 1.4) out(413, ['error' => 'too big']);
$req = json_decode($raw, true);
if (!is_array($req)) out(400, ['error' => 'bad JSON']);
$op = $req['op'] ?? '';

$ARTICLE = '#^(blog/[a-z0-9][a-z0-9-]{1,90}|blog-[a-z0-9][a-z0-9-]{2,90})\.html$#';   // new pages only: blog-<slug>.html like the site's own articles
$IMAGE = '#^img/blog/[a-z0-9][a-z0-9-]{1,90}\.(jpg|jpeg|png|webp)$#';
$SHARED = ['blog.html', 'sitemap.xml'];
$READABLE = '#^[a-z0-9][a-z0-9-]{0,90}\.(html|xml|txt)$|^css/[a-z0-9-]+\.css$|^blog/[a-z0-9-]+\.html$|^img/blog/[a-z0-9-]+\.(jpg|jpeg|png|webp)$#';
$ledgerFile = $STATE . '/ledger.json';
$ledger = file_exists($ledgerFile) ? (json_decode(file_get_contents($ledgerFile), true) ?: []) : [];
function log_it($line) { global $STATE; file_put_contents($STATE . '/log.txt', gmdate('c') . ' ' . $line . "\n", FILE_APPEND); }

if ($op === 'list') {
  $files = [];
  foreach (['blog', 'img/blog'] as $d) foreach (glob($DIR . '/' . $d . '/*') ?: [] as $f) $files[] = substr($f, strlen($DIR) + 1);
  foreach (glob($DIR . '/blog-*.html') ?: [] as $f) $files[] = substr($f, strlen($DIR) + 1);
  out(200, ['ok' => true, 'files' => $files, 'mine' => array_keys($ledger)]);
}

if ($op === 'get') {
  $p = $req['path'] ?? '';
  if (!preg_match($READABLE, $p) || !is_file($DIR . '/' . $p)) out(404, ['error' => 'not found or not readable']);
  out(200, ['ok' => true, 'path' => $p, 'content' => file_get_contents($DIR . '/' . $p)]);
}

if ($op === 'put') {
  $p = $req['path'] ?? '';
  $isShared = in_array($p, $SHARED, true);
  if (!$isShared && !preg_match($ARTICLE, $p) && !preg_match($IMAGE, $p)) out(400, ['error' => 'path not allowed']);
  $data = isset($req['base64']) ? base64_decode($req['base64'], true) : ($req['content'] ?? null);
  if ($data === false || $data === null || $data === '') out(400, ['error' => 'no content']);
  if (strlen($data) > $MAX_BYTES) out(413, ['error' => 'file too big']);
  if (preg_match($IMAGE, $p) && @getimagesizefromstring($data) === false) out(400, ['error' => 'not an image']);
  if (preg_match('/<\?php|<\?=|<script[^>]+src=["\']?(?!https?:\/\/(www\.)?(homeprosgroup\.com|fonts\.googleapis\.com|www\.googletagmanager\.com))/i', $data) && !preg_match($IMAGE, $p)) out(400, ['error' => 'content not allowed']);
  $full = $DIR . '/' . $p;
  if (file_exists($full)) {
    if ($isShared) {
      $bk = $STATE . '/backups'; @mkdir($bk, 0750, true);
      copy($full, $bk . '/' . str_replace('/', '_', $p) . '.' . gmdate('Ymd-His') . '.bak');
    } elseif (!isset($ledger[$p])) out(409, ['error' => 'a file with that name already exists and was not made by Max']);
  }
  @mkdir(dirname($full), 0755, true);
  if (file_put_contents($full, $data) === false) out(500, ['error' => 'write failed']);
  if (!$isShared) { $ledger[$p] = gmdate('c'); file_put_contents($ledgerFile, json_encode($ledger, JSON_PRETTY_PRINT)); }
  log_it("put $p " . strlen($data) . ' bytes');
  out(200, ['ok' => true, 'path' => $p, 'bytes' => strlen($data), 'url' => 'https://homeprosgroup.com/' . $p]);
}

if ($op === 'unpublish') {
  // Max may take down only a page or image he made himself (e.g. the test page). Kept as a backup, never deleted.
  $p = $req['path'] ?? '';
  if (!isset($ledger[$p]) || !is_file($DIR . '/' . $p)) out(404, ['error' => 'not one of Max\'s files']);
  $bk = $STATE . '/backups'; @mkdir($bk, 0750, true);
  rename($DIR . '/' . $p, $bk . '/' . str_replace('/', '_', $p) . '.' . gmdate('Ymd-His') . '.removed');
  unset($ledger[$p]); file_put_contents($ledgerFile, json_encode($ledger, JSON_PRETTY_PRINT));
  log_it("unpublish $p");
  out(200, ['ok' => true, 'path' => $p]);
}

out(400, ['error' => 'unknown op']);
