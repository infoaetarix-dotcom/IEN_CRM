import 'server-only';

import path from 'node:path';
import { readFile } from 'node:fs/promises';

/** Raw image bytes — never a bare URL/path string, react-pdf's <Image src> resolves any string via fetch(), which throws on a plain local path. */
export interface PdfLogo {
  data: Buffer;
  format: 'png' | 'jpg';
}

// Only formats react-pdf can decode without extra native tooling. A tenant
// logo in another format (SVG, WEBP) falls back to the Aetarix mark below
// rather than risk the whole document failing to render.
const SAFE_IMAGE_EXT = /\.(png|jpe?g)(\?.*)?$/i;

/**
 * Always resolve to raw image bytes ourselves rather than handing react-pdf
 * a URL or filesystem path to resolve internally — its <Image src> always
 * goes through fetch() to resolve a string source, which throws on a plain
 * local path and adds an unnecessary failure point for a remote tenant logo
 * too. Fetching/reading here gives one consistent, catchable failure mode
 * for both cases. Shared by every server-rendered PDF (Finance statements,
 * Activity reports).
 */
export async function resolvePdfLogo(logoUrl: string | null): Promise<PdfLogo | null> {
  if (logoUrl && SAFE_IMAGE_EXT.test(logoUrl)) {
    try {
      const res = await fetch(logoUrl);
      if (!res.ok) throw new Error(`logo fetch failed: ${res.status}`);
      const data = Buffer.from(await res.arrayBuffer());
      const format = /\.png(\?.*)?$/i.test(logoUrl) ? 'png' : 'jpg';
      return { data, format };
    } catch (err) {
      console.error('[pdf-logo] tenant logo fetch failed, using Aetarix mark instead', err);
    }
  }
  try {
    const data = await readFile(path.join(process.cwd(), 'public', 'icon-512.png'));
    return { data, format: 'png' };
  } catch (err) {
    console.error('[pdf-logo] Aetarix fallback mark failed to load', err);
    return null;
  }
}
