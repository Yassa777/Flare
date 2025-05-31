import asyncio
import os
import httpx
import redis.asyncio as redis # Using asyncio version of redis library
from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv
from supabase import create_client, Client as SupabaseClient # Renamed to avoid conflict
import openai # Import OpenAI
import json # For parsing OpenAI response

# Load environment variables from .env file in the python-worker directory
load_dotenv()

# --- Configuration --- 
UPSTASH_REDIS_URL = os.getenv("UPSTASH_REDIS_URL") # Different from REST URL, usually redis://...
UPSTASH_REDIS_PASSWORD = os.getenv("UPSTASH_REDIS_PASSWORD") # Often part of the URL or separate
REDIS_STREAM_KEY = os.getenv("REDIS_MENTIONS_STREAM_KEY", "mentions_stream")
# Group name and consumer name for the stream
REDIS_CONSUMER_GROUP_NAME = os.getenv("REDIS_CONSUMER_GROUP_NAME", "mentions_processor_group")
REDIS_CONSUMER_NAME_PREFIX = os.getenv("REDIS_CONSUMER_NAME_PREFIX", "consumer_")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") # Use service key for backend operations

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL_NAME = os.getenv("OPENAI_MODEL_NAME", "gpt-4o-mini")

# --- Initialize Clients --- 
app = FastAPI(title="Mentions Processor Worker")
redis_client: redis.Redis | None = None
supabase_client: SupabaseClient | None = None
openai_client: openai.AsyncOpenAI | None = None # Async OpenAI client

@app.on_event("startup")
async def startup_event():
    global redis_client, supabase_client, openai_client
    if not UPSTASH_REDIS_URL:
        raise ConfigurationError("UPSTASH_REDIS_URL is not set.")
    
    redis_client = redis.from_url(UPSTASH_REDIS_URL, decode_responses=True)
    try:
        await redis_client.ping()
        print("Successfully connected to Redis!")
    except Exception as e:
        print(f"Error connecting to Redis: {e}")

    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("Supabase client initialized.")
    else:
        print("Supabase URL or Service Key not found. Supabase client not initialized.")

    if OPENAI_API_KEY:
        openai_client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        print(f"OpenAI client initialized with model: {OPENAI_MODEL_NAME}.")
    else:
        print("OPENAI_API_KEY not found. OpenAI client not initialized.")

    # Launch Redis stream consumer as a background task
    if redis_client: 
        print("Launching Redis stream consumer as a background task...")
        asyncio.create_task(consume_stream())
    else:
        print("Redis client not available, stream consumer not started.")

@app.on_event("shutdown")
async def shutdown_event():
    if redis_client:
        await redis_client.close()
        print("Redis connection closed.")
    # No explicit close for AsyncOpenAI client in current version, relies on httpx client session closing.

class ConfigurationError(Exception):
    pass

# --- Helper Functions (Placeholders) --- 
async def get_sentiment(text: str) -> dict:
    if not openai_client:
        print("OpenAI client not configured. Skipping sentiment analysis.")
        return {"label": "NEUTRAL", "score": 0.5} # Default neutral sentiment

    if not text or not text.strip():
        print("Input text for sentiment analysis is empty. Skipping.")
        return {"label": "NEUTRAL", "score": 0.0}
    
    system_prompt = (
        "You are a sentiment analysis expert. Classify the sentiment of the given text."
        "Your response must be a JSON object with two keys: 'label' and 'score'."
        "The 'label' must be one of: POSITIVE, NEGATIVE, NEUTRAL."
        "The 'score' must be a float between 0.0 and 1.0, representing the confidence in the label."
        "For NEUTRAL sentiment, the score can be around 0.5."
        "Example: {\"label\": \"POSITIVE\", \"score\": 0.98}" # Escaped quotes for JSON in string
    )
    
    user_prompt = f"Analyze the sentiment of this text: \n\n{text[:2000]}" # Truncate to avoid excessive token usage

    try:
        response = await openai_client.chat.completions.create(
            model=OPENAI_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2, # Low temperature for more deterministic sentiment classification
            max_tokens=50,   # Max tokens for the JSON response
            response_format={"type": "json_object"} # Ensure JSON output with newer models
        )
        
        content = response.choices[0].message.content
        if content:
            sentiment_data = json.loads(content)
            label = sentiment_data.get("label", "UNKNOWN").upper()
            score = sentiment_data.get("score", 0.0)

            # Basic validation
            if label not in ["POSITIVE", "NEGATIVE", "NEUTRAL"]:
                print(f"OpenAI returned unexpected label: {label}. Raw content: {content}")
                label = "UNKNOWN"
            if not isinstance(score, (float, int)) or not (0.0 <= score <= 1.0):
                print(f"OpenAI returned invalid score: {score}. Raw content: {content}")
                score = 0.0
            
            return {"label": label, "score": float(score)}
        else:
            print(f"OpenAI returned empty content for sentiment analysis. Text: {text[:100]}...")
            return {"label": "ERROR_EMPTY_RESPONSE", "score": 0.0}

    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from OpenAI response: {e}. Raw content: {content if 'content' in locals() else 'N/A'}")
        return {"label": "ERROR_JSON_DECODE", "score": 0.0}
    except openai.APIError as e:
        print(f"OpenAI API error: {e}")
        return {"label": "ERROR_API", "score": 0.0}
    except Exception as e:
        print(f"Unexpected error during sentiment analysis with OpenAI: {e}")
        return {"label": "ERROR_UNKNOWN", "score": 0.0}

