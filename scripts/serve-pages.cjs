// Local production preview using the same project subpath as GitHub Pages.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dest/prod');
const prefix = '/Student_pixel/';
const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.eot':'application/vnd.ms-fontobject','.cur':'image/x-icon'};
http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (url === '/Student_pixel') { res.writeHead(301, {Location:prefix}).end(); return; }
  if (!url.startsWith(prefix)) { res.writeHead(404).end('Not found'); return; }
  const file = path.resolve(root, url.slice(prefix.length) || 'index.html');
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(8772, '127.0.0.1', () => console.log('Student_pixel: http://127.0.0.1:8772/Student_pixel/'));
