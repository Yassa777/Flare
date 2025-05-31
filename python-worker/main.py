import asyncio
import os
import httpx
import redis.asyncio as redis # Using asyncio version of redis library
from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv
from supabase import create_client, Client as SupabaseClient # Renamed to avoid conflict
import openai # Import OpenAI
import json # For parsing OpenAI response

# Import redis client and exceptions separately for clarity
from redis.asyncio import Redis as AsyncRedis, from_url as redis_from_url
from redis import exceptions as RedisExceptions

# Load environment variables from .env file in the python-worker directory
load_dotenv()

# --- Configuration --- 
# IMPORTANT: For Upstash, ensure your UPSTASH_REDIS_URL starts with rediss:// for SSL
UPSTASH_REDIS_URL = os.getenv("UPSTASH_REDIS_URL") 
UPSTASH_REDIS_PASSWORD = os.getenv("UPSTASH_REDIS_PASSWORD") # Usually part of the URL for Upstash
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
redis_client: AsyncRedis | None = None
supabase_client: SupabaseClient | None = None
openai_client: openai.AsyncOpenAI | None = None # Async OpenAI client

@app.on_event("startup")
async def startup_event():
    global redis_client, supabase_client, openai_client
    if not UPSTASH_REDIS_URL:
        raise ConfigurationError("UPSTASH_REDIS_URL is not set. Please check your .env file.")
    print(f"Using UPSTASH_REDIS_URL: {UPSTASH_REDIS_URL}") # Log the URL being used
    
    try:
        # For Upstash, SSL is required. redis-py should handle rediss:// scheme correctly.
        # If using redis://, ensure your Upstash instance allows non-SSL (unlikely) or set ssl=True explicitly.
        # However, the best approach is to use rediss:// in your UPSTASH_REDIS_URL.
        redis_client = redis_from_url(UPSTASH_REDIS_URL, decode_responses=True)
        await redis_client.ping()
        print("Successfully connected to Redis!")
    except RedisExceptions.ConnectionError as e:
        print(f"Redis connection error during ping: {e}. Check URL, SSL (use rediss://), and credentials.")
        # Optionally, prevent startup or allow retry logic depending on desired robustness
        return # Stop further startup if Redis connection fails critically
    except Exception as e:
        print(f"An unexpected error occurred connecting to Redis: {e}")
        return

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
        print("Redis client not available (due to connection issues), stream consumer not started.")

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

