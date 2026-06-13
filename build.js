#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT   = __dirname;
const DIST   = path.join(ROOT, 'dist');
const OUTPUT = path.join(DIST, 'index.html');

// ── Copy helpers ──────────────────────────────────────────────────────────────
function copyFileSync(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    fs.statSync(s).isDirectory() ? copyDirSync(s, d) : copyFileSync(s, d);
  }
}

// Folders that are never niche sites
const SKIP = new Set([
  'assets', 'node_modules', '.git', '_admin',
  'dist', '.cloudflare', '.well-known', 'functions'
]);

// ── Auto-theme detection ──────────────────────────────────────────────────────
const THEMES = [
  { keys: ['coche','auto','moto','vehiculo','motor','conducir','furgon','camion'],        emoji:'🚗',  color:'#ef4444' },
  { keys: ['tecnolog','gadget','ordenador','movil','smartphone','tablet','laptop','pc'],  emoji:'💻',  color:'#3b82f6' },
  { keys: ['salud','fitness','deporte','ejercicio','nutricion','dieta','gym','medic'],    emoji:'🏃',  color:'#10b981' },
  { keys: ['cocina','receta','comida','gastronomia','restaurante','bebida','vino'],       emoji:'🍳',  color:'#f59e0b' },
  { keys: ['viaje','turismo','destino','hotel','vuelo','playa','montaña'],                emoji:'✈️',  color:'#06b6d4' },
  { keys: ['mascota','perro','gato','animal','veterinario'],                              emoji:'🐾',  color:'#a78bfa' },
  { keys: ['finanza','dinero','inversion','bolsa','cripto','ahorro','banco'],             emoji:'💰',  color:'#eab308' },
  { keys: ['moda','ropa','tendencia','fashion','calzado','complemento'],                  emoji:'👗',  color:'#ec4899' },
  { keys: ['jardin','planta','huerto','exterior','flores'],                               emoji:'🌿',  color:'#22c55e' },
  { keys: ['hogar','casa','deco','mueble','reforma','bricolaje'],                         emoji:'🏠',  color:'#78716c' },
  { keys: ['bebe','infantil','niño','juguete','educacion'],                               emoji:'👶',  color:'#fb923c' },
  { keys: ['foto','fotografia','camara','video','cine'],                                  emoji:'📷',  color:'#8b5cf6' },
  { keys: ['musica','instrumento','guitar','piano','audio','altavoz'],                    emoji:'🎵',  color:'#e879f9' },
  { keys: ['libro','lectura','literatura','novela'],                                      emoji:'📚',  color:'#0ea5e9' },
  { keys: ['juego','gaming','videojuego','consola','esport'],                             emoji:'🎮',  color:'#7c3aed' },
  { keys: ['belleza','cosmetic','perfume','maquillaje','piel'],                           emoji:'💄',  color:'#f43f5e' },
  { keys: ['herramienta','bricolaje','taller','industria'],                               emoji:'🔧',  color:'#64748b' },
  { keys: ['derechos','legal','ley','abogado','seguro'],                                  emoji:'⚖️',  color:'#1e40af' },
  { keys: ['clima','tiempo','meteorolog','natura','medioambiente'],                       emoji:'🌤️',  color:'#0284c7' },
  { keys: ['arte','pintura','diseño','creative','ilustracion'],                           emoji:'🎨',  color:'#c026d3' },
];

const PALETTE = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#14b8a6','#84cc16','#ef4444','#3b82f6'];

function detectTheme(slug, title = '') {
  const text = (slug + ' ' + title).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const t of THEMES) {
    if (t.keys.some(k => text.includes(k))) return { emoji: t.emoji, color: t.color };
  }
  const hash = [...slug].reduce((h, c) => h + c.charCodeAt(0), 0);
  return { emoji: '📄', color: PALETTE[hash % PALETTE.length] };
}

