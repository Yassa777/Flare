# clear_redis_stream.py
import os
import asyncio
from dotenv import load_dotenv
from redis.asyncio import from_url as redis_from_url

async def main():
    load_dotenv() # Load .env from the current directory (python-worker)

    redis_url = os.getenv("UPSTASH_REDIS_URL")
    stream_key = os.getenv("REDIS_MENTIONS_STREAM_KEY", "mentions_stream")

    if not redis_url:
        print("Error: UPSTASH_REDIS_URL not found in .env file.")
        return

    print(f"Attempting to connect to Redis at: {redis_url}")
    print(f"Attempting to delete stream key: {stream_key}")

    try:
        redis_client = redis_from_url(redis_url)
        await redis_client.ping() # Verify connection
        print("Successfully connected to Redis.")

        deleted_count = await redis_client.delete(stream_key)

        if deleted_count > 0:
            print(f"Successfully deleted Redis stream key: '{stream_key}' (and its associated consumer groups).")
        else:
            print(f"Redis stream key '{stream_key}' not found or already deleted.")
        
        await redis_client.close()
        print("Redis connection closed.")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(main())