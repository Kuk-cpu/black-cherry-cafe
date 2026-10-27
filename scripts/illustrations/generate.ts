import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { products } from '../menu.js';
import { drawSticker } from './system.js';
import { readManifest, writeManifest, digest } from '../media/io.js';
import type { ImageAsset } from '../../shared/media-policy.js';
await mkdir('public/menu-items', { recursive: true });
const manifest = await readManifest();
manifest.assets = manifest.assets.filter((a) => a.imageSourceType !== 'original-illustration');
for (const p of products) {
  const svg = Buffer.from(drawSticker(p));
  const originalFile = `public/menu-items/${p.id}.svg`;
  await writeFile(originalFile, svg);
  const variants = [];
  for (const width of [480, 960]) {
    const data = await sharp(svg)
      .resize(width, (width * 3) / 4)
      .webp({ quality: 86, alphaQuality: 100, effort: 5 })
      .toBuffer();
    const path = `/menu-items/${p.id}-${width}.webp`;
    await writeFile('public' + path, data);
    variants.push({ path, bytes: data.length, sha256: digest(data) });
  }
  const a: ImageAsset = {
    id: `sticker-${p.id}`,
    productIds: [p.id],
    imageSourceType: 'original-illustration',
    imageAlt: p.imageAlt!,
    originalPageUrl: null,
    originalImageUrl: null,
    author: 'Black Cherry project original code illustration',
    licence: 'Project-created original illustration',
    licenceUrl: null,
    downloadDate: null,
    commercialUse: true,
    licenceReviewRequired: false,
    originalFile,
    originalBytes: svg.length,
    originalSha256: digest(svg),
    card: variants[0],
    detail: variants[1],
    selectedCandidateId: null,
    review: null,
  };
  manifest.assets.push(a);
}
await writeManifest(manifest);
console.log(
  `Generated ${products.length} unique SVG stickers and ${products.length * 2} WebP variants. Visual review required.`,
);
