import { products } from '../scripts/menu';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assetProblems,
  imageScore,
  type ImageAsset,
  type ImageManifest,
} from '../shared/media-policy';
import { placeholder, productImage, imageManifest } from '../shared/images';
import { optimizePhoto } from '../scripts/media/optimize';
import { auditImages } from '../scripts/media/audit';

function stock() {
  const candidates: ImageManifest['candidates'] = [1, 2, 3].map((n) => ({
    id: `candidate-${n}`,
    productId: 'test-only-product',
    pageUrl: `https://example.com/photo/${n}`,
    imageUrl: `https://example.com/photo/${n}.jpg`,
    author: 'Test author',
    licence: 'CC0',
    scores: { content: 90, style: 80, clarity: 90, composition: 80, licence: 100 },
    notes: 'Synthetic test fixture only',
  }));
  const asset: ImageAsset = {
    ...structuredClone(placeholder),
    id: 'test-only-photo',
    productIds: ['test-only-product'],
    imageSourceType: 'licensed-stock',
    originalPageUrl: candidates[0].pageUrl,
    originalImageUrl: candidates[0].imageUrl,
    licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    licence: 'CC0',
    author: 'Test author',
    downloadDate: '2026-10-27',
    selectedCandidateId: candidates[0].id,
    card: { ...placeholder.card, path: '/menu-images/licensed-stock/test-only-photo-480.webp' },
    detail: { ...placeholder.detail, path: '/menu-images/licensed-stock/test-only-photo-960.webp' },
  };
  return { asset, candidates };
}
describe('image admission policy', () => {
  it('uses the requested weights and requires three distinct candidate images', () => {
    const { asset, candidates } = stock();
    expect(imageScore(candidates[0].scores)).toBe(88);
    expect(assetProblems(asset, candidates)).toEqual([]);
    expect(assetProblems(asset, candidates.slice(0, 2))).toContain('FEWER_THAN_THREE_CANDIDATES');
    candidates[2].imageUrl = candidates[1].imageUrl;
    expect(assetProblems(asset, candidates)).toContain('FEWER_THAN_THREE_CANDIDATES');
  });
  it('blocks low scores, uncertain licences, watermark flags and post-review modifications', () => {
    const { asset, candidates } = stock();
    candidates[0].scores = { content: 74, style: 74, clarity: 74, composition: 74, licence: 74 };
    asset.licenceReviewRequired = true;
    asset.review!.noWatermark = false;
    expect(assetProblems(asset, candidates)).toEqual(
      expect.arrayContaining([
        'SCORE_BELOW_75',
        'LICENCE_REVIEW_REQUIRED',
        'VISUAL_REVIEW_REQUIRED',
      ]),
    );
    asset.review!.noWatermark = true;
    asset.card.sha256 = 'f'.repeat(64);
    expect(assetProblems(asset, candidates)).toContain('VISUAL_REVIEW_REQUIRED');
  });
  it('rejects other-product reuse, unverified official identity and incomplete provenance', () => {
    const { asset, candidates } = stock();
    asset.productIds.push('another-product');
    asset.originalPageUrl = null;
    expect(assetProblems(asset, candidates).join(' ')).toContain('UNRELATED_PRODUCT_REUSE');
    expect(assetProblems(asset, candidates)).toContain('INCOMPLETE_NETWORK_PROVENANCE');
    asset.imageSourceType = 'black-cherry-public';
    expect(assetProblems(asset, candidates)).toContain('OFFICIAL_IDENTITY_UNCONFIRMED');
  });
  it.each([
    'https://example.com/latte.jpg',
    '/images/coffee.svg',
    '/menu-images/real/unregistered-480.webp',
  ])('renders a safe placeholder for %s', (imageUrl) => {
    expect(productImage({ id: 'unconfirmed', imageUrl })).toEqual(placeholder);
  });
});
describe('Sharp pipeline', () => {
  it('auto-orients, creates both 4:3 sizes and removes EXIF metadata', async () => {
    const input = await sharp({
      create: { width: 720, height: 960, channels: 3, background: '#b48a61' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const outputs = await optimizePhoto(input, { left: 0, top: 0, width: 960, height: 720 });
    for (const [i, bytes] of outputs.entries()) {
      const meta = await sharp(bytes).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(i ? 960 : 480);
      expect(meta.height).toBe(i ? 720 : 360);
      expect(meta.exif).toBeUndefined();
      expect(bytes.length).toBeLessThan((i ? 350 : 150) * 1024);
    }
  });
  it('rejects vector input, low resolution and crops that lose the 4:3 ratio', async () => {
    const crop = { left: 0, top: 0, width: 960, height: 720 };
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720"><rect width="960" height="720"/></svg>',
    );
    await expect(optimizePhoto(svg, crop)).rejects.toThrow('SVG is forbidden');
    const input = await sharp({
      create: { width: 1000, height: 800, channels: 3, background: '#b48a61' },
    })
      .jpeg()
      .toBuffer();
    await expect(optimizePhoto(input, { ...crop, width: 480, height: 360 })).rejects.toThrow(
      'without enlargement',
    );
    await expect(optimizePhoto(input, { ...crop, height: 750 })).rejects.toThrow('4:3');
  });
});
describe('production media audit', () => {
  it('passes the actual registered assets and reports unconfirmed menu separately', async () => {
    const result = await auditImages(process.cwd(), imageManifest, products);
    expect(result.errors).toEqual([]);
    expect(result.errors).toHaveLength(0);
  });
  it('blocks missing files, unregistered public assets, wrong dimensions, missing alt and hotlinks', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'black-cherry-media-'));
    try {
      await mkdir(path.join(root, 'public'), { recursive: true });
      await cp('public/menu-images', path.join(root, 'public/menu-images'), { recursive: true });
      await writeFile(path.join(root, 'public/menu-images/unreviewed.jpg'), 'unreviewed');
      await rm(path.join(root, 'public', placeholder.detail.path));
      await writeFile(
        path.join(root, 'public', placeholder.card.path),
        await sharp({ create: { width: 400, height: 400, channels: 3, background: '#fff' } })
          .webp()
          .toBuffer(),
      );
      const result = await auditImages(root, { ...imageManifest, assets: [placeholder] }, [
        { id: 'test-a', imageUrl: 'https://example.com/hotlink.jpg' },
        { id: 'test-b', imageUrl: placeholder.card.path, imageSourceType: 'placeholder' },
      ]);
      const issues = result.errors.join(' ');
      for (const code of [
        'MISSING_OR_INVALID_FILE',
        'UNREGISTERED_PUBLIC_FILE',
        'WRONG_FORMAT_SIZE_OR_RATIO',
        'FILE_CHANGED_SINCE_REVIEW',
        'MISSING_IMAGE_OR_EXTERNAL_HOTLINK',
        'MISSING_ALT_TEXT',
      ])
        expect(issues).toContain(code);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
