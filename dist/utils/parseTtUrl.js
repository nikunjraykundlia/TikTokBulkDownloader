"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTikTokUrl = parseTikTokUrl;
exports.generateFilename = generateFilename;
function parseTikTokUrl(url) {
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
            }
            else {
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
function generateFilename(urlInfo) {
    const sanitize = (str) => str.replace(/[^a-zA-Z0-9-_]/g, '');
    const timestamp = Date.now();
    if (urlInfo.username !== 'unknown') {
        return `${sanitize(urlInfo.username)}-${urlInfo.videoId}-${timestamp}.mp4`;
    }
    else {
        return `tiktok-${urlInfo.videoId}-${timestamp}.mp4`;
    }
}
