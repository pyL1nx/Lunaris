/**
 * Image Cache — Memoryless WebP Compression Pipeline
 *
 * Uses the Canvas API to dynamically compress PNG/JPG images to WebP
 * in-memory via Object URLs.
 * 
 * V1.3.1 ZERO-BLOAT UPDATE:
 * This utility no longer caches Blobs persistently. It is a pure, memoryless
 * conversion function. The caller (BackgroundLayer) is responsible for taking
 * the returned Object URL, giving it to the <img> tag, and immediately calling
 * URL.revokeObjectURL() on the <img>'s onLoad event.
 */

// Track in-flight compressions to dedup parallel requests for the SAME url
const pendingCompressions = new Map<string, Promise<string>>();

const DEFAULT_QUALITY = 0.8;

/**
 * Compress an image URL to WebP using the Canvas API.
 *
 * Returns a Blob Object URL of the compressed image.
 * The canvas is rendered at the FULL native resolution of the source image.
 */
export async function compressToWebP(
  src: string,
  quality: number = DEFAULT_QUALITY
): Promise<string> {
  // Dedup: if this URL is already being compressed, wait for that result
  const pending = pendingCompressions.get(src);
  if (pending) return pending;

  const compressionPromise = new Promise<string>((resolve) => {
    const img = new Image();
    // Required for asset:// URLs in Tauri WebView2
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const objectUrl = URL.createObjectURL(blob);
              resolve(objectUrl);
            } else {
              resolve(src);
            }

            // Free canvas memory
            canvas.width = 0;
            canvas.height = 0;
          },
          'image/webp',
          quality
        );
      } catch {
        resolve(src);
      }
    };

    img.onerror = () => {
      resolve(src);
    };

    img.src = src;
  });

  pendingCompressions.set(src, compressionPromise);
  const result = await compressionPromise;
  pendingCompressions.delete(src);

  return result;
}

// Stubs for previous interface to prevent compilation errors in gameStore
export function evictFromCache(_src: string): void {}
export async function preloadAndCompress(_urls: string[]): Promise<void> {}
export function isCached(_src: string): boolean { return false; }
export function clearCache(): void {}
export function getCacheSize(): number { return 0; }
