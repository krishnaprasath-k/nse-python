from fastapi import APIRouter
import feedparser
import json
from cache.cache import get_cache, set_cache
from services.groq_service import client as groq_client, get_market_commentary

router = APIRouter()

FEEDS = {
    "markets": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"
}

def analyze_news_impact(headline: str, summary: str) -> dict:
    prompt = f"""You are a NSE India stock market analyst.

News headline: "{headline}"
Summary: "{summary}"

Analyze this news and respond in this EXACT JSON format only, no other text:
{{
  "impacted_stocks": [
    {{
      "ticker": "SBIN",
      "name": "State Bank of India", 
      "direction": "UP",
      "expected_move_pct": 2.5,
      "reason": "RBI rate cut benefits PSU banks directly"
    }}
  ],
  "impacted_sectors": [
    {{
      "sector": "Banking",
      "direction": "UP",
      "reason": "Lower rates boost NIM for banks"
    }}
  ],
  "news_category": "RBI_POLICY",
  "market_sentiment": "BULLISH"
}}

Rules:
- Only include stocks from NSE India
- direction must be exactly "UP" or "DOWN"
- expected_move_pct is the expected % move in next 1-3 days (realistic, max 10%)
- List 2-5 most directly impacted stocks only
- news_category: one of RBI_POLICY, GOVT_POLICY, EARNINGS, CONTRACT, 
  GLOBAL_MACRO, SECTOR_NEWS, IPO, CRUDE_OIL, CURRENCY, OTHER
- If news has no clear stock impact, return empty impacted_stocks array"""

    if not groq_client:
        return {"impacted_stocks": [], "impacted_sectors": [], 
                "news_category": "OTHER", "market_sentiment": "NEUTRAL"}

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.1
        )
        text = response.choices[0].message.content.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except:
        return {"impacted_stocks": [], "impacted_sectors": [], 
                "news_category": "OTHER", "market_sentiment": "NEUTRAL"}


@router.get("/news")
def get_news(limit: int = 10):
    cache_key = "news_with_impact_10"
    cached = get_cache(cache_key, 600)
    if cached: return cached

    feed = feedparser.parse(FEEDS["markets"])
    res = []
    for e in feed.entries[:limit]:
        title = e.title
        summary = getattr(e, 'summary', '')
        link = e.link
        published = e.published
        
        # Keep old generic AI note logic so frontend doesn't break
        ai_commentary = get_market_commentary(title)
        
        # New structured impact logic
        impact = analyze_news_impact(title, summary)
        
        res.append({
            "title": title,
            "link": link,
            "published": published,
            "summary": summary,
            "ai_note": ai_commentary, # using existing frontend name for ai_note or keep 'ai_commentary'
            "ai_commentary": ai_commentary, # keep Both just in case
            "impact": impact
        })
        
    set_cache(cache_key, res)
    return res
