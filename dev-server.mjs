import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { extname, join, resolve, sep } from 'path';

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 4321);

const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const filePath = resolve(join(root, pathname));
    if (filePath !== root && !filePath.startsWith(root + sep)) {
        res.writeHead(403).end('403 Forbidden');
        return;
    }

    const candidates = extname(filePath) ? [filePath] : [filePath, `${filePath}.html`];

    for (const candidate of candidates) {
        try {
            const info = await stat(candidate);
            if (info.isDirectory()) continue;
            const body = await readFile(candidate);
            res.writeHead(200, {
                'Content-Type': types[extname(candidate).toLowerCase()] || 'application/octet-stream',
                'Cache-Control': 'no-store'
            });
            res.end(body);
            return;
        } catch {
            continue;
        }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end('404 Not Found');
})
    .on('error', error => {
        if (error.code === 'EADDRINUSE') {
            console.error(`port ${port} is already in use — stop the other server, or run PORT=4322 npm run dev`);
            process.exit(1);
        }
        throw error;
    })
    .listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
