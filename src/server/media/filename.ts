/**
 * MADECC AI Studio
 * Secure filename utilities.
 *
 * Used for generated media, uploads, exports,
 * Cloudinary public IDs, and downloaded files.
 */

/**
 * Convert an arbitrary filename into a safe filesystem/API filename.
 *
 * - Normalizes Unicode characters.
 * - Removes unsafe characters.
 * - Converts whitespace to underscores.
 * - Collapses repeated underscores.
 * - Limits the filename to 180 characters.
 * - Uses a safe fallback when the result is empty.
 */
export function safeFilename(
  input: string,
  fallback = "madecc-media"
): string {
  const clean = String(input ?? "")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");

  return clean.slice(0, 180) || fallback;
}


/**
 * Add a file extension if it is not already present.
 *
 * Accepts extensions with or without a leading dot:
 *
 * withExtension("report", "pdf")
 * -> "report.pdf"
 *
 * withExtension("report", ".pdf")
 * -> "report.pdf"
 *
 * withExtension("report.pdf", "pdf")
 * -> "report.pdf"
 */
export function withExtension(
  filename: string,
  extension: string
): string {
  const cleanFilename = String(filename ?? "").trim();
  const cleanExtension = String(extension ?? "").trim();

  if (!cleanFilename) {
    return cleanFilename;
  }

  if (!cleanExtension) {
    return cleanFilename;
  }

  const normalizedExtension = cleanExtension.startsWith(".")
    ? cleanExtension
    : `.${cleanExtension}`;

  if (
    cleanFilename
      .toLowerCase()
      .endsWith(normalizedExtension.toLowerCase())
  ) {
    return cleanFilename;
  }

  return `${cleanFilename}${normalizedExtension}`;
}
