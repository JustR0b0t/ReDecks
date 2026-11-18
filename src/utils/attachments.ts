const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** Image extensions offered by the image pickers (e.g. image occlusion). */
export const IMAGE_EXTENSIONS = Object.keys(IMAGE_MIME);

/** MIME type for an image extension, or null when unsupported. */
export function imageMime(ext: string): string | null {
  return IMAGE_MIME[ext.toLowerCase()] ?? null;
}

/** File extension for an image MIME type, or null when unsupported. */
export function extForMime(mimeType: string): string | null {
  const mime = mimeType.toLowerCase();
  for (const [ext, m] of Object.entries(IMAGE_MIME)) {
    if (m === mime) return ext;
  }
  return null;
}
