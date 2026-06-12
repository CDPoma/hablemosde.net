#!/usr/bin/env node
/**
 * HablemosDE — Servidor local con auto-rebuild
 *
 * Uso: node dev.js
 *
 * - Abre http://localhost:3000 en el navegador
 * - Mete una carpeta con index.html en la raíz → el índice se actualiza solo
 */
'use strict';

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { execFileSync, execFile } = require('child_process');

const ROOT = __dirname;
const PORT = 3000;

// ── Colores para la terminal ──────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  gray:   '\x1b[90m',
  bold:   '\x1b[1m',
};
const log  = (msg)       => console.log(`${C.gray}[dev]${C.reset} ${msg}`);
const ok   = (msg)       => console.log(`${C.green}✔${C.reset}  ${msg}`);
const info = (msg)       => console.log(`${C.cyan}ℹ${C.reset}  ${msg}`);
const warn = (msg)       => console.log(`${C.yellow}⚠${C.reset}  ${msg}`);

// ── MIME types ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
  '.pdf':  'application/pdf',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
};

// ── Build ─────────────────────────────────────────────────────────────────────
function build(reason = '') {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'build.js')], {
      cwd: ROOT, stdio: 'pipe', encoding: 'utf8'
    });
    ok(`index.html regenerado${reason ? ' — ' + reason : ''}`);
    return true;
  } catch (e) {
    warn('Error en build.js:\n' + (e.stderr || e.message));
    return false;
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  let filePath = path.join(ROOT, urlPath);

  // Si la URL apunta a un directorio, servir su index.html
  try {
    if (fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch {}

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

// ── Polling: detecta carpetas nuevas cada 2 segundos (compatible con OneDrive) ─
const SKIP = new Set([
  'assets', 'node_modules', '.git', '_admin', 'dist', '.cloudflare'
]);

let knownDirs = getTopLevelDirs();

function getTopLevelDirs() {
  try {
    return new Set(
      fs.readdirSync(ROOT).filter(e => {
        if (SKIP.has(e) || e.startsWith('.') || e.startsWith('_')) return false;
        try { return fs.statSync(path.join(ROOT, e)).isDirectory(); }
        catch { return false; }
      })
    );
  } catch { return new Set(); }
}

function startPolling() {
  setInterval(() => {
    const current = getTopLevelDirs();
    const added   = [...current].filter(d => !knownDirs.has(d));
    const removed = [...knownDirs].filter(d => !current.has(d));

    if (added.length || removed.length) {
      if (added.length)   info(`Nueva carpeta detectada: ${added.join(', ')}`);
      if (removed.length) info(`Carpeta eliminada: ${removed.join(', ')}`);
      knownDirs = current;
      build(added.length ? `nueva carpeta: ${added.join(', ')}` : `carpeta eliminada`);
    }
  }, 2000);
  log('Vigilando carpetas cada 2s (modo OneDrive)…');
}

function watchRoot()   { startPolling(); }
function watchSubdirs() {}

// ── Abrir navegador ───────────────────────────────────────────────────────────
function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      execFile('cmd.exe', ['/c', 'start', '', url]);
    } else if (process.platform === 'darwin') {
      execFile('open', [url]);
    } else {
      execFile('xdg-open', [url]);
    }
  } catch {}
}

// ── Arranque ──────────────────────────────────────────────────────────────────
console.log(`\n${C.bold}HablemosDE — Servidor local${C.reset}\n`);

// 1. Build inicial
build('inicio');

// 2. Iniciar servidor
server.listen(PORT, '127.0.0.1', () => {
  info(`Servidor en ${C.cyan}http://localhost:${PORT}${C.reset}`);
  info('Mete una carpeta en la raíz → el índice se actualiza automáticamente');
  info(`Pulsa ${C.bold}Ctrl+C${C.reset} para detener\n`);
  setTimeout(() => openBrowser(`http://localhost:${PORT}`), 500);
});

// 3. Vigilar carpeta raíz + subdirectorios
watchRoot();
watchSubdirs();

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n');
  log('Deteniendo servidor…');
  server.close(() => process.exit(0));
});
