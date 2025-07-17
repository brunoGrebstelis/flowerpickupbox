/* ===========================================================
   Flower Pickup Box – main.js (defensive i18n + gallery + form)
   -----------------------------------------------------------
   This version:
   - Safely reads <script id="lang-data"> JSON embedded in index.html
   - Falls back to fetching /data/<lang>.json if needed
   - Applies translations using a key -> elementId map
   - Builds language switcher menu
   - Initializes gallery slider
   - Handles contact form + thank-you bubble
=========================================================== */

/* ---------- CONFIG ---------- */
const LANG_CODES = ['en','lv','ru','de'];
const LANG_FLAGS = { en:'🇬🇧', lv:'🇱🇻', ru:'🇷🇺', de:'🇩🇪' };

/* Minimal English fallback (all keys we render) */
const FALLBACK_EN = {
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

  /* spec table */
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
  aboutText: "We are a small team of engineers and designers passionate about helping shop owners unlock after-hours sales. Born from the idea that every shop should stay open 24/7 without extra staff, we build vending systems that blend smart technology with elegant design. From dynamic LED lighting to active cooling and Telegram monitoring, our machines are crafted to keep products fresh and customers delighted—even when the doors are closed.",

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

/* key -> DOM id */
const I18N_MAP = {
  heroTitle: 'i18n-heroTitle',
  heroTagline: 'i18n-heroTagline',
  introText: 'i18n-introText',
  introBtnVideo: 'i18n-introBtnVideo',
  introBtnContact: 'i18n-introBtnContact',
  technicalHeading: 'technical-heading',
  tech1Title: 'tech-technik',
  tech1Item1: 'tech1Item1',
  tech1Item2: 'tech1Item2',
  tech1Item3: 'tech1Item3',
  tech1Item4: 'tech1Item4',
  tech2Title: 'tech-bedienung',
  tech2Item1: 'tech2Item1',
  tech2Item2: 'tech2Item2',
  tech2Item3: 'tech2Item3',
  tech2Item4: 'tech2Item4',
  tech2Item5: 'tech2Item5',
  tech3Title: 'tech-design',
  tech3Item1: 'tech3Item1',
  tech3Item2: 'tech3Item2',
  tech3Item3: 'tech3Item3',
  tech3Item4: 'tech3Item4',

  techSpecColSpec: 'i18n-techSpecColSpec',
  techSpecColValue: 'i18n-techSpecColValue',
  techSpecDimensions: 'i18n-techSpecDimensions',
  techSpecDimensionsVal: 'i18n-techSpecDimensionsVal',
  techSpecCapacity: 'i18n-techSpecCapacity',
  techSpecCapacityVal: 'i18n-techSpecCapacityVal',
  techSpecLockerSizes: 'i18n-techSpecLockerSizes',
  techSpecLockerSizesVal: 'i18n-techSpecLockerSizesVal',
  techSpecPower: 'i18n-techSpecPower',
  techSpecPowerVal: 'i18n-techSpecPowerVal',
  techSpecPayment: 'i18n-techSpecPayment',
  techSpecPaymentVal: 'i18n-techSpecPaymentVal',
  techSpecRemote: 'i18n-techSpecRemote',
  techSpecRemoteVal: 'i18n-techSpecRemoteVal',
  techSpecBranding: 'i18n-techSpecBranding',
  techSpecBrandingVal: 'i18n-techSpecBrandingVal',

  pricingHeading: 'pricing-heading',
  pricingSubheading: 'i18n-pricingSubheading',
  pricingBody1: 'i18n-pricingBody1',
  pricingBody2: 'i18n-pricingBody2',
  pricingBody3: 'i18n-pricingBody3',
  pricingCta: 'i18n-pricingCta',

  videoPlaceholder: 'i18n-videoPlaceholder',
  aboutHeading: 'about-heading',
  aboutText: 'i18n-aboutText',
  galleryHeading: 'gallery-heading',
  contactsHeading: 'contacts-heading',
  contactEmailLabel: 'i18n-contactEmailLabel',
  contactPhoneLabel1: 'i18n-contactPhoneLabel1',
  contactPhoneLabel2: 'i18n-contactPhoneLabel2',
  formNameLabel: 'i18n-formNameLabel',
  formEmailLabel: 'i18n-formEmailLabel',
  formMessageLabel: 'i18n-formMessageLabel',
  formSendBtn: 'i18n-formSendBtn',
  footerRights: 'i18n-footerRights'
};

/* ---------- Parse embedded JSON ---------- */
let EMBED_LANG_DATA = {};
function readEmbeddedLangData() {
  const node = document.getElementById('lang-data');
  if (!node) {
    console.warn('[i18n] No <script id="lang-data"> found; will rely on /data/*.json fetch.');
    return;
  }
  try {
    EMBED_LANG_DATA = JSON.parse(node.textContent.trim() || '{}');
    console.log('[i18n] Embedded language data loaded:', Object.keys(EMBED_LANG_DATA));
  } catch (err) {
    console.error('[i18n] Failed to parse embedded language data:', err);
    EMBED_LANG_DATA = {};
  }
}

/* ---------- Cache ---------- */
const I18N_CACHE = {};
function cacheLang(code, dict){ I18N_CACHE[code] = dict || {}; }

/* ---------- Build full dict w/ fallback ---------- */
function mergedDict(lang){
  const base = FALLBACK_EN;
  const override = I18N_CACHE[lang] || {};
  return { ...base, ...override };  // override keys replace fallback
}

/* ---------- Apply translations to DOM ---------- */
function applyTranslations(lang){
  const dict = mergedDict(lang);
  for (const [key, id] of Object.entries(I18N_MAP)){
    const el = document.getElementById(id);
    if (!el) continue;
    el.innerHTML = dict[key] || '';
  }
  // thank-you bubble update if visible
  const thanksEl = document.getElementById('contact-form-thanks');
  if (thanksEl && thanksEl.classList.contains('show')) {
    thanksEl.textContent = dict.formThankYou || FALLBACK_EN.formThankYou;
  }
}

/* ---------- Build language menu ---------- */
function buildLangMenu(current){
  const menu = document.getElementById('lang-options');
  if(!menu) return;
  menu.innerHTML = '';
  LANG_CODES.forEach(code=>{
    if(code === current) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-option-btn';
    btn.textContent = LANG_FLAGS[code];
    btn.setAttribute('data-lang', code);
    btn.setAttribute('aria-label', 'Switch to ' + code.toUpperCase());
    btn.addEventListener('click',()=>{
      toggleLangMenu(false);
      setLang(code);
    });
    menu.appendChild(btn);
  });
}

/* ---------- Toggle widget ---------- */
function toggleLangMenu(force){
  const widget = document.getElementById('lang-widget');
  const menu   = document.getElementById('lang-options');
  const mainBtn= document.getElementById('lang-main-btn');
  if(!widget || !menu || !mainBtn) return;
  const open = (force!==undefined)?force:!widget.classList.contains('open');
  widget.classList.toggle('open', open);
  mainBtn.setAttribute('aria-expanded', open ? 'true':'false');
  menu.setAttribute('aria-hidden', open ? 'false':'true');
}

/* ---------- Fetch language file if needed ---------- */
async function fetchLang(code){
  try {
    const resp = await fetch(`data/${code}.json`, { cache: 'no-store' });
    if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
    return await resp.json();
  } catch (err) {
    console.warn(`[i18n] Could not load data/${code}.json:`, err);
    return {};
  }
}

/* ---------- Set language ---------- */
async function setLang(code){
  let lang = LANG_CODES.includes(code) ? code : 'en';

  // load from cache or embedded or fetch
  if (!(lang in I18N_CACHE)) {
    // embedded?
    if (EMBED_LANG_DATA[lang] && Object.keys(EMBED_LANG_DATA[lang]).length) {
      cacheLang(lang, EMBED_LANG_DATA[lang]);
    } else {
      // fetch
      const data = await fetchLang(lang);
      cacheLang(lang, data);
    }
  }

  applyTranslations(lang);

  // update lang attr + widget flag + dataset + localStorage
  document.documentElement.lang = lang;
  const mainBtn = document.getElementById('lang-main-btn');
  if (mainBtn){
    mainBtn.textContent = LANG_FLAGS[lang] || LANG_FLAGS.en;
    mainBtn.setAttribute('aria-label', 'Change language (current: ' + lang.toUpperCase() + ')');
  }
  const widget = document.getElementById('lang-widget');
  if (widget) widget.dataset.current = lang;
  try { localStorage.setItem('siteLang', lang); } catch(_) {}

  buildLangMenu(lang);
  console.log('[i18n] Language set to', lang);
}

/* ---------- Detect initial language ---------- */
function detectInitialLang() {
  // ?lang=xx
  const params = new URLSearchParams(window.location.search);
  const qp = params.get('lang');
  if (qp && LANG_CODES.includes(qp.toLowerCase())) return qp.toLowerCase();

  // saved
  try {
    const stored = localStorage.getItem('siteLang');
    if (stored && LANG_CODES.includes(stored)) return stored;
  } catch(_) {}

  // browser prefs
  const browserLangs = navigator.languages || [navigator.language || navigator.userLanguage];
  for (const bl of browserLangs) {
    const code = (bl || '').slice(0,2).toLowerCase();
    if (LANG_CODES.includes(code)) return code;
  }
  return 'en';
}

/* ===========================================================
   CONTACT FORM
=========================================================== */
function initContactForm(){
  const form = document.getElementById('contact-form');
  if(!form) return;
  const thanksEl = document.getElementById('contact-form-thanks');
  let hideTimer = null;

  function currentLang(){
    const widget = document.getElementById('lang-widget');
    return widget ? widget.dataset.current || 'en' : 'en';
  }
  function getThankYouMsg(){
    const lang = currentLang();
    const dict = mergedDict(lang);
    return dict.formThankYou || FALLBACK_EN.formThankYou;
  }
  function showThanks(){
    if(!thanksEl) return;
    thanksEl.textContent = getThankYouMsg();
    thanksEl.classList.add('show');
    if(hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hideThanks,5000);
  }
  function hideThanks(){
    if(!thanksEl) return;
    thanksEl.classList.remove('show');
  }
  if(thanksEl){ thanksEl.addEventListener('click', hideThanks); }

  form.addEventListener('submit',async(e)=>{
    e.preventDefault();
    const data = new FormData(form);
    try{
      const resp = await fetch(form.action,{
        method:'POST',
        body:data,
        headers:{'Accept':'application/json'}
      });
      if(!resp.ok){
        console.error('Formspree error',resp.status);
      }
      form.reset();
      showThanks();
    }catch(err){
      console.error('Form submit failed',err);
      showThanks();
    }
  });
}

/* ===========================================================
   GALLERY
=========================================================== */
function initGallery(){
  const GALLERY_IMAGES = [
    'gallery/img1.png',
    'gallery/img2.png',
    'gallery/img3.png',
    'gallery/img4.png'
  ];
  const AUTO_INTERVAL_MS = 5000;

  const slidesWrap = document.getElementById('gallery-slides');
  const dotsWrap   = document.getElementById('gallery-dots');
  const slider     = document.getElementById('gallery-slider');
  const viewport   = document.getElementById('gallery-viewport');
  const btnPrev    = slider ? slider.querySelector('.gallery-arrow-prev') : null;
  const btnNext    = slider ? slider.querySelector('.gallery-arrow-next') : null;
  let current = 0;
  let autoTimer = null;
  let isPaused = false;

  if(!(slidesWrap && dotsWrap)) return;

  function buildSlides(){
    GALLERY_IMAGES.forEach((src, idx) => {
      const slide = document.createElement('div');
      slide.className = 'gallery-slide';
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Gallery image ' + (idx+1);
      slide.appendChild(img);
      slidesWrap.appendChild(slide);

      const dot = document.createElement('button');
      dot.className = 'gallery-dot';
      dot.type = 'button';
      dot.setAttribute('aria-label','Go to slide '+(idx+1));
      dot.addEventListener('click',() => goTo(idx,true));
      dotsWrap.appendChild(dot);
    });
  }
  function updateDots(){
    [...dotsWrap.children].forEach((dot,i)=>{
      if(i===current){
        dot.classList.add('active');
        dot.setAttribute('aria-current','true');
      } else {
        dot.classList.remove('active');
        dot.removeAttribute('aria-current');
      }
    });
  }
  function goTo(index, userInitiated=false){
    const count = GALLERY_IMAGES.length;
    current = (index + count) % count;
    const offset = -current * 100;
    slidesWrap.style.transform = `translateX(${offset}%)`;
    updateDots();
    if(userInitiated) restartAuto();
  }
  function next(){goTo(current+1);}
  function prev(){goTo(current-1);}
  function startAuto(){
    stopAuto();
    autoTimer = setInterval(()=>{if(!isPaused) next();}, AUTO_INTERVAL_MS);
  }
  function stopAuto(){if(autoTimer){clearInterval(autoTimer);autoTimer=null;}}
  function restartAuto(){startAuto();}
  function setPaused(state){isPaused = state;}

  if(slider){
    slider.addEventListener('mouseenter',()=>setPaused(true));
    slider.addEventListener('mouseleave',()=>setPaused(false));
    slider.addEventListener('pointerdown',()=>setPaused(true));
    slider.addEventListener('pointerup',()=>setPaused(false));
    slider.addEventListener('pointercancel',()=>setPaused(false));
  }
  if(btnPrev) btnPrev.addEventListener('click',()=>{prev();restartAuto();});
  if(btnNext) btnNext.addEventListener('click',()=>{next();restartAuto();});
  if(viewport){
    viewport.addEventListener('click', e => {
      const rect = viewport.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 2) { prev(); } else { next(); }
      restartAuto();
    });
  }
  // swipe
  (function addSwipe(){
    const vp = viewport;
    if (!vp) return;
    let startX = 0, lastX = 0, dragging = false, swiped = false;
    const MIN_FRAC = 0.15;
    vp.addEventListener('pointerdown', e => {
      startX = e.clientX;
      lastX = startX;
      dragging = true;
      swiped = false;
    });
    vp.addEventListener('pointermove', e => { if(dragging) lastX = e.clientX; });
    function endPointer(){
      if(!dragging) return;
      dragging = false;
      const dx = lastX - startX;
      const w = vp.getBoundingClientRect().width;
      if(Math.abs(dx) > w*MIN_FRAC){
        swiped = true;
        if(dx < 0) next(); else prev();
        restartAuto();
      }
    }
    vp.addEventListener('pointerup', endPointer);
    vp.addEventListener('pointercancel', endPointer);
    vp.addEventListener('lostpointercapture', endPointer);
    vp.addEventListener('click', e=>{
      if(swiped){ e.preventDefault(); e.stopPropagation(); swiped=false; }
    });
  })();

  buildSlides();
  goTo(0);
  startAuto();
}

/* ===========================================================
   ON DOM READY
=========================================================== */
document.addEventListener('DOMContentLoaded', () => {

  // footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // embedded language data
  readEmbeddedLangData();
  // prime cache with embedded
  for (const code of LANG_CODES) {
    if (EMBED_LANG_DATA[code]) cacheLang(code, EMBED_LANG_DATA[code]);
  }

  // main button toggler
  const mainBtn = document.getElementById('lang-main-btn');
  if(mainBtn) mainBtn.addEventListener('click',()=>{ toggleLangMenu(); });

  // detect & set initial
  const lang = detectInitialLang();
  setLang(lang);  // async allowed; we don't await

  // init gallery + form
  initGallery();
  initContactForm();
});

/* ===========================================================
   FORCE TOP reset (load + manual)
=========================================================== */
(function ensureTopOnLoad(){
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  window.scrollTo(0,0);
  window.addEventListener('load', () => window.scrollTo(0,0));
})();
