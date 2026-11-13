import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8085;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  let cleanUrl = req.url.split('?')[0];
  try {
    cleanUrl = decodeURIComponent(cleanUrl);
  } catch (err) {
    // If decoding fails, continue with raw
  }

  if (cleanUrl === '/' || cleanUrl === '') {
    // Render an index page of all available items
    try {
      const items = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.html'));
      let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>letgolist - Local Showcase Server</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.6; }
    h1 { color: #38bdf8; margin-bottom: 0.5rem; }
    p { color: #94a3b8; margin-bottom: 2rem; }
    ul { list-style: none; padding: 0; display: grid; gap: 0.75rem; }
    li a { display: block; background: #1e293b; border: 1px solid #334155; padding: 1rem 1.25rem; border-radius: 8px; color: #f8fafc; text-decoration: none; font-weight: 500; transition: border-color 0.2s; }
    li a:hover { border-color: #38bdf8; background: #243248; }
  </style>
</head>
<body>
  <h1>letgolist Local Inventory Server</h1>
  <p>Select any item page below to test directly in your browser:</p>
  <ul>
    ${items.map(f => `<li><a href="/${f}">${f.replace('.html', '')}</a></li>`).join('')}
  </ul>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    } catch (err) {
      res.writeHead(500);
      res.end('Error reading directory: ' + err.message);
      return;
    }
  }

  // Remove leading slash
  let relativeFilePath = cleanUrl.replace(/^\/+/, '');
  let filePath = path.join(DIST_DIR, relativeFilePath);

  // If file doesn't exist, try appending .html
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  // If still not found, check root Sales/ if requested
  if (!fs.existsSync(filePath)) {
    const rootFallback = path.join(__dirname, '..', relativeFilePath);
    if (fs.existsSync(rootFallback)) {
      filePath = rootFallback;
    }
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 Not Found: ${cleanUrl}`);
    return;
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=3600',
  });

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`letgolist preview server running at http://localhost:${PORT}/ and http://10.23.40.3:${PORT}/`);
});
