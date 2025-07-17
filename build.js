// build.js (CommonJS, Node 16 compatible)
const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

// ensure dist exists
if (!fs.existsSync(DIST)) {
  fs.mkdirSync(DIST, { recursive: true });
}

// nunjucks env
const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(SRC, { noCache: true }),
  { autoescape: true }
);

// load one language JSON
function loadLang(code) {
  const p = path.join(SRC, 'data', `${code}.json`);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// render pages
function buildPages() {
  const templatePath = path.join(SRC, 'pages', 'index.njk');

  // load all langs
  const LANG_CODES = ['en','lv','ru','de'];
  const langs = {};
  for (const code of LANG_CODES) {
    langs[code] = loadLang(code);
  }

  // context sent to Nunjucks
  const context = {
    t: langs.en,                    // default text: English
    langsJson: JSON.stringify(langs) // all languages as JSON string
  };

  const rendered = env.render(templatePath, context);
  fs.writeFileSync(path.join(DIST, 'index.html'), rendered, 'utf8');
  console.log('✓ Rendered dist/index.html');
}

// copy dirs
function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function copyAssets() {
  copyDir(path.join(SRC, 'css'), path.join(DIST, 'css'));
  copyDir(path.join(SRC, 'js'), path.join(DIST, 'js'));
  copyDir(path.join(SRC, 'data'), path.join(DIST, 'data')); // still copy for reference
  copyDir(path.join(SRC, 'img'), path.join(DIST, 'img'));
  copyDir(path.join(SRC, 'gallery'), path.join(DIST, 'gallery'));
  console.log('✓ Copied assets (css, js, data, img, gallery)');
}

// run
buildPages();
copyAssets();
console.log('Build complete.');
