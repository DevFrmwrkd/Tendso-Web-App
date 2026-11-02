'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const roots = [path.join(repoRoot, 'docs', 'landing-mock'), path.join(repoRoot, 'public')];
const port = Number(process.argv[2] || 3030);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Choose a valid port between 1 and 65535.');
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const requestedPath = pathname === '/' ? '/hub.html' : pathname;
    for (const root of roots) {
      const file = path.resolve(root, '.' + requestedPath);
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      let info;
      try {
        info = fs.statSync(file);
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue;
        throw error;
      }
      if (!info.isFile()) continue;
      res.writeHead(200, {
        'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') res.end();
      else
        fs.createReadStream(file)
          .on('error', () => res.destroy())
          .pipe(res);
      return;
    }
    res.writeHead(404).end('Not found');
  } catch {
    res.writeHead(400).end('Invalid request');
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Design hub: http://localhost:${port}/hub.html`);
  console.log(`Field agents: http://localhost:${port}/app/field-agent-review.html`);
});
