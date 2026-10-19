// @ts-check
// Serves the project folder over http://localhost:8080 so the tool can be used
// offline. A plain web server is needed because ES modules cannot be imported
// from file:// URLs. Node's standard library only -- no dependencies.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const port = Number(process.env.PORT ?? 8080);

/** @type {Record<string, string|undefined>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.ics': 'text/calendar; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const relative = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    const file = path.join(root, relative);

    // Never serve anything outside the project folder.
    if (!file.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      });
      res.end(data);
    });
  })
  .listen(port, () => {
    console.log(`Kalendár zberu odpadu: http://localhost:${port}`);
  });
