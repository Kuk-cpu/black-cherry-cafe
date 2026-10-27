import { useState } from 'react';
import { productImage } from '../../shared/images';
export function ProductImage({
  product,
  detail = false,
  className = '',
  eager = false,
}: {
  product: { id: string; imageUrl?: string; imageSourceType?: string };
  detail?: boolean;
  className?: string;
  eager?: boolean;
}) {
  const a = productImage(product);
  const [failedPath, setFailedPath] = useState('');
  const path = detail ? a.detail.path : a.card.path;
  const failed = failedPath === path;
  const asset = a;
  const svg =
    a.imageSourceType === 'original-illustration'
      ? '/' + a.originalFile!.replace(/^public\//, '')
      : undefined;
  if (a.imageSourceType === 'placeholder')
    return <span className="muted small">Choose a product illustration</span>;
  return (
    <img
      className={className}
      src={failed && svg ? svg : detail ? asset.detail.path : asset.card.path}
      alt={asset.imageAlt}
      width={detail ? 960 : 480}
      height={detail ? 720 : 360}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      data-image-source={asset.imageSourceType}
      onError={() => setFailedPath(path)}
    />
  );
}
