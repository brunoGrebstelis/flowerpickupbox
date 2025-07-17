/* build.js – CommonJS build (no fs-extra dependency) */

const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');

/* ---------------------------------------------
   Paths
--------------------------------------------- */
const ROOT = __dirname;
const SRC  = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const DATA_DIR   = path.join(SRC, 'data');
const CSS_DIR    = path.join(SRC, 'css');
const JS_DIR     = path.join(SRC, 'js');
const PAGES_DIR  = path.join(SRC, 'pages');
const LAYOUT_DIR = path.join(SRC, 'layouts');
const PART_DIR   = path.join(SRC, 'partials');

const IMG_DIR     = path.join(ROOT, 'img');      // top-level (outside src/)
const GALLERY_DIR = path.join(ROOT, 'gallery');  // top-level

/* ---------------------------------------------
   Helpers
--------------------------------------------- */
function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function emptyDirSync(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = fs.lstatSync(p);
    if (stat.isDirectory()) {
      emptyDirSync(p);
      fs.rmdirSync(p);
    } else {
      fs.unlinkSync(p);
    }
  }
}

function copyFileSync(src, dest) {
  ensureDirSync(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirSync(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
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

/* ---------------------------------------------
   Load language JSON files
--------------------------------------------- */
function loadLangData() {
  const langs = {};
  if (!fs.existsSync(DATA_DIR)) return langs;
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const code = path.basename(file, '.json'); // en, lv, ru, de...
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
      langs[code] = JSON.parse(raw);
    } catch (err) {
      console.error(`✗ Failed to parse ${file}:`, err);
    }
  }
  return langs;
}

/* ---------------------------------------------
   Configure Nunjucks
--------------------------------------------- */
const env = nunjucks.configure(
  [SRC, PAGES_DIR, LAYOUT_DIR, PART_DIR],
  {
    autoescape: true,
    noCache: true,
    trimBlocks: true,
    lstripBlocks: true
  }
);

/* json filter */
env.addFilter('json', function (obj, spaces) {
  try {
    return JSON.stringify(obj, null, spaces || 0);
  } catch (err) {
    console.error('json filter error:', err);
    return '{}';
  }
});

/* ---------------------------------------------
   Render site
--------------------------------------------- */
function renderSite() {
  const langData = loadLangData();

  // Clean dist
  ensureDirSync(DIST);
  emptyDirSync(DIST);

  const pageCtx = {
    langData,
    siteUrl: 'https://flowerpickupbox.netlify.app',
    buildTime: new Date().toISOString()
  };

  const html = env.render('pages/index.njk', pageCtx);
  fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf8');
  console.log('✓ Rendered dist/index.html (langs:', Object.keys(langData).join(', '), ')');
}

/* ---------------------------------------------
   Copy assets
--------------------------------------------- */
function copyAssets() {
  copyDirSync(CSS_DIR,    path.join(DIST, 'css'));
  copyDirSync(JS_DIR,     path.join(DIST, 'js'));
  copyDirSync(DATA_DIR,   path.join(DIST, 'data'));
  copyDirSync(IMG_DIR,    path.join(DIST, 'img'));
  copyDirSync(GALLERY_DIR,path.join(DIST, 'gallery'));
  console.log('✓ Copied assets (css, js, data, img, gallery)');
}

/* ---------------------------------------------
   Run build
--------------------------------------------- */
try {
  renderSite();
  copyAssets();
  console.log('Build complete.');
} catch (err) {
  console.error('Build failed:', err);
  process.exit(1);
}
