import { z } from 'zod';
export const imageSourceTypes = [
  'black-cherry-original',
  'black-cherry-public',
  'licensed-stock',
  'placeholder',
  'original-illustration',
] as const;
export const localImagePath = z
  .string()
  .regex(
    /^\/(?:menu-images\/(?:real|licensed-stock|placeholders)|menu-items)\/[a-z0-9][a-z0-9-]*-(480|960)\.webp$/,
  );
const https = z
  .string()
  .url()
  .refine((value) => {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
  }, 'An HTTPS source URL is required');
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const scoresSchema = z
  .object({
    content: z.number().min(0).max(100),
    style: z.number().min(0).max(100),
    clarity: z.number().min(0).max(100),
    composition: z.number().min(0).max(100),
    licence: z.number().min(0).max(100),
  })
  .strict();
export function imageScore(s: z.infer<typeof scoresSchema>) {
  return (
    Math.round(
      (s.content * 0.35 +
        s.style * 0.25 +
        s.clarity * 0.15 +
        s.composition * 0.1 +
        s.licence * 0.15) *
        100,
    ) / 100
  );
}
export const candidateSchema = z
  .object({
    id: z.string().min(1),
    productId: z.string().min(1),
    pageUrl: https,
    imageUrl: https,
    author: z.string().min(1),
    licence: z.string().min(1),
    scores: scoresSchema,
    notes: z.string().min(1),
  })
  .strict();
const variant = z
  .object({ path: localImagePath, bytes: z.number().int().positive(), sha256: sha })
  .strict();
export const imageAssetSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    productIds: z.array(z.string().min(1)),
    imageSourceType: z.enum(imageSourceTypes),
    imageAlt: z.string().trim().min(8).max(240),
    originalPageUrl: https.nullable(),
    originalImageUrl: https.nullable(),
    author: z.string().min(1),
    licence: z.string().min(1),
    licenceUrl: https.nullable(),
    downloadDate: date.nullable(),
    commercialUse: z.boolean(),
    licenceReviewRequired: z.boolean(),
    originalFile: z.string().nullable(),
    originalBytes: z.number().int().nonnegative(),
    originalSha256: sha.nullable(),
    card: variant,
    detail: variant,
    selectedCandidateId: z.string().nullable(),
    review: z
      .object({
        reviewer: z.string().min(1),
        date,
        contentMatches: z.boolean(),
        styleConsistent: z.boolean(),
        noWatermark: z.boolean(),
        noOtherBrand: z.boolean(),
        subjectIntact: z.boolean(),
        officialIdentityConfirmed: z.boolean(),
        attributionComplete: z.boolean(),
        cardSha256: sha,
        detailSha256: sha,
        notes: z.string().min(1),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const imageManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    assets: z.array(imageAssetSchema),
    candidates: z.array(candidateSchema),
  })
  .strict();
export type ImageAsset = z.infer<typeof imageAssetSchema>;
export type ImageManifest = z.infer<typeof imageManifestSchema>;
export function assetProblems(a: ImageAsset, candidates: ImageManifest['candidates']): string[] {
  const issues: string[] = [];
  if (!a.commercialUse || a.licenceReviewRequired) issues.push('LICENCE_REVIEW_REQUIRED');
  const r = a.review;
  if (
    !r ||
    !r.contentMatches ||
    !r.styleConsistent ||
    !r.noWatermark ||
    !r.noOtherBrand ||
    !r.subjectIntact ||
    !r.attributionComplete ||
    r.cardSha256 !== a.card.sha256 ||
    r.detailSha256 !== a.detail.sha256
  )
    issues.push('VISUAL_REVIEW_REQUIRED');
  if (a.imageSourceType !== 'placeholder' && !a.productIds.length)
    issues.push('NO_PRODUCT_MAPPING');
  if (a.productIds.length > 1 && a.imageSourceType !== 'placeholder')
    issues.push('UNRELATED_PRODUCT_REUSE: one reviewed photo per product');
  if (a.imageSourceType === 'black-cherry-public' && !r?.officialIdentityConfirmed)
    issues.push('OFFICIAL_IDENTITY_UNCONFIRMED');
  if (a.imageSourceType === 'black-cherry-public' || a.imageSourceType === 'licensed-stock') {
    if (
      !a.originalPageUrl ||
      !a.originalImageUrl ||
      !a.licenceUrl ||
      !a.downloadDate ||
      !a.originalFile ||
      !a.originalSha256 ||
      !a.originalBytes
    )
      issues.push('INCOMPLETE_NETWORK_PROVENANCE');
    const selected = candidates.find((c) => c.id === a.selectedCandidateId);
    if (
      !selected ||
      !a.productIds.includes(selected.productId) ||
      selected.pageUrl !== a.originalPageUrl ||
      selected.imageUrl !== a.originalImageUrl ||
      selected.author !== a.author ||
      selected.licence !== a.licence
    )
      issues.push('CANDIDATE_SOURCE_MISMATCH');
    if (!selected || imageScore(selected.scores) < 75) issues.push('SCORE_BELOW_75');
    if (
      a.productIds.some(
        (productId) =>
          new Set(candidates.filter((c) => c.productId === productId).map((c) => c.imageUrl)).size <
          3,
      )
    )
      issues.push('FEWER_THAN_THREE_CANDIDATES');
  }
  if (a.imageSourceType === 'original-illustration') {
    if (!a.originalFile?.startsWith('public/menu-items/') || !a.originalSha256 || !a.originalBytes)
      issues.push('MISSING_ILLUSTRATION_SOURCE');
    if (!a.card.path.startsWith('/menu-items/') || !a.detail.path.startsWith('/menu-items/'))
      issues.push('WRONG_SOURCE_DIRECTORY');
    return issues;
  }
  const folder =
    a.imageSourceType === 'placeholder'
      ? 'placeholders'
      : a.imageSourceType === 'licensed-stock'
        ? 'licensed-stock'
        : 'real';
  if (
    !a.card.path.startsWith(`/menu-images/${folder}/`) ||
    !a.detail.path.startsWith(`/menu-images/${folder}/`)
  )
    issues.push('WRONG_SOURCE_DIRECTORY');
  return issues;
}
