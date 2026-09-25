/* 极简零依赖静态服务器 —— 给纳杰开关柜数字孪生页做本地预览
   用法: node serve.js [port]   默认 8321
   ⚠️ 必须正确设置 MIME, 否则 ES module / GLB 加载会失败
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2] || 8321);
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin':  'application/octet-stream',
  '.hdr':  'application/octet-stream',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

const srv = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400); return res.end('bad url'); }

  let fp = path.join(ROOT, urlPath);
  // 防目录穿越
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }

  fs.stat(fp, (err, st) => {
    if (!err && st.isDirectory()) fp = path.join(fp, 'index.html');
    fs.readFile(fp, (e, buf) => {
      if (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found: ' + urlPath);
      }
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(buf);
    });
  });
});

srv.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[serve] 端口 ${PORT} 已被占用, 换一个端口: node serve.js 8322`);
  } else {
    console.error('[serve] error:', err.message);
  }
  process.exit(1);
});

srv.listen(PORT, '127.0.0.1', () => {
  console.log(`[serve] root = ${ROOT}`);
  console.log(`[serve] http://127.0.0.1:${PORT}/  (Ctrl+C 停止)`);
});
