/**
 * Utility functions for optimization and formatting
 */

/**
 * Optimizes image URLs (especially Unsplash) by appending format/quality/width parameters.
 * Replaces direct heavy assets with compressed WebP formats and optimized sizes to reduce LCP.
 */
export function getOptimizedImageUrl(url: string, width = 800, quality = 80): string {
  if (!url) return '';
  
  // Trim and safely decode/re-encode the URL to handle raw spaces or special characters safely
  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith('/') && !formattedUrl.startsWith('data:image/')) {
    try {
      formattedUrl = encodeURI(decodeURI(formattedUrl));
    } catch (e) {
      // Fallback to original formatted if encoding/decoding throws
    }
  }

  // If the URL is a relative path (like /uploads/...) or data URI, return as-is
  if (formattedUrl.startsWith('/') || formattedUrl.startsWith('data:image/')) {
    return formattedUrl;
  }
  
  // Check if it's a direct image file extension
  const isDirectImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(formattedUrl);
  
  // Route non-direct image URLs (e.g., sharing links, kommodo.ai) through our backend resolver
  if (formattedUrl.includes('kommodo.ai') || !isDirectImage) {
    return `/api/resolve-image?url=${encodeURIComponent(formattedUrl)}`;
  }
  
  // Handing Unsplash URLs for WebP conversion and resizing
  if (formattedUrl.includes('images.unsplash.com')) {
    try {
      const parsedUrl = new URL(formattedUrl);
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
      let optimized = formattedUrl.replace(/auto=[a-zA-Z0-9,]+/g, 'fm=webp');
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
  
  return formattedUrl;
}
