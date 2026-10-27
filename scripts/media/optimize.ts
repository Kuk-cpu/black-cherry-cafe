import sharp from 'sharp';
import { z } from 'zod';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { imageAssetSchema, type ImageAsset } from '../../shared/media-policy.js';
import { digest, readManifest, safeFile, writeManifest } from './io.js';
const planSchema = z.array(
  z
    .object({
      asset: imageAssetSchema.omit({
        card: true,
        detail: true,
        review: true,
        originalBytes: true,
        originalSha256: true,
      }),
      crop: z
        .object({
          left: z.number().int().nonnegative(),
          top: z.number().int().nonnegative(),
          width: z.number().int().min(960),
          height: z.number().int().min(720),
        })
        .strict(),
    })
    .strict(),
);
export async function optimizePhoto(
  input: Buffer,
  crop: z.infer<typeof planSchema>[number]['crop'],
) {
  if (crop.width < 960 || crop.height < 720 || crop.left < 0 || crop.top < 0)
    throw new Error('Crop must provide at least 960 by 720 pixels without enlargement');
  if (input.length > 20 * 1024 * 1024) throw new Error('Input exceeds 20 MB');
  const raw = sharp(input, { limitInputPixels: 40_000_000, failOn: 'warning' });
  const meta = await raw.metadata();
  if (!['jpeg', 'png', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) > 1)
    throw new Error(
      'Only single-frame JPEG, PNG or WebP photographs are accepted; SVG is forbidden',
    );
  const upright = await raw.autoOrient().toBuffer();
  const oriented = await sharp(upright).metadata();
  if (crop.left + crop.width > oriented.width! || crop.top + crop.height > oriented.height!)
    throw new Error('Crop is outside the auto-rotated image');
  if (crop.width * 3 !== crop.height * 4) throw new Error('A reviewed 4:3 crop is required');
  const results: Buffer[] = [];
  for (const width of [480, 960]) {
    let result: Buffer | undefined;
    for (const quality of [84, 78, 72, 66, 60]) {
      const bytes = await sharp(upright)
        .extract(crop)
        .resize(width, (width * 3) / 4, { withoutEnlargement: true })
        .webp({ quality, effort: 5 })
        .toBuffer();
      if (bytes.length <= (width === 480 ? 150 : 350) * 1024) {
        result = bytes;
        break;
      }
    }
    if (!result)
      throw new Error(`Unable to meet ${width}px size budget; choose a less complex photograph`);
    results.push(result);
  }
  return results;
}
export async function runPlan(planPath: string) {
  const plan = planSchema.parse(JSON.parse(await readFile(planPath, 'utf8')));
  if (!plan.length) {
    console.log('No approved photographs queued. No files changed.');
    return;
  }
  const menu = JSON.parse(await readFile('src/data/menu.json', 'utf8')) as {
    products: { id: string }[];
  };
  const ids = new Set(menu.products.map((p) => p.id));
  const manifest = await readManifest();
  for (const { asset: source, crop } of plan) {
    if (
      source.imageSourceType === 'placeholder' ||
      source.imageSourceType === 'original-illustration'
    )
      throw new Error('Use the dedicated illustration or placeholder generator');
    if (!source.productIds.length || source.productIds.some((id) => !ids.has(id)))
      throw new Error(`Only registered menu products can be processed: ${source.id}`);
    if (!source.originalFile?.startsWith('references/product-originals/'))
      throw new Error('Originals must be downloaded into references/product-originals/ first');
    const file = await safeFile(
      path.join(process.cwd(), 'references/product-originals'),
      source.originalFile.slice('references/product-originals/'.length),
    );
    const input = await readFile(file);
    const output = await optimizePhoto(input, crop);
    const folder = source.imageSourceType === 'licensed-stock' ? 'licensed-stock' : 'real';
    const target = `public/menu-images/${folder}`;
    await mkdir(target, { recursive: true });
    const variants = [];
    for (const [index, width] of [480, 960].entries()) {
      const localPath = `/menu-images/${folder}/${source.id}-${width}.webp`;
      await writeFile('public' + localPath, output[index]);
      variants.push({
        path: localPath,
        bytes: output[index].length,
        sha256: digest(output[index]),
      });
    }
    const asset: ImageAsset = {
      ...source,
      originalBytes: input.length,
      originalSha256: digest(input),
      card: variants[0],
      detail: variants[1],
      review: null,
    };
    manifest.assets = manifest.assets.filter((a) => a.id !== asset.id);
    manifest.assets.push(asset);
  }
  await writeManifest(manifest);
  console.log(
    'Images optimized; final visual review is pending. Production audit will block these files until review is recorded.',
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/media/optimize.ts'))
  await runPlan(process.argv[2] ?? 'references/image-processing-plan.json');
