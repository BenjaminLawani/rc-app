import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

const ACCENT = "#2563eb";

// Minimalist clipboard/stock glyph in white, on an accent square.
function svg({ size = 512, radius = 112, glyphScale = 12 } = {}) {
  const half = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${ACCENT}"/>
  <g transform="translate(${half},${half}) scale(${glyphScale}) translate(-12,-12)"
     fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
    <path d="M9 12h6M9 16h4"/>
  </g>
</svg>`;
}

const iconSvg = svg({ size: 512, radius: 112, glyphScale: 12 });
const maskableSvg = svg({ size: 512, radius: 0, glyphScale: 9.5 });

writeFileSync(`${OUT}/icon.svg`, iconSvg);

async function render(svgStr, size, file) {
  await sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(`${OUT}/${file}`);
  console.log("wrote", `${OUT}/${file}`);
}

await render(iconSvg, 192, "icon-192.png");
await render(iconSvg, 512, "icon-512.png");
await render(maskableSvg, 512, "maskable-512.png");
await render(iconSvg, 180, "apple-icon.png");
console.log("icons done");
