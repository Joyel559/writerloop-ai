import JSZip from 'jszip';

export type CbzPageAsset = {
  page: number;
  path: string;
  url: string;
};

const IMAGE_PATH_PATTERN = /\.(avif|bmp|gif|jpe?g|png|webp)$/i;
const IGNORED_ENTRY_PATTERN = /^(__MACOSX\/|\.DS_Store$)/i;
const PATH_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const normalizePath = (path: string) => path.replace(/\\/g, '/');

function isRenderableImagePath(path: string): boolean {
  const normalized = normalizePath(path).trim();
  if (!normalized) return false;
  if (IGNORED_ENTRY_PATTERN.test(normalized)) return false;
  return IMAGE_PATH_PATTERN.test(normalized);
}

function sortImagePaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => PATH_COLLATOR.compare(a, b));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL.'));
    reader.readAsDataURL(blob);
  });
}

async function readCbzImageFiles(content: ArrayBuffer): Promise<Array<{ path: string; file: JSZip.JSZipObject }>> {
  const zip = await JSZip.loadAsync(content.slice(0));
  const imageEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir && isRenderableImagePath(entry.name))
    .map((entry) => ({ path: normalizePath(entry.name), file: entry }));

  return imageEntries.sort((a, b) => PATH_COLLATOR.compare(a.path, b.path));
}

export function isCbzFilename(fileName: string): boolean {
  return /\.cbz$/i.test((fileName || '').trim());
}

export async function extractCbzCoverDataUrl(content: ArrayBuffer): Promise<string | undefined> {
  const entries = await readCbzImageFiles(content);
  const first = entries[0];
  if (!first) return undefined;

  const blob = await first.file.async('blob');
  return blobToDataUrl(blob);
}

export async function extractCbzPageAssets(content: ArrayBuffer): Promise<CbzPageAsset[]> {
  const entries = await readCbzImageFiles(content);
  const assets: CbzPageAsset[] = [];

  for (let i = 0; i < entries.length; i += 1) {
    const item = entries[i];
    const blob = await item.file.async('blob');
    const url = URL.createObjectURL(blob);
    assets.push({
      page: i + 1,
      path: item.path,
      url,
    });
  }

  return assets;
}

export function revokeCbzAssets(assets: CbzPageAsset[]) {
  assets.forEach((item) => {
    URL.revokeObjectURL(item.url);
  });
}

export function summarizeCbzFileName(fileName: string): string {
  const clean = (fileName || '').trim().replace(/\.cbz$/i, '');
  return clean || 'Untitled Comic';
}

export function listCbzImagePaths(contentPaths: string[]): string[] {
  return sortImagePaths(contentPaths.filter((path) => isRenderableImagePath(path)));
}
