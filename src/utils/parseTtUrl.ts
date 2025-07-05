export interface TikTokUrlInfo {
  username: string;
  videoId: string;
  originalUrl: string;
}

export function parseTikTokUrl(url: string): TikTokUrlInfo {
  // Handle different TikTok URL formats
  const patterns = [
    /tiktok\.com\/@([^/]+)\/video\/(\d+)/,
    /vm\.tiktok\.com\/([A-Za-z0-9]+)/,
    /tiktok\.com\/t\/([A-Za-z0-9]+)/,
    /tiktok\.com\/v\/(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      if (pattern.source.includes('@')) {
        // Full URL format
        return {
          username: match[1],
          videoId: match[2],
          originalUrl: url
        };
      } else {
        // Short URL format - use the ID as both username and videoId
        return {
          username: 'unknown',
          videoId: match[1],
          originalUrl: url
        };
      }
    }
  }
  
  throw new Error('Invalid TikTok URL format');
}

export function generateFilename(urlInfo: TikTokUrlInfo): string {
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9-_]/g, '');
  const timestamp = Date.now();
  
  if (urlInfo.username !== 'unknown') {
    return `${sanitize(urlInfo.username)}-${urlInfo.videoId}-${timestamp}.mp4`;
  } else {
    return `tiktok-${urlInfo.videoId}-${timestamp}.mp4`;
  }
}
export interface TikTokUrlInfo {
  username: string;
  videoId: string;
  originalUrl: string;
}

export function parseTikTokUrl(url: string): TikTokUrlInfo {
  try {
    const urlObj = new URL(url);
    
    // Handle different TikTok URL formats
    if (urlObj.hostname.includes('tiktok.com')) {
      const pathParts = urlObj.pathname.split('/');
      
      // Format: https://www.tiktok.com/@username/video/123456789
      if (pathParts.includes('video')) {
        const usernameIndex = pathParts.findIndex(part => part.startsWith('@'));
        const videoIndex = pathParts.findIndex(part => part === 'video');
        
        if (usernameIndex !== -1 && videoIndex !== -1 && pathParts[videoIndex + 1]) {
          return {
            username: pathParts[usernameIndex].substring(1), // Remove @
            videoId: pathParts[videoIndex + 1],
            originalUrl: url
          };
        }
      }
    }
    
    // Handle short URLs (vm.tiktok.com, etc.)
    if (urlObj.hostname.includes('vm.tiktok.com') || urlObj.hostname.includes('vt.tiktok.com')) {
      const videoId = urlObj.pathname.split('/')[1] || 'unknown';
      return {
        username: 'unknown',
        videoId,
        originalUrl: url
      };
    }
    
    // Fallback for any TikTok URL
    return {
      username: 'unknown',
      videoId: Date.now().toString(),
      originalUrl: url
    };
    
  } catch (error) {
    // If URL parsing fails, generate fallback info
    return {
      username: 'unknown',
      videoId: Date.now().toString(),
      originalUrl: url
    };
  }
}

export function generateFilename(urlInfo: TikTokUrlInfo): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeUsername = urlInfo.username.replace(/[^a-zA-Z0-9]/g, '_');
  const safeVideoId = urlInfo.videoId.replace(/[^a-zA-Z0-9]/g, '_');
  
  return `tiktok_${safeUsername}_${safeVideoId}_${timestamp}.mp4`;
}
