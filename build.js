/* ============================================================================
 * build.js – CommonJS build script for Flower Pickup Box
 * ---------------------------------------------------------------------------
 * Usage: npm run build
 *
 * What it does:
 *   • Loads all language JSON files from src/data/*.json
 *   • Renders src/pages/index.njk using src/layouts/base.njk & partials
 *   • Embeds language JSON into <script id="lang-data"> so main.js can switch
 *   • Copies static assets (css, js, data, img, gallery) to dist/
 *   • Uses only Node core modules (no fs-extra dependency)
 *
 * NOTE: We do NOT hard-code full translation strings here anymore.
 *       Whatever is in src/data is what gets embedded.
 *       If a language JSON is missing a key, your HTML default text remains.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');

/* ------------------------------------------------------------------ Paths -- */
const ROOT = __dirname;
const SRC  = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const DATA_DIR   = path.join(SRC, 'data');
const CSS_DIR    = path.join(SRC, 'css');
const JS_DIR     = path.join(SRC, 'js');
const PAGES_DIR  = path.join(SRC, 'pages');
const LAYOUT_DIR = path.join(SRC, 'layouts');
const PART_DIR   = path.join(SRC, 'partials');

/* top-level asset dirs (NOT under src/) */
const IMG_DIR     = path.join(ROOT, 'img');
const GALLERY_DIR = path.join(ROOT, 'gallery');

/* ---------------------------------------------------------------- Helpers -- */
function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function emptyDirSync(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.lstatSync(full);
    if (stat.isDirectory()) {
      emptyDirSync(full);
      fs.rmdirSync(full);
    } else {
      fs.unlinkSync(full);
    }
  }
}

function copyFileSync(src, dest) {
  ensureDirSync(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirSync(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`⚠️  Source missing, skip copy: ${srcDir}`);
    return;
  }
  const stat = fs.lstatSync(srcDir);
  if (!stat.isDirectory()) {
    copyFileSync(srcDir, destDir);
    return;
  }
  ensureDirSync(destDir);
  for (const entry of fs.readdirSync(srcDir)) {
    const s = path.join(srcDir, entry);
    const d = path.join(destDir, entry);
    const st = fs.lstatSync(s);
    if (st.isDirectory()) {
      copyDirSync(s, d);
    } else if (st.isSymbolicLink()) {
      const target = fs.readlinkSync(s);
      fs.symlinkSync(target, d);
    } else {
      copyFileSync(s, d);
    }
  }
}

/* ----------------------------------------------------------- Lang Loading -- */
function loadLangData() {
  const langs = {};
  if (!fs.existsSync(DATA_DIR)) return langs;
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));

  files.forEach(file => {
    const code = path.basename(file, '.json'); // en, lv, ru, de
    const filePath = path.join(DATA_DIR, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      langs[code] = JSON.parse(raw);
    } catch (err) {
      console.error(`✗ Failed to parse language file ${file}:`, err);
    }
  });

  return langs;
}

/* ------------------------------------------------------ Nunjucks Config -- */
const env = nunjucks.configure(
  [SRC, PAGES_DIR, LAYOUT_DIR, PART_DIR],
  {
    autoescape: true,
    noCache: true,
    trimBlocks: true,
    lstripBlocks: true
  }
);

/* JSON filter (needed by base.njk to embed lang data) */
env.addFilter('json', function (obj, spaces) {
  try {
    return JSON.stringify(obj, null, spaces || 0);
  } catch (err) {
    console.error('json filter error:', err);
    return '{}';
  }
});

/* ---------------------------------------------------------- Render Site -- */
function renderSite() {
  const langData = loadLangData();

  /* Clean dist */
  ensureDirSync(DIST);
  emptyDirSync(DIST);

  const pageCtx = {
    langData,
    /* Live site URL (update if domain changes) */
    siteUrl: 'https://flowerpickupbox.netlify.app',
    /* Social share image — absolute URL (hero used by default) */
    ogImage: 'https://flowerpickupbox.netlify.app/img/social-share.jpg',
    buildTime: new Date().toISOString()
  };

  let html;
  try {
    html = env.render('pages/index.njk', pageCtx);
  } catch (err) {
    console.error('✗ Render failed:', err);
    process.exit(1);
  }

  fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf8');
  console.log('✓ Rendered dist/index.html (languages:', Object.keys(langData).join(', ') || 'none', ')');
}

/* ---------------------------------------------------------- Copy Assets -- */
function copyAssets() {
  copyDirSync(CSS_DIR,     path.join(DIST, 'css'));
  copyDirSync(JS_DIR,      path.join(DIST, 'js'));
  copyDirSync(DATA_DIR,    path.join(DIST, 'data'));
  copyDirSync(IMG_DIR,     path.join(DIST, 'img'));
  copyDirSync(GALLERY_DIR, path.join(DIST, 'gallery'));
  console.log('✓ Copied assets (css, js, data, img, gallery)');
}

/* ----------------------------------------------------------------- Run -- */
(function build() {
  try {
    renderSite();
    copyAssets();
    console.log('Build complete.');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
})();
