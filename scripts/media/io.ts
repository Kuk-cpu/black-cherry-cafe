import { createHash } from 'node:crypto';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { imageManifestSchema, type ImageManifest } from '../../shared/media-policy.js';
export const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');
export async function readManifest(root = process.cwd()) {
  return imageManifestSchema.parse(
    JSON.parse(await readFile(path.join(root, 'src/data/imageSources.json'), 'utf8')),
  );
}
export async function writeManifest(data: ImageManifest, root = process.cwd()) {
  await writeFile(
    path.join(root, 'src/data/imageSources.json'),
    JSON.stringify(imageManifestSchema.parse(data), null, 2) + '\n',
  );
}
export async function safeFile(root: string, relative: string) {
  const base = await realpath(root);
  const filename = await realpath(path.resolve(base, relative));
  if (filename !== base && !filename.startsWith(base + path.sep))
    throw new Error('File escapes the allowed directory');
  return filename;
}