// ── HTML meta extraction ──────────────────────────────────────────────────────
function extractMeta(html) {
  const title = (html.match(/<title[^>]*>([^<]{1,120})<\/title>/i) || [])[1]?.trim() || '';
  const desc  = (
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+name=["']description["']/i)
  || [])[1]?.trim() || '';
  const ogImg = (
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  || [])[1]?.trim() || '';
  return { title, desc, ogImg };
}

function findThumb(dirPath, slug) {
  for (const name of ['thumb','thumbnail','og-image','cover','portada','hero','banner']) {
    for (const ext of ['webp','jpg','jpeg','png','svg']) {
      if (fs.existsSync(path.join(dirPath, `${name}.${ext}`)))
        return `/${slug}/${name}.${ext}`;
    }
  }
  return '';
}

function slugToTitle(slug) {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Scan all subdirectories ───────────────────────────────────────────────────
const sites = [];

for (const entry of fs.readdirSync(ROOT).sort()) {
  if (SKIP.has(entry) || entry.startsWith('.') || entry.startsWith('_')) continue;

  const dirPath = path.join(ROOT, entry);
  try { if (!fs.statSync(dirPath).isDirectory()) continue; }
  catch { continue; }

  const hasIndex    = fs.existsSync(path.join(dirPath, 'index.html'))
                   || fs.existsSync(path.join(dirPath, 'index.php'));
  const hasManifest = fs.existsSync(path.join(dirPath, 'manifest.json'));

  // A valid site needs at least an index or a manifest
  if (!hasIndex && !hasManifest) continue;

  // Optional manifest overrides
  let mf = {};
  if (hasManifest) {
    try { mf = JSON.parse(fs.readFileSync(path.join(dirPath, 'manifest.json'), 'utf8')); }
    catch {}
  }

  // Read HTML meta
  let meta = { title: '', desc: '' };
  const htmlPath = path.join(dirPath, 'index.html');
  if (fs.existsSync(htmlPath)) {
    try { meta = extractMeta(fs.readFileSync(htmlPath, 'utf8')); } catch {}
  }

  const name  = mf.name        || meta.title || slugToTitle(entry);
  const desc  = mf.description || meta.desc  || '';
  const theme = detectTheme(entry, name);
  const emoji = mf.icon  ?? theme.emoji;
  const color = mf.color ?? theme.color;
  const order = mf.order != null ? +mf.order : 99;
  const badge = mf.badge ?? '';

  let image = '';
  if (mf.image && fs.existsSync(path.join(dirPath, mf.image))) {
    image = `/${entry}/${mf.image}`;
  } else {
    image = findThumb(dirPath, entry) || (meta.ogImg?.startsWith('http') ? meta.ogImg : '');
  }

  sites.push({ slug: entry, name, desc, emoji, color, order, badge, image, url: `/${entry}/` });
}

sites.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));

// ── Build cards HTML ──────────────────────────────────────────────────────────
const cardsHTML = sites.length === 0
  ? `<div class="empty-state">
      <div class="empty-icon">📂</div>
      <h2>Próximamente</h2>
      <p>Nuevas secciones en camino.</p>
    </div>`
  : sites.flatMap((s, i) => {
      const badge  = s.badge ? `<span class="card-badge">${esc(s.badge)}</span>` : '';
      const desc   = s.desc  ? `<p class="card-desc">${esc(s.desc)}</p>` : '';
      const media  = s.image
        ? `<div class="card-media"><img src="${esc(s.image)}" alt="${esc(s.name)}" loading="lazy" /></div>`
        : `<div class="card-icon-wrap">${s.emoji}</div>`;
      const card = `<a href="${esc(s.url)}" class="card" data-name="${esc(s.name.toLowerCase())}" data-desc="${esc(s.desc.toLowerCase())}" style="--card-color:${esc(s.color)}">
  ${badge}${media}
  <h2 class="card-title">${esc(s.name)}</h2>
  ${desc}
  <span class="card-cta">Ver artículos <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
</a>`;
      // Slot AdSense cada 6 tarjetas (posición 6, 12, 18…)
      const adSlot = (i + 1) % 6 === 0 && (i + 1) < sites.length
        ? `<div class="ad-ingrid">
  <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-3406678601655942" data-ad-slot="AUTO" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`
        : '';
      return adSlot ? [card, adSlot] : [card];
    }).join('\n');

const searchBlock = `<div class="search-wrap">
        <input type="search" id="searchBox" placeholder="Busca un tema…" autocomplete="off" aria-label="Buscar tema" />
        <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
      </div>`;

const countLabel = '';

const YEAR = new Date().getFullYear();

