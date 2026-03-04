import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { config } from '../config.js';

const BLOCKS_DIR = process.env.BLOB_STORAGE_DIR || join(process.cwd(), 'blobs');

function repoDir(repoId: string): string {
  return join(BLOCKS_DIR, repoId);
}

function blobPath(repoId: string, blobId: string): string {
  return join(repoDir(repoId), blobId);
}

export function computeBlobId(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function putBlob(repoId: string, content: string | Buffer): Promise<string> {
  const blobId = computeBlobId(content);
  const dir = repoDir(repoId);
  await mkdir(dir, { recursive: true });
  const path = blobPath(repoId, blobId);
  await writeFile(path, content, 'utf-8');
  return blobId;
}

export async function getBlob(repoId: string, blobId: string): Promise<string | null> {
  try {
    const path = blobPath(repoId, blobId);
    const content = await readFile(path, 'utf-8');
    return content;
  } catch {
    return null;
  }
}
