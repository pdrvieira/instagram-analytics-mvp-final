/**
 * Utility to proxy Instagram CDN images through our backend to bypass CORS restrictions.
 * Instagram blocks direct image loading from their CDN when accessed from localhost or other domains.
 * 
 * @param imageUrl - The original Instagram CDN URL
 * @returns Proxied URL through our backend, or null if URL is invalid
 */
export function getProxiedImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  
  // Only proxy Instagram CDN URLs
  if (!imageUrl.includes('fbcdn.net') && !imageUrl.includes('cdninstagram.com')) {
    return imageUrl;
  }
  
  // Create proxied URL through our backend
  const encodedUrl = encodeURIComponent(imageUrl);
  return `/api/image-proxy?url=${encodedUrl}`;
}