async def process_message(message_id: str, article_data_raw: any):
    article_data: dict
    
    print(f"DEBUG: process_message received message_id: {message_id}")
    print(f"DEBUG: type of article_data_raw: {type(article_data_raw)}")
    print(f"DEBUG: article_data_raw (first 500 chars): {str(article_data_raw)[:500]}")

    if isinstance(article_data_raw, str):
        try:
            article_data = json.loads(article_data_raw)
            print(f"DEBUG: Successfully parsed article_data_raw string into dict.")
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON from article_data string: {e}. Raw data: {article_data_raw[:500]}")
            return 
    elif isinstance(article_data_raw, dict):
        article_data = article_data_raw
        print(f"DEBUG: article_data_raw is already a dict.")
    else:
        print(f"Unexpected type for article_data: {type(article_data_raw)}. Raw data: {str(article_data_raw)[:500]}")
        return

    # Now, article_data should be a dictionary. The error must be happening when accessing its keys.
    # Let's add a type check for article_data before proceeding to use .get()
    if not isinstance(article_data, dict):
        print(f"CRITICAL ERROR: article_data is NOT a dict after parsing/assignment. Type: {type(article_data)}. Value: {str(article_data)[:500]}")
        return

    title = article_data.get('title', '[No Title]')
    search_keyword = article_data.get("search_keyword", "[Unknown Keyword]")
    print(f"Processing message {message_id} for keyword '{search_keyword}': {title}")

    if filter_noise(article_data):
        print(f"Article '{title}' (keyword: '{search_keyword}') filtered out as noise.")
        return

    # Determine sentiment_text: use description if available, otherwise title.
    # Ensure that description or title used for sentiment_text are actually strings.
    description_for_sentiment = article_data.get('description')
    title_for_sentiment = article_data.get('title')
    sentiment_text = ""
    if isinstance(description_for_sentiment, str) and description_for_sentiment.strip():
        sentiment_text = description_for_sentiment
    elif isinstance(title_for_sentiment, str) and title_for_sentiment.strip():
        sentiment_text = title_for_sentiment
    
    sentiment = await get_sentiment(sentiment_text)
    print(f"Sentiment for '{title}' (keyword: '{search_keyword}'): {sentiment}")

    if supabase_client:
        # Prepare enriched_mention for Supabase insertion
        source_value = article_data.get("source")
        # If source_value itself is a dict like {"name": "..."}, then get "name"
        # Otherwise, assume source_value is already the string name, based on debug logs.
        if isinstance(source_value, dict):
            source_display = source_value.get("name")
        else:
            source_display = source_value # Assumes it's already the string name or None

        enriched_mention = {
            "keyword": search_keyword,
            "source": source_display, # Simplified based on debug output
            "title": title,
            "body": article_data.get("description"), 
            "url": article_data.get("url"),
            "image_url": article_data.get("urlToImage"), 
            "published_at": article_data.get("publishedAt"), 
            "sentiment_label": sentiment.get("label"), 
            "sentiment_score": sentiment.get("score"), 
            "raw_data": article_data 
        }
        try:
            # Try executing without await, as execute() might be synchronous after async setup
            # or the returned APIResponse object is not meant to be awaited directly.
            data_response = supabase_client.table("mentions").insert(enriched_mention).execute()
            # The actual I/O (HTTP request) should still be async if the client is configured with httpx.AsyncClient.
            
            # Check for errors in the response, as it might not raise exceptions directly
            # for HTTP errors if it executed synchronously.
            if hasattr(data_response, 'error') and data_response.error:
                print(f"Error from Supabase insert: {data_response.error}")
            elif hasattr(data_response, 'data'):
                 print(f"Inserted into Supabase for keyword '{search_keyword}'. Response data: {data_response.data}")
            else:
                print(f"Inserted into Supabase for keyword '{search_keyword}'. No data in response, but no explicit error.")

        except Exception as e:
            print(f"Exception during Supabase insert for keyword '{search_keyword}': {e}") # Changed log to distinguish general exceptions
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
        await redis_client.xgroup_create(name=REDIS_STREAM_KEY, groupname=REDIS_CONSUMER_GROUP_NAME, id='0', mkstream=True)
        print(f"Consumer group '{REDIS_CONSUMER_GROUP_NAME}' ensured for stream '{REDIS_STREAM_KEY}'.")
    except RedisExceptions.ResponseError as e: # Corrected exception type
        if "BUSYGROUP" in str(e):
            print(f"Consumer group '{REDIS_CONSUMER_GROUP_NAME}' already exists.")
        else:
            print(f"Error creating/checking consumer group: {e}")
            return 
    except RedisExceptions.ConnectionError as e: # Catch connection errors during xgroup_create too
        print(f"Redis connection error during xgroup_create: {e}. Worker might not be able to process messages.")
        return
    except Exception as e: # Catch any other unexpected errors during group creation
        print(f"Unexpected error during consumer group creation: {e}")
        return

    while True:
        try:
            messages = await redis_client.xreadgroup(
                groupname=REDIS_CONSUMER_GROUP_NAME,
                consumername=consumer_name,
                streams={REDIS_STREAM_KEY: '>'},
                count=1,
                block=10000
            )

            if not messages:
                continue

            for stream_name, message_list in messages:
                for message_id, article_data in message_list:
                    await process_message(message_id, article_data)
                    await redis_client.xack(REDIS_STREAM_KEY, REDIS_CONSUMER_GROUP_NAME, message_id)
                    print(f"Acknowledged message {message_id}")

        except RedisExceptions.ConnectionError as e: # Corrected exception type
            print(f"Redis connection error in consumer loop: {e}. Attempting to reconnect or will retry on next cycle if connection recovers.")
            await asyncio.sleep(5) 
        except RedisExceptions.TimeoutError: # Handle potential timeouts
            print("Redis command timed out. Will retry.")
            await asyncio.sleep(1)
        except Exception as e:
            print(f"Error in Redis stream consumer loop: {e}")
            await asyncio.sleep(5) 

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
            print("Redis client not available (due to connection issues), stream consumer not started.")
    
    app.router.on_startup = [new_startup_event] # Replace startup handlers

    import uvicorn
    print("Starting Mentions Processor Worker with Uvicorn...")
    print("Note: The Redis stream consumer is launched as a background task via FastAPI startup event.")
    uvicorn.run(app, host="0.0.0.0", port=8000) 