def filter_noise(article: dict) -> bool:
    # Placeholder: Basic noise filtering logic
    # Example: filter out articles with very short descriptions or titles
    if not article.get('title') or len(article['title']) < 10:
        return True # True means it's noise, should be filtered out
    if not article.get('description') or len(article['description']) < 20:
        return True
    return False # Not noise

async def process_message(message_id: str, article_data: dict):
    # article_data is the message payload from Redis stream
    title = article_data.get('title', '[No Title]')
    search_keyword = article_data.get("search_keyword", "[Unknown Keyword]") # Get the search keyword
    print(f"Processing message {message_id} for keyword '{search_keyword}': {title}")

    # Remove search_keyword from article_data if you don't want it in raw_data or if it might conflict
    # Or ensure your raw_data field in Supabase can handle it / it's fine as is.
    # For now, we assume it's fine to be part of the article_data dict that goes into raw_data.

    if filter_noise(article_data):
        print(f"Article '{title}' (keyword: '{search_keyword}') filtered out as noise.")
        return

    sentiment_text = article_data.get('description') or article_data.get('title') or ""
    sentiment = await get_sentiment(sentiment_text)
    print(f"Sentiment for '{title}' (keyword: '{search_keyword}'): {sentiment}")

    if supabase_client:
        enriched_mention = {
            "keyword": search_keyword,
            "source": article_data.get("source"),
            "author": article_data.get("author"),
            "title": title,
            "description": article_data.get("description"),
            "url": article_data.get("url"),
            "image_url": article_data.get("urlToImage"),
            "published_at": article_data.get("publishedAt"),
            "content_preview": (article_data.get("content") or "")[:255],
            "sentiment_label": sentiment.get("label"),
            "sentiment_score": sentiment.get("score"),
            "raw_data": article_data
        }
        try:
            data_response = await supabase_client.table("mentions").insert(enriched_mention).execute()
            print(f"Inserted into Supabase for keyword '{search_keyword}'. Response data: {data_response.data if hasattr(data_response, 'data') else 'No data in response'}")
        except Exception as e:
            print(f"Error inserting into Supabase for keyword '{search_keyword}': {e}")
    else:
        print(f"Supabase client not initialized. Skipping database insertion for keyword '{search_keyword}'.")