// ── Full HTML ─────────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- SEO básico -->
  <title>HablemosDE — Resuelve tus dudas sobre cualquier tema</title>
  <meta name="description" content="Más de 50 temas explicados con claridad y criterio. Piscinas, gallinas y mucho más. Cuando no sabes algo, cuando tienes dudas o cuando quieres confirmar lo que ya crees saber." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://hablemosde.net/" />

  <!-- Open Graph -->
  <meta property="og:title" content="HablemosDE — Resuelve tus dudas sobre cualquier tema" />
  <meta property="og:description" content="Más de 50 temas explicados con claridad. Piscinas, gallinas y mucho más. Sin rodeos." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://hablemosde.net/" />
  <meta property="og:image" content="https://hablemosde.net/assets/img/og-hablemosde.jpg" />
  <meta property="og:image:alt" content="HablemosDE — Directorio de guías sobre piscinas, gallinas y más temas" />
  <meta property="og:site_name" content="HablemosDE" />
  <meta property="og:locale" content="es_ES" />

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="HablemosDE — Resuelve tus dudas sobre cualquier tema" />
  <meta name="twitter:description" content="Más de 50 temas explicados con claridad. Sin rodeos." />
  <meta name="twitter:image" content="https://hablemosde.net/assets/img/og-hablemosde.jpg" />

  <!-- Datos estructurados JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "HablemosDE",
    "url": "https://hablemosde.net/",
    "description": "Más de 50 temas explicados con claridad. Piscinas, gallinas y mucho más.",
    "inLanguage": "es",
    "publisher": { "@type": "Organization", "name": "HablemosDE", "url": "https://hablemosde.net/" },
    "potentialAction": {
      "@type": "SearchAction",
      "target": { "@type": "EntryPoint", "urlTemplate": "https://hablemosde.net/?q={search_term_string}" },
      "query-input": "required name=search_term_string"
    }
  }
  <\/script>

  <!-- AdSense -->
  <meta name="google-adsense-account" content="ca-pub-3406678601655942" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3406678601655942" crossorigin="anonymous"><\/script>

  <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/css/style.css" />
</head>
<body>

  <header class="site-header">
    <div class="header-bg-shapes" aria-hidden="true">
      <div class="header-shape header-shape--1"></div>
      <div class="header-shape header-shape--2"></div>
      <div class="header-shape header-shape--3"></div>
    </div>
    <div class="header-inner">
      <div class="header-year-badge">
        <span class="header-year-dot"></span>
        Guías actualizadas ${YEAR}
      </div>
      <div class="logo">
        <span class="logo-hablemos">Hablemos</span><span class="logo-de">DE</span>
      </div>
      <p class="header-tagline">Cuando no sabes &middot; Cuando dudas &middot; Cuando quieres confirmar</p>
      <p class="header-desc">Más de 50 temas explicados con claridad y criterio. Elige cualquier sección y encuentra respuestas directas, sin rodeos.</p>
      <div class="header-stats">
        <div class="header-stat">
          <span class="header-stat-num">50+</span>
          <span class="header-stat-label">Temas</span>
        </div>
        <div class="header-stat-divider"></div>
        <div class="header-stat">
          <span class="header-stat-num">100%</span>
          <span class="header-stat-label">Sin rodeos</span>
        </div>
        <div class="header-stat-divider"></div>
        <div class="header-stat">
          <span class="header-stat-num">${YEAR}</span>
          <span class="header-stat-label">Actualizado</span>
        </div>
      </div>
      ${searchBlock}
    </div>
  </header>

  <!-- Slot superior — leaderboard / banner adaptable -->
  <div class="ad-top">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-3406678601655942" data-ad-slot="AUTO" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>

  <main class="main-content">
    <div class="cards-grid" id="cardsGrid">
      ${cardsHTML}
    </div>
    <div class="no-results" id="noResults" hidden>
      <p>No se encontraron temas para &ldquo;<span id="noResultsTerm"></span>&rdquo;.</p>
    </div>
  </main>

  <!-- Slot inferior — antes del footer -->
  <div class="ad-bottom">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-3406678601655942" data-ad-slot="AUTO" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>

  <footer class="site-footer">
    <div class="footer-inner">
      <span class="logo-sm"><span>Hablemos</span><strong>DE</strong></span>
      <p>Cuando no sabes, cuando dudas, cuando quieres confirmar. Más de 50 temas.</p>
      <p class="footer-copy">&copy; ${YEAR} HablemosDE.net &mdash; Todos los derechos reservados</p>
    </div>
  </footer>

  <script src="/assets/js/main.js"></script>
</body>
</html>`;

// ── Write dist ────────────────────────────────────────────────────────────────
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUTPUT, html, 'utf8');

// Static files en raíz
for (const f of ['robots.txt', 'sitemap.xml', 'sitemap-main.xml', 'ads.txt']) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) copyFileSync(src, path.join(DIST, f));
}

// Carpetas de assets y nichos
copyDirSync(path.join(ROOT, 'assets'),   path.join(DIST, 'assets'));
for (const entry of fs.readdirSync(ROOT)) {
  if (SKIP.has(entry) || entry.startsWith('.') || entry.startsWith('_')) continue;
  const dirPath = path.join(ROOT, entry);
  try { if (!fs.statSync(dirPath).isDirectory()) continue; } catch { continue; }
  copyDirSync(dirPath, path.join(DIST, entry));
}

console.log(`\n✅  dist/ generado con ${sites.length} sitio(s)`);
if (sites.length) console.log('   ' + sites.map(s => `${s.emoji} ${s.name}`).join('\n   '));
