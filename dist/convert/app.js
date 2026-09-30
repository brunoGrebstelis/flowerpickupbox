import { initVtracer, vectorize_rgba } from './vendor/vtracer-wasm.mjs';

const ALPHA_THRESHOLD = 128;
const INK_THRESHOLD = 220;
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
let tracingReady;
let uploadedSvg;

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
  const width = Number.parseFloat(root.getAttribute('width')) || viewBox?.[2];
  const height = Number.parseFloat(root.getAttribute('height')) || viewBox?.[3];
  if (!width || !height) throw new Error('SVG has no usable dimensions');
  return { width, height };
}
function sizedSvg() {
  const root = new DOMParser().parseFromString(uploadedSvg.text, 'image/svg+xml').documentElement;
  root.setAttribute('width', widthInput.value); root.setAttribute('height', heightInput.value);
  return new XMLSerializer().serializeToString(root);
}
function setSvgSize(changed) {
  if (!uploadedSvg) return;
  const entered = Number.parseFloat(changed === 'width' ? widthInput.value : heightInput.value); if (!entered || entered <= 0) return;
  if (changed === 'width') heightInput.value = Math.round(entered / uploadedSvg.ratio); else widthInput.value = Math.round(entered * uploadedSvg.ratio);
  svgPreview.innerHTML = sizedSvg();
}
async function handleSvgFiles(files) {
  const file = files.find((item) => item.type === 'image/svg+xml' || /\.svg$/i.test(item.name)); if (!file) return;
  try {
    const text = await file.text(); const dimensions = readSvgDimensions(text);
    uploadedSvg = { text, name: file.name, ratio: dimensions.width / dimensions.height };
    svgFileName.textContent = file.name; originalSize.textContent = `${Math.round(dimensions.width)} × ${Math.round(dimensions.height)} px`; aspectRatio.textContent = `${uploadedSvg.ratio.toFixed(3)} : 1`;
    widthInput.value = Math.round(dimensions.width); heightInput.value = Math.round(dimensions.height); svgPreview.innerHTML = text; sizePanel.hidden = false;
  } catch (error) { console.error(error); svgDropZone.querySelector('p').innerHTML = '<strong>That SVG could not be read.</strong> Please try another file.'; }
}
widthInput.addEventListener('input', () => setSvgSize('width'));
heightInput.addEventListener('input', () => setSvgSize('height'));
svgDownload.addEventListener('click', () => { if (uploadedSvg) downloadText(sizedSvg(), uploadedSvg.name.replace(/\.svg$/i, '-sized.svg')); });
wireDropZone(pngDropZone, pngInput, handlePngFiles);
wireDropZone(svgDropZone, svgInput, handleSvgFiles);