# --- Stream Processing Logic (Background Task) --- 
async def consume_stream():
    if not redis_client:
        print("Redis client not initialized. Stream consumer cannot start.")
        return

    consumer_name = f"{REDIS_CONSUMER_NAME_PREFIX}{os.getpid()}"
    print(f"Starting Redis Stream consumer: {consumer_name} on group {REDIS_CONSUMER_GROUP_NAME} for stream {REDIS_STREAM_KEY}")

    try:
        # Ensure the consumer group exists. MKSTREAM=True creates the stream if it doesn't exist.
        await redis_client.xgroup_create(name=REDIS_STREAM_KEY, groupname=REDIS_CONSUMER_GROUP_NAME, id='0', mkstream=True)
        print(f"Consumer group '{REDIS_CONSUMER_GROUP_NAME}' ensured for stream '{REDIS_STREAM_KEY}'.")
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" in str(e):
            print(f"Consumer group '{REDIS_CONSUMER_GROUP_NAME}' already exists.")
        else:
            print(f"Error creating/checking consumer group: {e}")
            return # Cannot proceed without consumer group

    while True:
        try:
            # XREADGROUP GROUP group consumer [COUNT count] [BLOCK milliseconds] STREAMS key [key ...] ID [ID ...]
            # '>' means only new messages not yet delivered to other consumers in this group.
            # BLOCK 10000 means wait up to 10 seconds for a message.
            messages = await redis_client.xreadgroup(
                groupname=REDIS_CONSUMER_GROUP_NAME,
                consumername=consumer_name,
                streams={REDIS_STREAM_KEY: '>'}, # Read new messages from this stream
                count=1, # Process one message at a time
                block=10000 # Block for 10 seconds (10000 ms)
            )

            if not messages:
                # print("No new messages, continuing to listen...")
                continue

            for stream_name, message_list in messages:
                for message_id, article_data in message_list:
                    await process_message(message_id, article_data)
                    # Acknowledge the message after successful processing
                    await redis_client.xack(REDIS_STREAM_KEY, REDIS_CONSUMER_GROUP_NAME, message_id)
                    print(f"Acknowledged message {message_id}")

        except redis.exceptions.ConnectionError as e:
            print(f"Redis connection error: {e}. Attempting to reconnect...")
            await asyncio.sleep(5) # Wait before retrying
            # Potentially re-initialize redis_client here if needed and possible
        except Exception as e:
            print(f"Error in Redis stream consumer loop: {e}")
            await asyncio.sleep(5) # Wait a bit before continuing

@app.post("/trigger-process/") # Example endpoint to manually trigger processing (optional)
async def trigger_processing():
    # This endpoint is mostly for testing if needed, the main processing is via consume_stream
    if not redis_client:
        raise HTTPException(status_code=500, detail="Redis client not initialized.")
    # Simplified one-time read for testing (not using consumer group logic here)
    messages = await redis_client.xread(streams={REDIS_STREAM_KEY: '0-0'}, count=1) 
    if not messages:
        return {"message": "No messages in stream to process right now."}
    
    stream_name, message_list = messages[0]
    message_id, article_data = message_list[0]
    await process_message(message_id, article_data)
    # Note: This test endpoint doesn't acknowledge, so message might be re-read by consumer group
    return {"message": "Processed one message from stream (for testing).", "processed_id": message_id}

@app.get("/")
async def root():
    return {"message": "Mentions Processor Worker is running."}

# --- Main Execution (for uvicorn) --- 
if __name__ == "__main__":
    # This part is for running with `python main.py`, but you'll likely use `uvicorn main:app --reload`
    # For actual deployment, you wouldn't run the stream consumer and FastAPI app in the same process like this typically.
    # You'd run the FastAPI app with Uvicorn, and the consumer as a separate, long-running background service/script.
    # However, for simplicity in getting started, we can launch the consumer as a background task with FastAPI startup.
    
    # To run the consumer as a background task when FastAPI starts:
    # Note: This is a simplified approach. For robust production, consider dedicated worker managers like Celery, ARQ, or running the consumer script separately.
    
    # asyncio.create_task(consume_stream()) # This would start it but uvicorn manages the main loop
    # A better way for uvicorn is to use lifespan events or run consume_stream() separately.
    
    # Modifying startup_event to launch consume_stream as a background task
    original_startup = app.router.on_startup[0] # Get the existing startup handler
    async def new_startup_event():
        await original_startup() # Call existing startup (Redis/Supabase init)
        if redis_client: # Only start consumer if Redis is connected
            print("Launching Redis stream consumer as a background task...")
            asyncio.create_task(consume_stream())
        else:
            print("Redis client not available, stream consumer not started.")
    
    app.router.on_startup = [new_startup_event] # Replace startup handlers

    import uvicorn
    print("Starting Mentions Processor Worker with Uvicorn...")
    print("Note: The Redis stream consumer is launched as a background task via FastAPI startup event.")
    uvicorn.run(app, host="0.0.0.0", port=8000) 