import { NextResponse, NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';

export const runtime = 'edge'; // Opt in to Vercel Edge Runtime

// Basic interface for NewsAPI articles for type safety
interface Article {
  source?: { id?: string | null; name?: string };
  author?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  urlToImage?: string | null;
  publishedAt?: string | null;
  content?: string | null;
}

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_ENDPOINT = 'https://newsapi.org/v2/everything'; // Example: everything endpoint

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.error('Upstash Redis environment variables are not fully configured.');
  // Depending on desired behavior, you might throw an error or allow a degraded mode
  // For an ingestion worker, failing is probably better if Redis is essential.
}

// Initialize Redis client only if variables are set
let redis: Redis | null = null;
if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  });
}

const REDIS_STREAM_KEY = process.env.REDIS_MENTIONS_STREAM_KEY || 'mentions_stream';

/**
 * Fetches news articles from NewsAPI based on a query.
 * This endpoint will be triggered by a Vercel Cron Job.
 */
export async function GET(request: NextRequest) {
  if (!NEWS_API_KEY) {
    return NextResponse.json({ error: 'NEWS_API_KEY is not configured' }, { status: 500 });
  }
  // Redis is optional for immediate return, but we'll still try to push if configured
  // if (!redis) {
  //   return NextResponse.json({ error: 'Redis client is not initialized.'}, { status: 500 });
  // }

  const searchParams = request.nextUrl.searchParams;
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ error: 'Keyword parameter is required' }, { status: 400 });
  }

  const queryParams = new URLSearchParams({
    q: keyword,
    language: 'en',
    sortBy: 'relevancy', // or 'publishedAt' for newest first
    apiKey: NEWS_API_KEY,
    pageSize: '20' // Adjust as needed
  });

  try {
    const newsApiResponse = await fetch(`${NEWS_API_ENDPOINT}?${queryParams.toString()}`);
    if (!newsApiResponse.ok) {
      const errorData = await newsApiResponse.json();
      console.error('NewsAPI Error:', errorData);
      return NextResponse.json({ error: 'Failed to fetch news from NewsAPI', details: errorData }, { status: newsApiResponse.status });
    }
    const newsData = await newsApiResponse.json();
    const articles = newsData.articles || [];

    // Asynchronously push to Redis if configured, but don't wait for it to return response to client
    if (redis && articles.length > 0) {
      const pushToRedisPromises = articles.map((article: Article) => {
        const messagePayload: Record<string, string> = {
          search_keyword: keyword, // IMPORTANT: include the search keyword
          source: article.source?.name || 'Unknown',
          author: article.author || 'Unknown',
          title: article.title || '',
          description: article.description || '',
          url: article.url || '',
          urlToImage: article.urlToImage || '',
          publishedAt: article.publishedAt || new Date().toISOString(),
          content: article.content || '',
        };
        return redis!.xadd(REDIS_STREAM_KEY, '*', messagePayload)
          .catch(redisError => console.error('Failed to push article to Redis Stream:', article.title, redisError));
      });
      // We don't await these promises here to ensure a fast response to the client
      Promise.allSettled(pushToRedisPromises).then(results => {
        const successfulPushes = results.filter(r => r.status === 'fulfilled').length;
        console.log(`Asynchronously pushed ${successfulPushes}/${articles.length} articles for keyword '${keyword}' to Redis.`);
      });
    }

    return NextResponse.json({ articles }, { status: 200 });

  } catch (error) {
    console.error('Error in news fetching/processing function:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 