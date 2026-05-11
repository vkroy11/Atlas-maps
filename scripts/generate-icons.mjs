/**
 * Generates Atlas Offline app icons from a single SVG template.
 *
 *   icon.png            1024x1024  full-bleed app icon
 *   adaptive-icon.png   1024x1024  Android adaptive icon foreground (inner 66% safe area)
 *   splash-icon.png     1024x1024  splash screen mark (transparent bg)
 *   favicon.png         48x48      web favicon
 *
 * Run:  node scripts/generate-icons.mjs
 */
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(here, '..', 'assets');

const BG = '#0a0f0d';
const FG = '#7fa67a';
const FG_DIM = '#3a5a37';
const STROKE = '#1f3a1c';

/**
 * Full app icon — dark background, corner brackets, large centered AM monogram,
 * compass tick marks at the cardinal edges.
 */
const fullIcon = (size = 1024) => {
  const s = size;
  const bracket = s * 0.06; // length of corner-bracket arms
  const inset = s * 0.08; // margin from edge
  const tickLen = s * 0.018;
  const tickOff = s * 0.045;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${BG}"/>

  <!-- subtle frame -->
  <rect x="${s * 0.04}" y="${s * 0.04}" width="${s * 0.92}" height="${s * 0.92}"
        fill="none" stroke="${STROKE}" stroke-width="${s * 0.005}"/>

  <!-- corner brackets (tactical UI motif) -->
  <g stroke="${FG}" stroke-width="${s * 0.012}" fill="none" stroke-linecap="square">
    <!-- top-left -->
    <path d="M ${inset} ${inset + bracket} L ${inset} ${inset} L ${inset + bracket} ${inset}"/>
    <!-- top-right -->
    <path d="M ${s - inset - bracket} ${inset} L ${s - inset} ${inset} L ${s - inset} ${inset + bracket}"/>
    <!-- bottom-right -->
    <path d="M ${s - inset} ${s - inset - bracket} L ${s - inset} ${s - inset} L ${s - inset - bracket} ${s - inset}"/>
    <!-- bottom-left -->
    <path d="M ${inset + bracket} ${s - inset} L ${inset} ${s - inset} L ${inset} ${s - inset - bracket}"/>
  </g>

  <!-- cardinal tick marks -->
  <g stroke="${FG_DIM}" stroke-width="${s * 0.008}" stroke-linecap="square">
    <line x1="${s / 2}" y1="${tickOff}" x2="${s / 2}" y2="${tickOff + tickLen}"/>
    <line x1="${s / 2}" y1="${s - tickOff - tickLen}" x2="${s / 2}" y2="${s - tickOff}"/>
    <line x1="${tickOff}" y1="${s / 2}" x2="${tickOff + tickLen}" y2="${s / 2}"/>
    <line x1="${s - tickOff - tickLen}" y1="${s / 2}" x2="${s - tickOff}" y2="${s / 2}"/>
  </g>

  <!-- AM monogram -->
  <text x="${s / 2}" y="${s / 2}"
        text-anchor="middle" dominant-baseline="central"
        font-family="Helvetica, Arial, sans-serif"
        font-weight="700"
        font-size="${s * 0.46}"
        letter-spacing="${s * -0.012}"
        fill="${FG}">AM</text>

  <!-- baseline accent under monogram -->
  <line x1="${s * 0.32}" y1="${s * 0.76}" x2="${s * 0.68}" y2="${s * 0.76}"
        stroke="${FG_DIM}" stroke-width="${s * 0.005}"/>
</svg>`;
};

/**
 * Adaptive-icon foreground — same monogram, but everything pulled inside the
 * Android safe area (inner ~66%). Transparent background; Android composites
 * it over the adaptiveIcon backgroundColor from app.config.ts.
 */
const adaptiveForeground = (size = 1024) => {
  const s = size;
  const bracket = s * 0.04;
  // safe area is roughly the center 66%; design within ~640px box
  const inset = s * 0.22;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
  <g stroke="${FG}" stroke-width="${s * 0.012}" fill="none" stroke-linecap="square">
    <path d="M ${inset} ${inset + bracket} L ${inset} ${inset} L ${inset + bracket} ${inset}"/>
    <path d="M ${s - inset - bracket} ${inset} L ${s - inset} ${inset} L ${s - inset} ${inset + bracket}"/>
    <path d="M ${s - inset} ${s - inset - bracket} L ${s - inset} ${s - inset} L ${s - inset - bracket} ${s - inset}"/>
    <path d="M ${inset + bracket} ${s - inset} L ${inset} ${s - inset} L ${inset} ${s - inset - bracket}"/>
  </g>

  <text x="${s / 2}" y="${s / 2}"
        text-anchor="middle" dominant-baseline="central"
        font-family="Helvetica, Arial, sans-serif"
        font-weight="700"
        font-size="${s * 0.34}"
        letter-spacing="${s * -0.01}"
        fill="${FG}">AM</text>

  <line x1="${s * 0.38}" y1="${s * 0.66}" x2="${s * 0.62}" y2="${s * 0.66}"
        stroke="${FG_DIM}" stroke-width="${s * 0.005}"/>
</svg>`;
};

/**
 * Splash mark — same as adaptive foreground but slightly larger glyph.
 * Renders on the splash backgroundColor from app.config.ts.
 */
const splashMark = (size = 1024) => {
  const s = size;
  const inset = s * 0.28;
  const bracket = s * 0.03;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
  <g stroke="${FG}" stroke-width="${s * 0.008}" fill="none" stroke-linecap="square">
    <path d="M ${inset} ${inset + bracket} L ${inset} ${inset} L ${inset + bracket} ${inset}"/>
    <path d="M ${s - inset - bracket} ${inset} L ${s - inset} ${inset} L ${s - inset} ${inset + bracket}"/>
    <path d="M ${s - inset} ${s - inset - bracket} L ${s - inset} ${s - inset} L ${s - inset - bracket} ${s - inset}"/>
    <path d="M ${inset + bracket} ${s - inset} L ${inset} ${s - inset} L ${inset} ${s - inset - bracket}"/>
  </g>

  <text x="${s / 2}" y="${s / 2}"
        text-anchor="middle" dominant-baseline="central"
        font-family="Helvetica, Arial, sans-serif"
        font-weight="700"
        font-size="${s * 0.26}"
        letter-spacing="${s * -0.008}"
        fill="${FG}">AM</text>

  <text x="${s / 2}" y="${s * 0.72}"
        text-anchor="middle" dominant-baseline="central"
        font-family="Helvetica, Arial, sans-serif"
        font-weight="500"
        font-size="${s * 0.035}"
        letter-spacing="${s * 0.008}"
        fill="${FG_DIM}">ATLAS OFFLINE</text>
</svg>`;
};

async function render(svg, outPath, opts = {}) {
  const buf = Buffer.from(svg, 'utf-8');
  let pipeline = sharp(buf, { density: 384 });
  if (opts.size) pipeline = pipeline.resize(opts.size, opts.size);
  const out = await pipeline.png().toBuffer();
  await writeFile(outPath, out);
  console.log(`✓ wrote ${outPath} (${out.byteLength.toLocaleString()} bytes)`);
}

async function main() {
  await render(fullIcon(1024), resolve(assetsDir, 'icon.png'));
  await render(adaptiveForeground(1024), resolve(assetsDir, 'adaptive-icon.png'));
  await render(splashMark(1024), resolve(assetsDir, 'splash-icon.png'));
  await render(fullIcon(192), resolve(assetsDir, 'favicon.png'), { size: 48 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
