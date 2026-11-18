// Local production preview using the same project subpath as GitHub Pages.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dest/prod');
const prefix = '/Student_pixel/';
const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.eot':'application/vnd.ms-fontobject','.cur':'image/x-icon','.mp4':'video/mp4'};
http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (url === '/Student_pixel') { res.writeHead(301, {Location:prefix}).end(); return; }
  if (!url.startsWith(prefix)) { res.writeHead(404).end('Not found'); return; }
  const file = path.resolve(root, url.slice(prefix.length) || 'index.html');
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    const headers = {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges':'bytes'};
    const range = req.headers.range;
    let start = 0, end = stat.size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) { res.writeHead(416, {'Content-Range':`bytes */${stat.size}`}).end(); return; }
      if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (start > end || start >= stat.size) { res.writeHead(416, {'Content-Range':`bytes */${stat.size}`}).end(); return; }
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD' || !stat.size) { res.end(); return; }
    fs.createReadStream(file, {start, end}).on('error', () => res.destroy()).pipe(res);
  });
}).listen(8772, '127.0.0.1', () => console.log('Student_pixel: http://127.0.0.1:8772/Student_pixel/'));
