import { writeFile } from 'node:fs/promises';
import { products, categories } from '../menu.js';
import { productImage } from '../../shared/images.js';
const row = (values: unknown[]) =>
  '| ' + values.map((v) => String(v).replaceAll('|', '\\|')).join(' | ') + ' |';
const art = products.map(productImage);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
await writeFile(
  'docs/image-sources.md',
  [
    '# Black Cherry Café — illustration register',
    '',
    'Internal asset maintenance record. Product illustrations live in public/menu-items/.',
    '',
    '| Category | Products |',
    '| --- | --- |',
    ...categories.map((c) => row([c.name, products.filter((p) => p.categoryId === c.id).length])),
    '',
    `Original SVG files: ${art.length}. Card WebP total: ${sum(art.map((a) => a.card.bytes))} bytes. Detail WebP total: ${sum(art.map((a) => a.detail.bytes))} bytes.`,
    '',
    '| Product | AUD | SVG | Card | Detail |',
    '| --- | --- | --- | --- | --- |',
    ...products.map((p) => {
      const a = productImage(p);
      return row([
        p.name,
        (p.basePrice / 100).toFixed(2),
        a.originalFile,
        a.card.path,
        a.detail.path,
      ]);
    }),
    '',
    'Canvas: 4:3. Transparent backgrounds, rounded outlines, consistent palette and shadows. Image registry: src/data/imageSources.json. Source generator: scripts/illustrations/system.ts.',
    '',
    'npm run images:illustrate regenerates assets and clears visual review. Inspect outputs, update review hashes, then run npm run images:audit before publication.',
    '',
  ].join('\n'),
);
console.log('Illustration register updated.');
