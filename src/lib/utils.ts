/**
 * Utility functions for optimization and formatting
 */

/**
 * Optimizes image URLs (especially Unsplash) by appending format/quality/width parameters.
 * Replaces direct heavy assets with compressed WebP formats and optimized sizes to reduce LCP.
 */
export function getOptimizedImageUrl(url: string, width = 800, quality = 80): string {
  if (!url) return '';
  
  // If the URL is a relative path (like /uploads/...) or data URI, return as-is
  if (url.startsWith('/') || url.startsWith('data:image/')) {
    return url;
  }
  
  // Check if it's a direct image file extension
  const isDirectImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url);
  
  // Route non-direct image URLs (e.g., sharing links, kommodo.ai) through our backend resolver
  if (url.includes('kommodo.ai') || !isDirectImage) {
    return `/api/resolve-image?url=${encodeURIComponent(url)}`;
  }
  
  // Handing Unsplash URLs for WebP conversion and resizing
  if (url.includes('images.unsplash.com')) {
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.set('fm', 'webp');
      parsedUrl.searchParams.set('q', quality.toString());
      if (width) {
        parsedUrl.searchParams.set('w', width.toString());
      }
      // auto parameter can override fm, so we delete it
      parsedUrl.searchParams.delete('auto');
      return parsedUrl.toString();
    } catch (e) {
      // Fallback regex replacements if URL parsing fails
      let optimized = url.replace(/auto=[a-zA-Z0-9,]+/g, 'fm=webp');
      if (!optimized.includes('fm=webp')) {
        optimized += '&fm=webp';
      }
      if (optimized.includes('q=')) {
        optimized = optimized.replace(/q=\d+/g, `q=${quality}`);
      } else {
        optimized += `&q=${quality}`;
      }
      if (width) {
        if (optimized.includes('w=')) {
          optimized = optimized.replace(/w=\d+/g, `w=${width}`);
        } else {
          optimized += `&w=${width}`;
        }
      }
      return optimized;
    }
  }
  
  return url;
}
