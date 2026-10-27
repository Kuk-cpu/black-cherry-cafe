import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { digest, readManifest, writeManifest } from './io.js';
import type { ImageAsset } from '../../shared/media-policy.js';
// Original vector artwork: a neutral cup and plate, explicitly not a product photograph or official logo.
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720"><rect width="960" height="720" fill="#faf8f3"/><g fill="none" stroke="#582330" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M334 279h237v117q0 64-118 64t-119-64z"/><path d="M572 297h25q61 0 61 53t-61 53h-25"/><ellipse cx="453" cy="482" rx="184" ry="30"/><path d="M401 234q-20-24 0-48m59 48q-20-24 0-48m59 48q-20-24 0-48"/></g><path d="M365 560h210" stroke="#302b29" stroke-width="2"/></svg>`,
);
await mkdir('public/menu-images/placeholders', { recursive: true });
const variants = [];
for (const width of [480, 960]) {
  const data = await sharp(svg)
    .resize(width, (width * 3) / 4)
    .webp({ quality: 84 })
    .toBuffer();
  const path = `/menu-images/placeholders/brand-placeholder-${width}.webp`;
  await writeFile('public' + path, data);
  variants.push({ path, bytes: data.length, sha256: digest(data) });
}
const [card, detail] = variants;
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date());
const asset: ImageAsset = {
  id: 'brand-placeholder',
  productIds: [],
  imageSourceType: 'placeholder',
  imageAlt: 'Cup and plate line illustration; product photograph not available',
  originalPageUrl: null,
  originalImageUrl: null,
  author: 'Black Cherry project original line artwork',
  licence: 'Project-created placeholder artwork',
  licenceUrl: null,
  downloadDate: null,
  commercialUse: true,
  licenceReviewRequired: false,
  originalFile: 'scripts/media/placeholder.ts',
  originalBytes: svg.length,
  originalSha256: digest(svg),
  card,
  detail,
  selectedCandidateId: null,
  review: {
    reviewer: 'Project artwork inspection',
    date,
    contentMatches: true,
    styleConsistent: true,
    noWatermark: true,
    noOtherBrand: true,
    subjectIntact: true,
    officialIdentityConfirmed: false,
    attributionComplete: true,
    cardSha256: card.sha256,
    detailSha256: detail.sha256,
    notes:
      'Original generic line artwork, not a photograph or a claim about the official Black Cherry logo.',
  },
};
const manifest = await readManifest();
manifest.assets = manifest.assets.filter((a) => a.id !== asset.id);
manifest.assets.push(asset);
await writeManifest(manifest);
console.log(`Placeholder generated: ${card.bytes} + ${detail.bytes} bytes.`);
