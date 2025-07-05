import axios from 'axios';
import { logger } from '../utils/logger';

export interface TikTokVideoInfo {
  directUrl: string;
  title?: string;
  author?: string;
  duration?: string;
}

export class TikTokApiService {
  private readonly timeout: number;

  constructor() {
    this.timeout = Number(process.env.SERVICE_TIMEOUT_MS) || 20000;
  }

  async getDirectUrl(tiktokUrl: string): Promise<TikTokVideoInfo> {
    try {
      logger.info(`Fetching video info for: ${tiktokUrl}`);
      
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
          logger.info(`Trying ${api.name} API...`);
          
          let response;
          if (api.method === 'POST') {
            response = await axios.post(api.url, api.data, {
              timeout: this.timeout,
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
          } else {
            response = await axios.get(api.url, {
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
            const directUrl = data.hdplay || data.play || data.wmplay;
            
            if (directUrl) {
              return {
                directUrl,
                title: data.title || '',
                author: data.author?.unique_id || '',
                duration: data.duration ? `${data.duration}s` : ''
              };
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
          
        } catch (apiError) {
          logger.warn(`${api.name} API failed: ${apiError.message}`);
          continue;
        }
      }
      
      // If all APIs fail, throw an error instead of mock data
      throw new Error('Unable to fetch video information from external APIs. This may be due to:\n' +
        '1. Invalid TikTok URL format\n' +
        '2. Video privacy settings\n' +
        '3. API service temporary unavailability\n' +
        'Please try with a different public TikTok video URL.');
      
    } catch (error) {
      logger.error(`All API services failed: ${error.message}`);
      throw new Error(`Failed to get video URL: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    // No cleanup needed for API service
  }
}

export const tiktokApiService = new TikTokApiService();