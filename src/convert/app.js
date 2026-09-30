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
const svgInput = document.querySelector('#svg-input');
const svgDropZone = document.querySelector('#svg-drop-zone');
const sizePanel = document.querySelector('#size-panel');
const svgPreview = document.querySelector('#svg-preview');
const svgFileName = document.querySelector('#svg-file-name');
const originalSize = document.querySelector('#original-size');
const aspectRatio = document.querySelector('#aspect-ratio');
const widthInput = document.querySelector('#svg-width');
const heightInput = document.querySelector('#svg-height');
const svgDownload = document.querySelector('#svg-download');
const sizeUnit = document.querySelector('#size-unit');
const reverseColours = document.querySelector('#reverse-colours');
let tracingReady;
let uploadedSvg;
let displayUnit = 'px';

function ensureTracer() { if (!tracingReady) tracingReady = initVtracer(); return tracingReady; }
function wireDropZone(zone, input, onFiles) {
  ['dragenter', 'dragover'].forEach((name) => zone.addEventListener(name, (event) => { event.preventDefault(); zone.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach((name) => zone.addEventListener(name, (event) => { event.preventDefault(); zone.classList.remove('is-dragging'); }));
  zone.addEventListener('drop', (event) => onFiles([...event.dataTransfer.files]));
  input.addEventListener('change', () => onFiles([...input.files]));
  zone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') input.click(); });
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
function downloadText(contents, filename) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'image/svg+xml' })); const link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function addConversionResult(name, result) {
  const card = resultTemplate.content.firstElementChild.cloneNode(true);
  card.querySelector('.result-preview').innerHTML = result.svg;
  card.querySelector('.result-name').textContent = name;
  card.querySelector('.result-dimensions').textContent = `${result.width} × ${result.height}`;
  card.querySelector('button').addEventListener('click', () => downloadText(result.svg, `${name.replace(/\.png$/i, '')}.svg`));
  resultGrid.prepend(card);
}
async function handlePngFiles(files) {
  const pngFiles = files.filter((file) => file.type === 'image/png' || /\.png$/i.test(file.name));
  if (!pngFiles.length) { conversionStatus.textContent = 'Choose one or more PNG files.'; return; }
  conversionStatus.textContent = `Preparing ${pngFiles.length} file${pngFiles.length === 1 ? '' : 's'}…`;
  try {
    await ensureTracer(); let complete = 0;
    for (const file of pngFiles) { conversionStatus.textContent = `Converting ${file.name} (${complete + 1} of ${pngFiles.length})…`; addConversionResult(file.name, await convertPng(file)); complete += 1; }
    conversionStatus.textContent = `${complete} SVG${complete === 1 ? '' : 's'} ready to download.`;
  } catch (error) { console.error(error); conversionStatus.textContent = 'Conversion could not finish. Try a smaller PNG or refresh the page.'; }
}
function readSvgDimensions(text) {
  const root = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  if (root.nodeName === 'parsererror' || root.nodeName.toLowerCase() !== 'svg') throw new Error('Invalid SVG');
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number);
  const parseLength = (attribute, fallback) => {
    const match = attribute?.trim().match(/^([0-9.]+)\s*(mm|px)?$/i);
    if (!match) return fallback;
    const value = Number(match[1]);
    return match[2]?.toLowerCase() === 'mm' ? value / MM_PER_PX : value;
  };
  const width = parseLength(root.getAttribute('width'), viewBox?.[2]);
  const height = parseLength(root.getAttribute('height'), viewBox?.[3]);
  if (!width || !height) throw new Error('SVG has no usable dimensions');
  return { width, height };
}
function roundForUnit(value) { return sizeUnit.value === 'mm' ? Number(value.toFixed(2)) : Math.round(value); }
function pixelsToUnit(value) { return sizeUnit.value === 'mm' ? value * MM_PER_PX : value; }
function unitToPixels(value) { return sizeUnit.value === 'mm' ? value / MM_PER_PX : value; }
function setDimensionInputs(widthPx, heightPx) {
  widthInput.value = roundForUnit(pixelsToUnit(widthPx));
  heightInput.value = roundForUnit(pixelsToUnit(heightPx));
}
function applyReverseColours(root) {
  if (!reverseColours.checked) return;
  const namespace = 'http://www.w3.org/2000/svg';
  const documentRef = root.ownerDocument;
  let defs = [...root.children].find((child) => child.localName === 'defs');
  if (!defs) { defs = documentRef.createElementNS(namespace, 'defs'); root.prepend(defs); }
  const filter = documentRef.createElementNS(namespace, 'filter');
  filter.setAttribute('id', 'converter-reverse-colours');
  filter.setAttribute('x', '-10%'); filter.setAttribute('y', '-10%');
  filter.setAttribute('width', '120%'); filter.setAttribute('height', '120%');
  const matrix = documentRef.createElementNS(namespace, 'feColorMatrix');
  matrix.setAttribute('type', 'matrix');
  matrix.setAttribute('values', '-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0');
  filter.append(matrix); defs.append(filter);
  const content = documentRef.createElementNS(namespace, 'g');
  content.setAttribute('filter', 'url(#converter-reverse-colours)');
  [...root.children].filter((child) => child !== defs).forEach((child) => content.append(child));
  root.append(content);
}
function sizedSvg() {
  const root = new DOMParser().parseFromString(uploadedSvg.text, 'image/svg+xml').documentElement;
  root.setAttribute('width', `${widthInput.value}${sizeUnit.value}`);
  root.setAttribute('height', `${heightInput.value}${sizeUnit.value}`);
  applyReverseColours(root);
  return new XMLSerializer().serializeToString(root);
}
function setSvgSize(changed) {
  if (!uploadedSvg) return;
  const entered = unitToPixels(Number.parseFloat(changed === 'width' ? widthInput.value : heightInput.value)); if (!entered || entered <= 0) return;
  if (changed === 'width') heightInput.value = roundForUnit(pixelsToUnit(entered / uploadedSvg.ratio)); else widthInput.value = roundForUnit(pixelsToUnit(entered * uploadedSvg.ratio));
  svgPreview.innerHTML = sizedSvg();
}
async function handleSvgFiles(files) {
  const file = files.find((item) => item.type === 'image/svg+xml' || /\.svg$/i.test(item.name)); if (!file) return;
  try {
    const text = await file.text(); const dimensions = readSvgDimensions(text);
    uploadedSvg = { text, name: file.name, ratio: dimensions.width / dimensions.height };
    svgFileName.textContent = file.name;
    originalSize.textContent = `${Math.round(dimensions.width)} × ${Math.round(dimensions.height)} px (${(dimensions.width * MM_PER_PX).toFixed(2)} × ${(dimensions.height * MM_PER_PX).toFixed(2)} mm)`;
    aspectRatio.textContent = `${uploadedSvg.ratio.toFixed(3)} : 1`;
    setDimensionInputs(dimensions.width, dimensions.height); svgPreview.innerHTML = text; sizePanel.hidden = false;
  } catch (error) { console.error(error); svgDropZone.querySelector('p').innerHTML = '<strong>That SVG could not be read.</strong> Please try another file.'; }
}
widthInput.addEventListener('input', () => setSvgSize('width'));
heightInput.addEventListener('input', () => setSvgSize('height'));
sizeUnit.addEventListener('change', () => {
  if (!uploadedSvg) return;
  const widthPx = Number.parseFloat(widthInput.value) * (displayUnit === 'mm' ? 1 / MM_PER_PX : 1);
  const heightPx = Number.parseFloat(heightInput.value) * (displayUnit === 'mm' ? 1 / MM_PER_PX : 1);
  setDimensionInputs(widthPx, heightPx);
  displayUnit = sizeUnit.value;
  svgPreview.innerHTML = sizedSvg();
});
reverseColours.addEventListener('change', () => { if (uploadedSvg) svgPreview.innerHTML = sizedSvg(); });
svgDownload.addEventListener('click', () => { if (uploadedSvg) downloadText(sizedSvg(), uploadedSvg.name.replace(/\.svg$/i, '-sized.svg')); });
wireDropZone(pngDropZone, pngInput, handlePngFiles);
wireDropZone(svgDropZone, svgInput, handleSvgFiles);
