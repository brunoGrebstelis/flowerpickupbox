/* ============================================================================
 * build.js – CommonJS build script for Flower Pickup Box
 * ============================================================================
 * Features:
 *   • Loads all language JSON from src/data/*.json
 *   • Ensures fallback English if en.json missing
 *   • Renders src/pages/index.njk using layouts/ + partials/
 *   • Embeds language JSON into <script id="lang-data">
 *   • Copies asset folders (css, js, data, img, gallery) into dist/
 *   • Adds console logging
 *
 * Requires: nunjucks 3.x  (npm install nunjucks)
 * Uses only Node core modules (no fs-extra).
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

/* top-level assets (outside src/) */
const IMG_DIR     = path.join(ROOT, 'img');
const GALLERY_DIR = path.join(ROOT, 'gallery');

/* -------------------------------------------------------------- Utilities -- */
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
    console.warn(`⚠️  Missing, skipped: ${srcDir}`);
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

/* ----------------------------------------------------------- Language Data -- */
function loadLangData() {
  const langs = {};
  if (fs.existsSync(DATA_DIR)) {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const code = path.basename(file, '.json'); // "en", "de", etc.
      const full = path.join(DATA_DIR, file);
      try {
        const raw = fs.readFileSync(full, 'utf8');
        langs[code] = JSON.parse(raw);
      } catch (err) {
        console.error(`✗ Failed to parse ${file}:`, err);
      }
    }
  }

  /* Minimal fallback English if en.json is missing */
  if (!langs.en) {
    console.warn('⚠️  en.json missing; injecting minimal fallback English.');
    langs.en = {
      heroTitle: "More Sales Less Effort",
      heroTagline: "Smart, beautiful, and always open – your modern flower vending solution.",
      introText: "How many customers have walked past your closed doors at 10 pm, their purchases lost forever? It doesn't have to be that way. Soon, every shop will offer 24/7 access—staff or no staff. Will yours?",
      introBtnVideo: "See how it works",
      introBtnContact: "Contact us",
      technicalHeading: "Features",
      tech1Title: "🔧 Technology",
      tech1Item1: "LED lighting per compartment / global",
      tech1Item2: "5 light modes",
      tech1Item3: "Active cooling system",
      tech1Item4: "Remote monitoring via Telegram bot",
      tech2Title: "🛒 Service & Sales",
      tech2Item1: "Touchscreen operation",
      tech2Item2: "Card payment",
      tech2Item3: "Digital price tags",
      tech2Item4: "Advance reservation system",
      tech2Item5: "Available 24/7",
      tech3Title: "🎨 Design & Benefits",
      tech3Item1: "Customizable design",
      tech3Item2: "Already in use in Germany",
      tech3Item3: "Made in the EU",
      tech3Item4: "Competitive price",
      techSpecColSpec: "Spec",
      techSpecColValue: "Specifications",
      techSpecDimensions: "Dimensions",
      techSpecDimensionsVal: "Custom-built to fit your shop window",
      techSpecCapacity: "Capacity",
      techSpecCapacityVal: "Up to 24 lockers",
      techSpecLockerSizes: "Locker Sizes",
      techSpecLockerSizesVal: "- Small: for €20–40 bouquets<br>- Large: for €50–100 bouquets",
      techSpecPower: "Power Usage",
      techSpecPowerVal: "Max 300W (depends on active features)",
      techSpecPayment: "Payment",
      techSpecPaymentVal: "Card & contactless",
      techSpecRemote: "Remote Monitoring",
      techSpecRemoteVal: "Telegram alerts",
      techSpecBranding: "Branding",
      techSpecBrandingVal: "Custom panels & colors",
      pricingHeading: "Pricing & ROI",
      pricingSubheading: "An Investment That Pays Back Fast",
      pricingBody1: "Every Flower Pickup Box is built to match your shop—number of lockers, cooling, and your preferred look.",
      pricingBody2: "Most machines cost somewhere in the low to mid five-figure range.",
      pricingBody3: "At our pilot in Mönchengladbach, one machine is selling over 100 bouquets each month—and demand keeps growing. For most shops, it pays for itself in 10–14 months.",
      pricingCta: "Contact us for a quote",
      videoPlaceholder: "Video coming soon…",
      aboutHeading: "About Us",
      aboutText: "We are a small team of engineers and designers passionate about helping shop owners unlock after-hours sales...",
      galleryHeading: "Gallery",
      contactsHeading: "Contacts",
      contactEmailLabel: "Email:",
      contactPhoneLabel1: "Phone (English / Latvian / Russian):",
      contactPhoneLabel2: "Aija (German):",
      formNameLabel: "Name",
      formEmailLabel: "Email",
      formMessageLabel: "Message",
      formSendBtn: "Send",
      formThankYou: "Thank you! We'll get to you as soon as possible.",
      footerRights: "All rights reserved."
    };
  }
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

/* Filter: json (needed by base.njk) */
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

  ensureDirSync(DIST);
  emptyDirSync(DIST);

  const pageCtx = {
    langData,
    siteUrl: 'https://flowerpickupbox.netlify.app',
    ogImage: 'https://flowerpickupbox.netlify.app/img/social-share.png',
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
  console.log('✓ Rendered dist/index.html (langs:', Object.keys(langData).join(', '), ')');
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
