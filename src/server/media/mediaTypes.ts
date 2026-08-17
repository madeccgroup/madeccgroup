/**
 * MADECC AI Studio
 * Media type utilities
 *
 * Centralized MIME-type validation, media categorization,
 * and file-extension mapping.
 */

export type MediaCategory =
  | "image"
  | "audio"
  | "video"
  | "document"
  | "text"
  | "subtitle"
  | "other";

/**
 * MIME types accepted by the MADECC AI Studio media layer.
 */
export const allowedMimeTypes = new Set<string>([
  // Images
  "image/png",
  "image/jpeg",
  "image/webp",

  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",

  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",

  // Documents
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  // Text
  "text/plain",
  "text/markdown",
  "text/csv",

  // Subtitles
  "application/x-subrip",
  "text/vtt",
]);

/**
 * Normalize a MIME type before validation or lookup.
 */
function normalizeMime(mime: string): string {
  return mime.trim().toLowerCase();
}

/**
 * Check whether a MIME type is supported by MADECC AI Studio.
 */
export function isAllowedMimeType(mime: string): boolean {
  return allowedMimeTypes.has(normalizeMime(mime));
}

/**
 * Determine the media category from a MIME type.
 */
export function mediaCategoryFromMime(
  mime: string
): MediaCategory {
  const normalizedMime = normalizeMime(mime);

  if (normalizedMime.startsWith("image/")) {
    return "image";
  }

  if (normalizedMime.startsWith("audio/")) {
    return "audio";
  }

  if (normalizedMime.startsWith("video/")) {
    return "video";
  }

  if (
    normalizedMime === "application/pdf" ||
    normalizedMime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "document";
  }

  if (
    normalizedMime === "text/plain" ||
    normalizedMime === "text/markdown" ||
    normalizedMime === "text/csv"
  ) {
    return "text";
  }

  if (
    normalizedMime === "application/x-subrip" ||
    normalizedMime === "text/vtt"
  ) {
    return "subtitle";
  }

  return "other";
}

/**
 * Convert a supported MIME type into its preferred file extension.
 *
 * Returns "bin" for unknown MIME types.
 */
export function extensionFromMime(
  mime: string
): string {
  const map: Record<string, string> = {
    // Images
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",

    // Audio
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/webm": "webm",

    // Video
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",

    // Documents
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",

    // Text
    "text/plain": "txt",
    "text/markdown": "md",
    "text/csv": "csv",

    // Subtitles
    "application/x-subrip": "srt",
    "text/vtt": "vtt",
  };

  return map[normalizeMime(mime)] || "bin";
}
