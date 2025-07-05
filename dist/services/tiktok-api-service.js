"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tiktokApiService = exports.TikTokApiService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class TikTokApiService {
    timeout;
    constructor() {
        this.timeout = Number(process.env.SERVICE_TIMEOUT_MS) || 20000;
    }
    async getDirectUrl(tiktokUrl) {
        try {
            logger_1.logger.info(`Fetching video info for: ${tiktokUrl}`);
            // Try multiple API services
            const apiServices = [
                {
                    name: 'TikWM',
                    url: 'https://tikwm.com/api/',
                    method: 'POST',
                    data: { url: tiktokUrl, hd: 1 }
                },
                {
                    name: 'SnapTik Alternative',
                    url: 'https://www.tiktok.com/oembed',
                    method: 'GET',
                    params: { url: tiktokUrl }
                }
            ];
            for (const api of apiServices) {
                try {
                    logger_1.logger.info(`Trying ${api.name} API...`);
                    let response;
                    if (api.method === 'POST') {
                        response = await axios_1.default.post(api.url, api.data, {
                            timeout: this.timeout,
                            headers: {
                                'Content-Type': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        });
                    }
                    else {
                        response = await axios_1.default.get(api.url, {
                            params: api.params,
                            timeout: this.timeout,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        });
                    }
                    // Handle TikWM response
                    if (api.name === 'TikWM' && response.data && response.data.code === 0 && response.data.data) {
                        const data = response.data.data;
                        // Prefer HD, then regular play, then watermarked as last resort
                        const directUrl = data.hdplay || data.play || data.wmplay;
                        if (directUrl) {
                            // Validate the URL is actually a video URL
                            if (directUrl.includes('.mp4') || directUrl.includes('video') || directUrl.includes('tiktok')) {
                                logger_1.logger.success(`Found valid video URL: ${directUrl.substring(0, 50)}...`);
                                return {
                                    directUrl,
                                    title: data.title || '',
                                    author: data.author?.unique_id || '',
                                    duration: data.duration ? `${data.duration}s` : ''
                                };
                            }
                            else {
                                logger_1.logger.warn(`Invalid video URL format: ${directUrl}`);
                            }
                        }
                    }
                    // Handle TikTok oEmbed response
                    if (api.name === 'SnapTik Alternative' && response.data) {
                        // This is a basic fallback that provides metadata
                        return {
                            directUrl: tiktokUrl, // Fallback to original URL
                            title: response.data.title || 'TikTok Video',
                            author: response.data.author_name || 'Unknown',
                            duration: ''
                        };
                    }
                }
                catch (apiError) {
                    logger_1.logger.warn(`${api.name} API failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
                    continue;
                }
            }
            // If all APIs fail, throw an error instead of mock data
            throw new Error('Unable to fetch video information from external APIs. This may be due to:\n' +
                '1. Invalid TikTok URL format\n' +
                '2. Video privacy settings\n' +
                '3. API service temporary unavailability\n' +
                'Please try with a different public TikTok video URL.');
        }
        catch (error) {
            logger_1.logger.error(`All API services failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw new Error(`Failed to get video URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async close() {
        // No cleanup needed for API service
    }
}
exports.TikTokApiService = TikTokApiService;
exports.tiktokApiService = new TikTokApiService();
