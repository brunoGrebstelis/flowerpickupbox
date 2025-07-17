// build.js  (CommonJS version; works with Node 16 without "type":"module")
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const nunjucks = require('nunjucks');

const ROOT = __dirname;
const SRC  = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

async function cleanDist() {
  // remove old dist (ignore errors)
  try {
    await fsp.rm(DIST, { recursive: true, force: true });
  } catch (_) {}
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  await ensureDir(dest);
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else {
      await fsp.copyFile(s, d);
    }
  }
}

async function loadLangData() {
  const codes = ['en','lv','ru','de'];
  const dataDir = path.join(SRC, 'data');
  const out = {};
  for (const c of codes) {
    try {
      const raw = await fsp.readFile(path.join(dataDir, `${c}.json`), 'utf8');
      out[c] = JSON.parse(raw);
    } catch (err) {
      console.warn(`⚠️  Missing or invalid ${c}.json: ${err.message}`);
      out[c] = {}; // keep as empty object; client-side fallbacks handle it
    }
  }
  return out;
}

async function build() {
  await cleanDist();
  await ensureDir(DIST);

  // nunjucks environment: point loader at src/ so we can reference layouts/, partials/, pages/
  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(SRC, { noCache: true }),
    { autoescape: false }
  );

  // data passed into templates
  const langData = await loadLangData();
  const context = {
    page:   { title: 'Flower Shop' },
    siteUrl: 'https://example.com',   // <- change to your real domain when deployed
    langData
  };

  // render the PAGE template (NOT the layout!)
  const html = env.render('pages/index.njk', context);
  await fsp.writeFile(path.join(DIST, 'index.html'), html, 'utf8');
  console.log('✓ Rendered dist/index.html');

  // copy static assets
  for (const dir of ['css','js','data','img','gallery']) {
    await copyDir(path.join(SRC, dir), path.join(DIST, dir));
  }
  console.log('✓ Copied assets.');
  console.log('Build complete.');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
