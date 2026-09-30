import { initVtracer, vectorize_rgba } from './vendor/vtracer-wasm.mjs';

const ALPHA_THRESHOLD = 128;
const INK_THRESHOLD = 220;
const MM_PER_PX = 25.4 / 96;
const tracerOptions = { clustering: 'bw', mode: 'spline', filterSpeckle: 8, binaryThreshold: 128, pathPrecision: 4, simplify: 1 };
const pngInput = document.querySelector('#png-input');
const pngDropZone = document.querySelector('#png-drop-zone');
const conversionStatus = document.querySelector('#conversion-status');
const resultGrid = document.querySelector('#conversion-results');
const resultTemplate = document.querySelector('#result-template');
const convertActions = document.querySelector('#convert-actions');
const zipDownload = document.querySelector('#zip-download');
const svgInput = document.querySelector('#svg-input');
const svgDropZone = document.querySelector('#svg-drop-zone');
const svgItems = document.querySelector('#svg-items');
const svgItemTemplate = document.querySelector('#svg-item-template');
const navigationLinks = [...document.querySelectorAll('.classic-nav a[data-section]')];
const toolSections = [...document.querySelectorAll('.tool-section')];
const convertedFiles = [];
let tracingReady;

function ensureTracer() { if (!tracingReady) tracingReady = initVtracer(); return tracingReady; }
function wireDropZone(zone, input, onFiles) {
  ['dragenter', 'dragover'].forEach((name) => zone.addEventListener(name, (event) => { event.preventDefault(); zone.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach((name) => zone.addEventListener(name, (event) => { event.preventDefault(); zone.classList.remove('is-dragging'); }));
  zone.addEventListener('drop', (event) => onFiles([...event.dataTransfer.files]));
  input.addEventListener('change', () => onFiles([...input.files]));
  zone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') input.click(); });
}
function showSection(sectionId) {
  toolSections.forEach((section) => { section.hidden = section.id !== sectionId; });
  navigationLinks.forEach((link) => link.classList.toggle('is-active', link.dataset.section === sectionId));
}
function isGrayscale(pixels) {
  for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - pixels[i + 1]) > 2 || Math.abs(pixels[i + 1] - pixels[i + 2]) > 2) return false;
  return true;
}
function makeTracePixels(source) {
  let hasTransparency = false;
  for (let i = 3; i < source.length; i += 4) if (source[i] < 255) { hasTransparency = true; break; }
  if (!hasTransparency && !isGrayscale(source)) return { pixels: source, options: { preset: 'poster' } };
  const output = new Uint8ClampedArray(source.length);
  for (let i = 0; i < source.length; i += 4) {
    const brightness = Math.round(source[i] * .299 + source[i + 1] * .587 + source[i + 2] * .114);
    const ink = hasTransparency ? source[i + 3] >= ALPHA_THRESHOLD : brightness <= INK_THRESHOLD;
    output[i] = output[i + 1] = output[i + 2] = ink ? 255 : 0;
    output[i + 3] = 255;
  }
  return { pixels: output, options: tracerOptions };
}
async function convertPng(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(bitmap, 0, 0); bitmap.close();
  const trace = makeTracePixels(context.getImageData(0, 0, canvas.width, canvas.height).data);
  await ensureTracer();
  return { svg: vectorize_rgba(trace.pixels, canvas.width, canvas.height, trace.options), width: canvas.width, height: canvas.height };
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function downloadText(contents, filename) { downloadBlob(new Blob([contents], { type: 'image/svg+xml' }), filename); }
function updateConvertActions() { convertActions.hidden = convertedFiles.length === 0; }
function removeConverted(item, card) {
  const index = convertedFiles.indexOf(item); if (index !== -1) convertedFiles.splice(index, 1);
  card.remove(); updateConvertActions();
}
function addConversionResult(name, result) {
  const item = { name: `${name.replace(/\.png$/i, '')}.svg`, svg: result.svg, width: result.width, height: result.height };
  convertedFiles.push(item); updateConvertActions();
  const card = resultTemplate.content.firstElementChild.cloneNode(true);
  card.querySelector('.result-preview').innerHTML = item.svg;
  card.querySelector('.result-name').textContent = item.name;
  card.querySelector('.result-dimensions').textContent = `${item.width} x ${item.height}`;
  card.querySelector('.remove-file').addEventListener('click', () => removeConverted(item, card));
  card.querySelector('.download-button').addEventListener('click', () => downloadText(item.svg, item.name));
  card.querySelector('.move-to-svg').addEventListener('click', () => {
    addSvgItem(item);
    removeConverted(item, card);
    history.replaceState(null, '', '#svg'); showSection('svg');
  });
  resultGrid.prepend(card);
}
async function handlePngFiles(files) {
  const pngFiles = files.filter((file) => file.type === 'image/png' || /\.png$/i.test(file.name));
  if (!pngFiles.length) { conversionStatus.textContent = 'Choose one or more PNG files.'; return; }
  conversionStatus.textContent = `Preparing ${pngFiles.length} file${pngFiles.length === 1 ? '' : 's'}...`;
  try {
    await ensureTracer(); let complete = 0;
    for (const file of pngFiles) { conversionStatus.textContent = `Converting ${file.name} (${complete + 1} of ${pngFiles.length})...`; addConversionResult(file.name, await convertPng(file)); complete += 1; }
    conversionStatus.textContent = `${complete} SVG${complete === 1 ? '' : 's'} ready.`;
  } catch (error) { console.error(error); conversionStatus.textContent = 'Conversion could not finish. Try a smaller PNG or refresh the page.'; }
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ -1) >>> 0;
}
function writeUint16(view, offset, value) { view.setUint16(offset, value, true); }
function writeUint32(view, offset, value) { view.setUint32(offset, value, true); }
function createZip(files) {
  const encoder = new TextEncoder(); const chunks = []; const centralDirectory = []; let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name); const data = encoder.encode(file.svg); const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length); const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50); writeUint16(localView, 4, 20); writeUint16(localView, 6, 0x0800); writeUint16(localView, 8, 0);
    writeUint32(localView, 14, crc); writeUint32(localView, 18, data.length); writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, name.length); writeUint16(localView, 28, 0); local.set(name, 30); local.set(data, 30 + name.length); chunks.push(local);
    const central = new Uint8Array(46 + name.length); const centralView = new DataView(central.buffer);
    writeUint32(centralView, 0, 0x02014b50); writeUint16(centralView, 4, 20); writeUint16(centralView, 6, 20); writeUint16(centralView, 8, 0x0800); writeUint16(centralView, 10, 0);
    writeUint32(centralView, 16, crc); writeUint32(centralView, 20, data.length); writeUint32(centralView, 24, data.length); writeUint16(centralView, 28, name.length); writeUint32(centralView, 42, offset); central.set(name, 46);
    centralDirectory.push(central); offset += local.length;
  }
  const centralSize = centralDirectory.reduce((total, chunk) => total + chunk.length, 0); const end = new Uint8Array(22); const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50); writeUint16(endView, 8, files.length); writeUint16(endView, 10, files.length); writeUint32(endView, 12, centralSize); writeUint32(endView, 16, offset);
  return new Blob([...chunks, ...centralDirectory, end], { type: 'application/zip' });
}

