#!/usr/bin/env node
'use strict';

/**
 * Genera artículos HTML para todas las sub-webs de Hablemosde.net
 * que tengan content/feed.json. Se ejecuta desde la raíz del repo:
 *   node generate-articles.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const TODAY = new Date().toISOString().slice(0, 10);

const SKIP = new Set(['assets', 'node_modules', '.git', '_admin', 'dist', 'public', 'articulos']);

// ── Auto-detección de sub-webs ────────────────────────────────────────────────
const sites = [];

for (const entry of fs.readdirSync(ROOT).sort()) {
  if (SKIP.has(entry) || entry.startsWith('.') || entry.startsWith('_')) continue;
  const dir = path.join(ROOT, entry);
  try { if (!fs.statSync(dir).isDirectory()) continue; } catch { continue; }

  const feedPath = path.join(dir, 'content', 'feed.json');
  if (!fs.existsSync(feedPath)) continue;

  // Nombre del sitio: desde index.html <title> o del slug
  let siteName = entry;
  const htmlPath = path.join(dir, 'index.html');
  if (fs.existsSync(htmlPath)) {
    const m = fs.readFileSync(htmlPath, 'utf8').match(/<title[^>]*>([^<]{1,120})<\/title>/i);
    if (m) siteName = m[1].split('|')[0].trim();
  }

  // Color: desde manifest.json si existe
  let themeColor = '#4f46e5';
  const mfPath = path.join(dir, 'manifest.json');
  if (fs.existsSync(mfPath)) {
    try { themeColor = JSON.parse(fs.readFileSync(mfPath, 'utf8')).color || themeColor; } catch {}
  }

  sites.push({
    dir,
    slug: entry,
    siteName,
    themeColor,
    baseUrl: `https://hablemosde.net/${entry}`,
    feedPath,
  });
}

if (!sites.length) {
  console.log('No se encontraron sub-webs con content/feed.json');
  process.exit(0);
}

console.log(`\nSub-webs detectadas: ${sites.map(s => s.slug).join(', ')}\n`);

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function parseContent(text) {
  return String(text || '')
    .split(/\n\n+/)
    .filter(b => b.trim())
    .map(b => {
      const t = b.trim();
      if (t.startsWith('**') && t.endsWith('**'))
        return `<h3>${esc(t.slice(2,-2))}</h3>`;
      return `<p>${t.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')}</p>`;
    })
    .join('\n');
}

function renderArticle(post, site) {
  const title   = esc(post.title);
  const desc    = esc(post.excerpt || post.title);
  const slug    = post.slug;
  const content = parseContent(post.content || post.excerpt);
  const meta    = [post.category, post.date, post.author].filter(Boolean).map(esc).join(' · ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ${esc(site.siteName)}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${esc(site.baseUrl)}/articulos/${encodeURIComponent(slug).replace(/%2F/g,'/')}.html">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="${site.themeColor}">
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <main class="legal-shell">
    <section class="legal-card">
      <nav style="font-size:0.85rem;margin-bottom:1rem;">
        <a href="../index.html">Portada</a> › <span>${esc(post.category || 'Artículo')}</span>
      </nav>
      <span class="eyebrow">${esc(post.category || 'Artículo')}</span>
      <h1>${title}</h1>
      ${meta ? `<p class="entry-meta">${meta}</p>` : ''}
      <div class="entry-body">
${content}
      </div>
      <a class="button button-primary" href="../index.html#publicaciones">Volver a publicaciones</a>
    </section>
  </main>
</body>
</html>`;
}

// ── Generación ────────────────────────────────────────────────────────────────
for (const site of sites) {
  const feedRaw = fs.readFileSync(site.feedPath, 'utf8').replace(/^﻿/, '');
  const feed    = JSON.parse(feedRaw);
  const outDir  = path.join(site.dir, 'articulos');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const sitemapEntries = [];
  let count = 0;

  for (const post of (feed.posts || [])) {
    const filename = path.join(outDir, post.slug + '.html');
    fs.writeFileSync(filename, renderArticle(post, site), 'utf8');
    sitemapEntries.push(
      `  <url>\n    <loc>${site.baseUrl}/articulos/${encodeURIComponent(post.slug).replace(/%2F/g,'/')}.html</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`
    );
    count++;
  }

  console.log(`✓ ${site.slug}: ${count} artículos generados`);

  // Actualizar sitemap.xml
  const sitemapPath = path.join(site.dir, 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    let sitemap = fs.readFileSync(sitemapPath, 'utf8');
    sitemap = sitemap.replace(/\s*<url>\s*<loc>[^<]*entrada\.html\?type=post[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
    sitemap = sitemap.replace(/\s*<!-- Artículos estáticos -->[\s\S]*?(?=<\/urlset>)/, '\n');
    const newBlock = '\n  <!-- Artículos estáticos -->\n' + sitemapEntries.join('\n') + '\n';
    sitemap = sitemap.replace('</urlset>', newBlock + '</urlset>');
    fs.writeFileSync(sitemapPath, sitemap, 'utf8');
    console.log(`  → sitemap.xml actualizado (${count} URLs)`);
  }
}

console.log('\n✅ Hecho.');
