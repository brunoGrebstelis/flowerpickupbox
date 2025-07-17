/* ===========================================================
   LANGUAGE DATA (embedded in HTML)
=========================================================== */
let EMBED_LANG_DATA = {};
(function(){
  const script = document.getElementById('lang-data');
  if (script) {
    try {
      EMBED_LANG_DATA = JSON.parse(script.textContent.trim() || '{}');
    } catch(err){
      console.error('Failed to parse embedded language data:', err);
      EMBED_LANG_DATA = {};
    }
  }
})();

const LANG_CODES = ['en','lv','ru','de'];
const LANG_FLAGS = { en:'🇬🇧', lv:'🇱🇻', ru:'🇷🇺', de:'🇩🇪' };

/* Minimal fallback English (covers all keys we render) */
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

  /* new spec table */
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

/* Map translation keys -> DOM IDs */
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

/* Build language cache from embedded data */
const I18N_CACHE = { ...EMBED_LANG_DATA };
if (!I18N_CACHE.en) {
  I18N_CACHE.en = FALLBACK_EN;
}

/* ===========================================================
   Scroll / top-of-page
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

/* Footer year */
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});

/* ===========================================================
   Gallery slider (unchanged from last working version)
=========================================================== */
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

function buildSlides(){
  if(!slidesWrap || !dotsWrap) return;
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
  if(!dotsWrap) return;
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
  if(slidesWrap) slidesWrap.style.transform = `translateX(${offset}%)`;
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
if(slidesWrap && dotsWrap){
  buildSlides();
  goTo(0);
  startAuto();
}
// swipe
(function addGallerySwipe(){
  const vp = document.getElementById('gallery-viewport');
  if (!vp) return;
  let startX = 0;
  let lastX = 0;
  let dragging = false;
  let swiped = false;
  const MIN_SWIPE_FRAC = 0.15;
  vp.addEventListener('pointerdown', e => {
    startX = e.clientX;
    lastX = startX;
    dragging = true;
    swiped = false;
  });
  vp.addEventListener('pointermove', e => {
    if (!dragging) return;
    lastX = e.clientX;
  });
  function endPointer() {
    if (!dragging) return;
    dragging = false;
    const dx = lastX - startX;
    const rect = vp.getBoundingClientRect();
    const thresh = rect.width * MIN_SWIPE_FRAC;
    if (Math.abs(dx) > thresh) {
      swiped = true;
      if (dx < 0) { next(); } else { prev(); }
      restartAuto();
    }
  }
  vp.addEventListener('pointerup', endPointer);
  vp.addEventListener('pointercancel', endPointer);
  vp.addEventListener('lostpointercapture', endPointer);
  vp.addEventListener('click', e => {
    if (swiped) {
      e.preventDefault();
      e.stopPropagation();
      swiped = false;
    }
  });
})();

/* ===========================================================
   Translation helpers
=========================================================== */
function getLangDict(lang){
  return (I18N_CACHE[lang] && Object.keys(I18N_CACHE[lang]).length)
    ? I18N_CACHE[lang]
    : FALLBACK_EN;
}

function applyTranslations(dict){
  for (const [key, id] of Object.entries(I18N_MAP)){
    const el = document.getElementById(id);
    if (!el) continue;
    // use innerHTML so <br> works in spec values
    el.innerHTML = dict[key] || FALLBACK_EN[key] || '';
  }
  // update thanks bubble text if visible
  const thanksEl = document.getElementById('contact-form-thanks');
  if (thanksEl && thanksEl.classList.contains('show')) {
    thanksEl.textContent = dict.formThankYou || FALLBACK_EN.formThankYou;
  }
}

async function setLang(lang){
  if(!LANG_CODES.includes(lang)) lang = 'en';
  const dict = getLangDict(lang);
  applyTranslations(dict);
  const mainBtn = document.getElementById('lang-main-btn');
  if (mainBtn){
    mainBtn.textContent = LANG_FLAGS[lang] || LANG_FLAGS.en;
    mainBtn.setAttribute('aria-label', 'Change language (current: ' + lang.toUpperCase() + ')');
  }
  const widget = document.getElementById('lang-widget');
  if (widget) widget.dataset.current = lang;
  try { localStorage.setItem('siteLang', lang); } catch(_){}
  buildLangMenu(lang);
}

function buildLangMenu(current){
  const menu = document.getElementById('lang-options');
  if(!menu) return;
  menu.innerHTML = '';
  LANG_CODES.forEach(code=>{
    if(code===current) return;
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

/* init language controls */
document.addEventListener('DOMContentLoaded',()=>{
  const mainBtn = document.getElementById('lang-main-btn');
  if(mainBtn) mainBtn.addEventListener('click',()=>{ toggleLangMenu(); });

  let lang = 'en';
  try {
    const stored = localStorage.getItem('siteLang');
    if (stored && LANG_CODES.includes(stored)) lang = stored;
  } catch(_){}

  setLang(lang);
});

/* ===========================================================
   Contact Form
=========================================================== */
(function initContactForm(){
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
    const dict = getLangDict(lang);
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
  if(thanksEl){
    thanksEl.addEventListener('click',hideThanks);
  }

  form.addEventListener('submit',async(e)=>{
    e.preventDefault();
    const data = new FormData(form);
    try{
      const resp = await fetch(form.action,{
        method:'POST',
        body:data,
        headers:{'Accept':'application/json'}
      });
      form.reset();
      showThanks();
      if(!resp.ok){
        console.error('Formspree error',resp.status);
      }
    }catch(err){
      console.error('Form submit failed',err);
      showThanks();
    }
  });
})();
