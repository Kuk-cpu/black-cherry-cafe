import sharp from 'sharp';
import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { assetProblems, localImagePath, type ImageManifest } from '../../shared/media-policy.js';
import { digest, readManifest, safeFile } from './io.js';
export interface AuditProduct {
  id: string;
  image?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageSourceType?: string;
}
export async function auditImages(root: string, manifest: ImageManifest, products: AuditProduct[]) {
  const errors: string[] = [],
    warnings: string[] = [];
  const usedPaths = new Set<string>(),
    assetIds = new Set<string>(),
    shaProducts = new Map<string, string>();
  const actualProductIds = new Set(products.map((p) => p.id));
  if (new Set(manifest.candidates.map((c) => c.id)).size !== manifest.candidates.length)
    errors.push('DUPLICATE_CANDIDATE_ID');
  for (const a of manifest.assets) {
    if (assetIds.has(a.id)) errors.push(`${a.id}: DUPLICATE_ASSET_ID`);
    assetIds.add(a.id);
    errors.push(...assetProblems(a, manifest.candidates).map((e) => `${a.id}: ${e}`));
    if (a.imageSourceType !== 'placeholder')
      for (const id of a.productIds) {
        if (!actualProductIds.has(id)) errors.push(`${a.id}: UNCONFIRMED_PRODUCT ${id}`);
        if (a.originalSha256) {
          const existing = shaProducts.get(a.originalSha256);
          if (existing && existing !== id)
            errors.push(`${a.id}: PHOTO_REUSED_FOR_DIFFERENT_PRODUCTS`);
          shaProducts.set(a.originalSha256, id);
        }
      }
    if (a.imageSourceType === 'original-illustration' && a.originalFile) {
      try {
        const source = await readFile(await safeFile(root, a.originalFile));
        const svg = source.toString('utf8');
        if (digest(source) !== a.originalSha256 || source.length !== a.originalBytes)
          errors.push(`${a.id}: ORIGINAL_CHANGED`);
        if (
          /<(?:script|foreignObject|image|style|use)\b|(?:href|on[a-z]+)\s*=|<!DOCTYPE|<!ENTITY|url\(\s*['"]?(?:https?:|data:|\/\/)/i.test(
            svg,
          )
        )
          errors.push(`${a.id}: UNSAFE_SVG`);
        const publicPath = '/' + a.originalFile.replace(/^public\//, '');
        usedPaths.add(publicPath);
      } catch {
        errors.push(`${a.id}: MISSING_ILLUSTRATION_SOURCE`);
      }
    }
    for (const [key, width, budget] of [
      ['card', 480, 150 * 1024],
      ['detail', 960, 350 * 1024],
    ] as const) {
      const v = a[key];
      if (usedPaths.has(v.path)) errors.push(`${a.id}: DUPLICATE_LOCAL_PATH ${v.path}`);
      usedPaths.add(v.path);
      try {
        const filename = await safeFile(path.join(root, 'public'), v.path.slice(1));
        const bytes = await readFile(filename);
        const meta = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
        if (meta.format !== 'webp' || meta.width !== width || meta.height !== (width * 3) / 4)
          errors.push(`${a.id}: WRONG_FORMAT_SIZE_OR_RATIO ${key}`);
        if (a.imageSourceType === 'original-illustration' && !meta.hasAlpha)
          errors.push(`${a.id}: MISSING_TRANSPARENCY ${key}`);
        if (bytes.length > budget) errors.push(`${a.id}: IMAGE_TOO_LARGE ${key}`);
        if (meta.exif || meta.xmp || meta.iptc)
          errors.push(`${a.id}: PRIVATE_METADATA_PRESENT ${key}`);
        if (v.bytes !== bytes.length || v.sha256 !== digest(bytes))
          errors.push(`${a.id}: FILE_CHANGED_SINCE_REVIEW ${key}`);
      } catch (e) {
        errors.push(
          `${a.id}: MISSING_OR_INVALID_FILE ${v.path} (${e instanceof Error ? e.message : 'unknown'})`,
        );
      }
    }
    if (
      a.imageSourceType !== 'placeholder' &&
      !products.some((p) => a.productIds.includes(p.id) && (p.image ?? p.imageUrl) === a.card.path)
    )
      warnings.push(`${a.id}: UNUSED_PRODUCT_IMAGE`);
  }
  const fallback = manifest.assets.find(
    (a) => a.id === 'brand-placeholder' && a.imageSourceType === 'placeholder',
  );
  if (!fallback) errors.push('MISSING_BRAND_PLACEHOLDER');
  for (const p of products) {
    const image = p.image ?? p.imageUrl;
    if (!image || !localImagePath.safeParse(image).success) {
      errors.push(`${p.id}: MISSING_IMAGE_OR_EXTERNAL_HOTLINK`);
      continue;
    }
    const a = manifest.assets.find((a) => a.card.path === image);
    if (!a) errors.push(`${p.id}: MISSING_SOURCE_RECORD`);
    else {
      if (a.imageSourceType !== 'placeholder' && !a.productIds.includes(p.id))
        errors.push(`${p.id}: IMAGE_PRODUCT_MISMATCH`);
      if (p.imageSourceType !== a.imageSourceType) errors.push(`${p.id}: SOURCE_TYPE_MISMATCH`);
    }
    if (!p.imageAlt?.trim()) errors.push(`${p.id}: MISSING_ALT_TEXT`);
  }
  async function walk(dir: string) {
    try {
      for (const file of await readdir(dir, { withFileTypes: true })) {
        const location = path.join(dir, file.name);
        if (file.isDirectory()) await walk(location);
        else if (file.isFile() || file.isSymbolicLink()) {
          const url =
            '/' + path.relative(path.join(root, 'public'), location).split(path.sep).join('/');
          if (!usedPaths.has(url)) errors.push(`UNREGISTERED_PUBLIC_FILE ${url}`);
        }
      }
    } catch (e) {
      errors.push(`UNREADABLE_MEDIA_DIRECTORY ${String(e)}`);
    }
  }
  await walk(path.join(root, 'public/menu-images'));
  if (manifest.assets.some((a) => a.imageSourceType === 'original-illustration'))
    await walk(path.join(root, 'public/menu-items'));
  if (!products.length) warnings.push('The menu contains no products.');
  return { errors, warnings };
}
async function main() {
  const dev = process.argv.includes('--dev'),
    root = process.cwd();
  try {
    const manifest = await readManifest(root);
    const menu = JSON.parse(await readFile(path.join(root, 'src/data/menu.json'), 'utf8')) as {
      products: AuditProduct[];
    };
    const result = await auditImages(root, manifest, menu.products);
    for (const product of menu.products) {
      const asset = manifest.assets.find(
        (a) => a.card.path === (product.image ?? product.imageUrl),
      );
      if (!asset || asset.imageSourceType !== 'original-illustration')
        result.errors.push(`${product.id}: PRODUCT_ILLUSTRATION_REQUIRED`);
    }
    for (const text of result.warnings) console.warn(`IMAGE WARNING: ${text}`);
    for (const text of result.errors)
      console.error(`${dev ? 'IMAGE WARNING' : 'IMAGE ERROR'}: ${text}`);
    console.log(
      `Image audit: ${manifest.assets.length} registered assets; ${result.errors.length} issue(s); mode=${dev ? 'development' : 'production'}.`,
    );
    if (result.errors.length && !dev) process.exitCode = 1;
  } catch (e) {
    console.error('Image audit failed:', e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/media/audit.ts'))
  await main();
