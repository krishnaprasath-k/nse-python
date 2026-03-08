from groq import Groq
from cache.cache import get_cache, set_cache
from config import GROQ_API_KEY

if GROQ_API_KEY:
    client = Groq(api_key=GROQ_API_KEY)
else:
    client = None

def get_market_commentary(news_headline):
    if not client: return "Groq API key missing. Cannot generate commentary."
    
    cache_key = f"groq_market_{news_headline[:30]}"
    cached = get_cache(cache_key, 3600*24)
    if cached: return cached
    
    prompt = f"""Given this Indian market news: '{news_headline}'
    In 2 sentences max, what is the trading implication for NSE stocks?
    Be specific and actionable."""
    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80
        )
        res = resp.choices[0].message.content.strip()
        set_cache(cache_key, res)
        return res
    except Exception as e:
        return f"Error: {e}"

def detect_corporate_event(ticker, date_str):
    if not client: return "NONE"
    
    prompt = f"""NSE:{ticker} India stock. Did a corporate event (quarterly result,
    annual result, dividend, bonus issue, or stock split) occur on {date_str}?
    Answer ONLY with exactly one word: RESULT or DIVIDEND or BONUS or SPLIT or NONE"""

    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=10,
            temperature=0
        )
        return resp.choices[0].message.content.strip()
    except:
        return "NONE"

def get_event_detail(ticker, date_str, event_type):
    if not client: return ""
    
    prompt = f"""NSE:{ticker} India stock on {date_str}.
    A {event_type} occurred. Reply in under 10 words with only the key detail:
    - RESULT: YoY net profit change (e.g. '18% growth')
    - DIVIDEND: amount (e.g. 'Rs.3 Interim Dividend')
    - BONUS: ratio (e.g. '1:1 Bonus')
    - SPLIT: ratio (e.g. '10:1 Split')"""

    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=25
        )
        return resp.choices[0].message.content.strip()
    except:
        return ""
