import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const runtime = 'edge'; // Opt in to Vercel Edge Runtime

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
export async function GET(request: Request) {
  if (!NEWS_API_KEY) {
    return NextResponse.json({ error: 'NEWS_API_KEY is not configured' }, { status: 500 });
  }
  if (!redis) {
    return NextResponse.json({ error: 'Redis client is not initialized. Check Upstash Redis configuration.'}, { status: 500 });
  }

  // TODO: Define your query parameters. For now, a placeholder.
  // Example: searching for "artificial intelligence" articles in English, sorted by relevancy
  const queryParams = new URLSearchParams({
    q: 'artificial intelligence',
    language: 'en',
    sortBy: 'relevancy',
    apiKey: NEWS_API_KEY,
    pageSize: '10' // Fetch fewer articles for testing/demo; adjust as needed
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

    if (articles.length === 0) {
      return NextResponse.json({ message: 'No new articles found.' }, { status: 200 });
    }

    let articlesPushed = 0;
    for (const article of articles) {
      // Construct the message payload for Redis Stream
      // Ensure all values are strings or convert them appropriately
      const messagePayload: Record<string, string> = {
        source: article.source?.name || 'Unknown',
        author: article.author || 'Unknown',
        title: article.title || '',
        description: article.description || '',
        url: article.url || '',
        urlToImage: article.urlToImage || '',
        publishedAt: article.publishedAt || new Date().toISOString(),
        content: article.content || '',
      };
      try {
        // XADD stream_key * field1 value1 [field2 value2 ...]
        // Using '*' for auto-generated ID
        await redis.xadd(REDIS_STREAM_KEY, '*', messagePayload);
        articlesPushed++;
      } catch (redisError) {
        console.error('Failed to push article to Redis Stream:', article.title, redisError);
        // Decide on error handling: continue, retry, or stop and report?
      }
    }

    return NextResponse.json({ message: `Successfully fetched ${articles.length} articles. Pushed ${articlesPushed} to Redis stream '${REDIS_STREAM_KEY}'.` }, { status: 200 });

  } catch (error) {
    console.error('Error in ingestion function:', error);
    return NextResponse.json({ error: 'Internal Server Error processing news', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 