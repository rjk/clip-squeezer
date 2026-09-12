// Usage: node scripts/export-brand.mjs /path/to/export-tools/node_modules
// Export tools: @resvg/resvg-js, opentype.js (see ../docs/branding/README.md).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(path.resolve(process.argv[2] || 'node_modules', '../package.json'));
const { Resvg } = require('@resvg/resvg-js');
const opentype = require('opentype.js');
const root = fileURLToPath(new URL('../', import.meta.url));
const brand = path.join(root, '../docs/branding');
const regular = opentype.parse(readFileSync(process.env.BRAND_FONT_REGULAR || '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf').buffer);
const bold = opentype.parse(readFileSync(process.env.BRAND_FONT_BOLD || '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf').buffer);

// Outlines keep shared artwork independent of installed fonts. The editable
// wording and layout remain in build-brand.mjs; the font files are not bundled.
function outline(svg) {
  return svg.replace(/<text ([^>]+)>([^<]+)<\/text>/g, (_, attrs, value) => {
    const attr = name => attrs.match(new RegExp(`${name}="([^"]+)"`))?.[1];
    const font = Number(attr('font-weight')) >= 600 ? bold : regular;
    const size = Number(attr('font-size'));
    let x = Number(attr('x'));
    let previous;
    return Array.from(value).map(char => {
      const glyph = font.charToGlyph(char);
      if (previous) x += font.getKerningValue(previous, glyph) * size / font.unitsPerEm;
      const p = glyph.getPath(x, Number(attr('y')), size);
      p.fill = attr('fill');
      x += glyph.advanceWidth * size / font.unitsPerEm + Number(attr('letter-spacing') || 0);
      previous = glyph;
      return p.toSVG(3);
    }).join('');
  });
}
function png(svg, size) {
  return new Resvg(svg, size ? { fitTo: { mode: 'width', value: size } } : {}).render().asPng();
}
for (const folder of ['logos', 'social']) {
  for (const file of await readdir(path.join(brand,folder))) {
    if (!file.endsWith('.svg')) continue;
    const full = path.join(brand,folder,file);
    const artwork = outline(await readFile(full,'utf8'));
    await writeFile(full,artwork);
    await writeFile(full.replace(/\.svg$/,'.png'), png(artwork));
  }
}
const app = await readFile(path.join(brand,'logos/app-icon.svg'),'utf8');
const favicon = await readFile(path.join(brand,'logos/favicon.svg'),'utf8');
const native = path.join(root,'src-tauri/icons');
const exports = path.join(brand,'app-icons');
await mkdir(exports,{recursive:true});
for (const size of [16,24,32,48,64,128,256,512,1024]) await writeFile(path.join(exports,`app-${size}.png`),png(app,size));
for (const file of await readdir(native)) {
  let size = { 'icon.png':1024, '32x32.png':32, '128x128.png':128, '128x128@2x.png':256, 'StoreLogo.png':50 }[file];
  const match = file.match(/^Square(\d+)x\d+Logo\.png$/);
  if (match) size = Number(match[1]);
  if (size) await writeFile(path.join(native,file),png(app,size));
}
function ico(artwork) {
  const sizes = [16,24,32,48,64,128,256];
  const header = Buffer.alloc(6+16*sizes.length);
  header.writeUInt16LE(1,2); header.writeUInt16LE(sizes.length,4);
  let offset = header.length;
  const images = sizes.map((size,i) => {
    const bytes = png(artwork,size); const p = 6+i*16;
    header[p] = header[p+1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1,p+4); header.writeUInt16LE(32,p+6);
    header.writeUInt32LE(bytes.length,p+8); header.writeUInt32LE(offset,p+12);
    offset += bytes.length; return bytes;
  });
  return Buffer.concat([header,...images]);
}
const chunks = Object.entries({icp4:16,icp5:32,icp6:64,ic07:128,ic08:256,ic09:512,ic10:1024}).map(([type,size]) => {
  const bytes = png(app,size); const h = Buffer.alloc(8);
  h.write(type); h.writeUInt32BE(bytes.length+8,4); return Buffer.concat([h,bytes]);
});
const h = Buffer.alloc(8); h.write('icns'); h.writeUInt32BE(8+chunks.reduce((n,c)=>n+c.length,0),4);
for (const dir of [native,exports]) {
  await writeFile(path.join(dir,'icon.ico'),ico(app));
  await writeFile(path.join(dir,'icon.icns'),Buffer.concat([h,...chunks]));
}
for (const dir of [path.join(root,'public/brand'),path.join(root,'../../clipsqueezer-site/clip-squeezer/brand')]) {
  for (const file of ['logo-horizontal.svg','logo-horizontal-reversed.svg']) await copyFile(path.join(brand,'logos',file),path.join(dir,file));
  await writeFile(path.join(dir,'favicon.ico'),ico(favicon));
  await writeFile(path.join(dir,'apple-touch-icon.png'),png(favicon,180));
  await copyFile(path.join(brand,'social/social-card.png'),path.join(dir,'social-card.png'));
}
console.log('Exported outlined SVGs, PNGs, desktop ICO/ICNS files, and web icons.');
