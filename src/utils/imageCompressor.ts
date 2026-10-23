/**
 * Client-Side Image Compression Utility
 * Resizes and compresses images via HTML5 Canvas into lightweight WebP/JPEG data URLs
 * Ideal for avatars/profile photos (< 30 KB) so state and localStorage remain fast.
 */

export interface CompressionResult {
  dataUrl: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  reductionPercentage: number;
  width: number;
  height: number;
}

export async function compressProfilePhoto(
  file: File,
  maxDimension: number = 256,
  quality: number = 0.82
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read photo file.'));

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => reject(new Error('Failed to load image element.'));

      img.onload = () => {
        try {
          const originalSizeBytes = file.size;

          // Determine square crop bounds to keep avatar centered without stretching
          const minSide = Math.min(img.width, img.height);
          const startX = (img.width - minSide) / 2;
          const startY = (img.height - minSide) / 2;

          const targetSize = Math.min(maxDimension, minSide);

          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas 2D context unavailable.');
          }

          // Smooth resampling quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw cropped center square
          ctx.drawImage(
            img,
            startX,
            startY,
            minSide,
            minSide,
            0,
            0,
            targetSize,
            targetSize
          );

          // Attempt WebP first (best compression ratio), fallback to JPEG
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          // Calculate approximate byte size of base64 dataUrl
          const head = dataUrl.indexOf(',') + 1;
          const compressedSizeBytes = Math.round(((dataUrl.length - head) * 3) / 4);

          const reductionPercentage = Math.max(
            0,
            Math.round(((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100)
          );

          resolve({
            dataUrl,
            originalSizeBytes,
            compressedSizeBytes,
            reductionPercentage,
            width: targetSize,
            height: targetSize,
          });
        } catch (err) {
          reject(err);
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
