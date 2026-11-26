import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const port = Number(process.env.PORT || 4319);
const allowed = new Set(['/index.html', '/src/app.js', '/src/core.js', '/src/style.css', '/src/split.css', '/examples/platform.json']);
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const target = path === '/' ? '/index.html' : path;
    if (!allowed.has(target)) { res.writeHead(404); res.end('Not found'); return; }
    const body = await readFile(new URL('.' + target, root));
    res.writeHead(200, { 'Content-Type': types[target.split('.').pop()] + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); res.end(body);
  } catch { res.writeHead(500); res.end('Unable to read application file'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`有钱收分账计算器 http://127.0.0.1:${port} (${fileURLToPath(root)})`));
