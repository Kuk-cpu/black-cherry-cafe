import raw from '../src/data/imageSources.json' with { type: 'json' };
import { assetProblems, imageManifestSchema, type ImageAsset } from './media-policy.js';
export const imageManifest = imageManifestSchema.parse(raw);
export const placeholder = imageManifest.assets.find((a) => a.id === 'brand-placeholder')!;
if (!placeholder) throw new Error('Brand placeholder is missing. Run npm run images:placeholder');
export function approvedProductImages(productId: string) {
  return imageManifest.assets.filter(
    (a) =>
      (a.imageSourceType === 'placeholder' || a.productIds.includes(productId)) &&
      assetProblems(a, imageManifest.candidates).length === 0,
  );
}
export function productImage(product: {
  id: string;
  imageUrl?: string;
  image?: string;
  imageSourceType?: string;
}): ImageAsset {
  const candidate = approvedProductImages(product.id).find(
    (a) =>
      a.card.path === (product.image ?? product.imageUrl) &&
      (!product.imageSourceType || product.imageSourceType === a.imageSourceType),
  );
  return candidate ?? placeholder;
}
export function imageFields(asset: ImageAsset) {
  return {
    imageUrl: asset.card.path,
    imageDetailUrl: asset.detail.path,
    imageAlt: asset.imageAlt,
    imageSourceType: asset.imageSourceType,
  };
}