function readSvgDimensions(text) {
  const root = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  if (root.nodeName === 'parsererror' || root.nodeName.toLowerCase() !== 'svg') throw new Error('Invalid SVG');
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number);
  const length = (attribute, fallback) => { const match = attribute?.trim().match(/^([0-9.]+)\s*(mm|px)?$/i); if (!match) return fallback; return match[2]?.toLowerCase() === 'mm' ? Number(match[1]) / MM_PER_PX : Number(match[1]); };
  const width = length(root.getAttribute('width'), viewBox?.[2]); const height = length(root.getAttribute('height'), viewBox?.[3]);
  if (!width || !height) throw new Error('SVG has no usable dimensions'); return { width, height };
}
function svgForState(state) {
  const root = new DOMParser().parseFromString(state.text, 'image/svg+xml').documentElement;
  const scale = state.unit === 'mm' ? MM_PER_PX : 1;
  root.setAttribute('width', `${state.widthPx * scale}${state.unit}`); root.setAttribute('height', `${state.heightPx * scale}${state.unit}`);
  if (state.mirror) {
    const namespace = 'http://www.w3.org/2000/svg'; const viewBox = root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number); const x = viewBox?.[0] || 0; const width = viewBox?.[2] || state.originalWidth;
    const group = root.ownerDocument.createElementNS(namespace, 'g'); group.setAttribute('transform', `translate(${(2 * x) + width} 0) scale(-1 1)`);
    [...root.children].filter((child) => child.localName !== 'defs').forEach((child) => group.append(child)); root.append(group);
  }
  return new XMLSerializer().serializeToString(root);
}
function addSvgItem(file) {
  const dimensions = readSvgDimensions(file.svg); const state = { text: file.svg, name: file.name, originalWidth: dimensions.width, originalHeight: dimensions.height, widthPx: dimensions.width, heightPx: dimensions.height, unit: 'px', mirror: false };
  const card = svgItemTemplate.content.firstElementChild.cloneNode(true); const preview = card.querySelector('.svg-preview'); const unit = card.querySelector('.size-unit'); const widthInput = card.querySelector('.svg-width'); const heightInput = card.querySelector('.svg-height'); const mirror = card.querySelector('.mirror-svg'); const unitLabels = [...card.querySelectorAll('.dimension-unit')];
  const setFields = () => { const scale = state.unit === 'mm' ? MM_PER_PX : 1; widthInput.value = state.unit === 'mm' ? (state.widthPx * scale).toFixed(2) : Math.round(state.widthPx); heightInput.value = state.unit === 'mm' ? (state.heightPx * scale).toFixed(2) : Math.round(state.heightPx); unitLabels.forEach((label) => { label.textContent = state.unit; }); };
  const render = () => { setFields(); preview.innerHTML = svgForState(state); };
  card.querySelector('.file-name').textContent = state.name; card.querySelector('.original-size').textContent = `${Math.round(state.originalWidth)} x ${Math.round(state.originalHeight)} px (${(state.originalWidth * MM_PER_PX).toFixed(2)} x ${(state.originalHeight * MM_PER_PX).toFixed(2)} mm)`; card.querySelector('.aspect-ratio').textContent = `${(state.originalWidth / state.originalHeight).toFixed(3)} : 1`;
  widthInput.addEventListener('input', () => { const value = Number(widthInput.value); if (value > 0) { state.widthPx = state.unit === 'mm' ? value / MM_PER_PX : value; state.heightPx = state.widthPx / (state.originalWidth / state.originalHeight); render(); } });
  heightInput.addEventListener('input', () => { const value = Number(heightInput.value); if (value > 0) { state.heightPx = state.unit === 'mm' ? value / MM_PER_PX : value; state.widthPx = state.heightPx * (state.originalWidth / state.originalHeight); render(); } });
  unit.addEventListener('change', () => { state.unit = unit.value; render(); });
  mirror.addEventListener('change', () => { state.mirror = mirror.checked; render(); });
  card.querySelector('.remove-file').addEventListener('click', () => card.remove());
  card.querySelector('.download-button').addEventListener('click', () => downloadText(svgForState(state), state.name.replace(/\.svg$/i, '-sized.svg')));
  svgItems.prepend(card); render();
}
async function handleSvgFiles(files) {
  const svgFiles = files.filter((file) => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name));
  for (const file of svgFiles) { try { addSvgItem({ name: file.name, svg: await file.text() }); } catch (error) { console.error(error); } }
}

zipDownload.addEventListener('click', () => downloadBlob(createZip(convertedFiles), 'converted-svgs.zip'));
navigationLinks.forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); history.replaceState(null, '', link.hash); showSection(link.dataset.section); }));
showSection(location.hash === '#svg' ? 'svg' : 'convert');
wireDropZone(pngDropZone, pngInput, handlePngFiles);
wireDropZone(svgDropZone, svgInput, handleSvgFiles);
