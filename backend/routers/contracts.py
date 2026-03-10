from fastapi import APIRouter
import feedparser
from services.groq_service import client as groq_client
from cache.cache import get_cache, set_cache
import json

router = APIRouter()

@router.get("/contracts")
def get_contract_news() -> list:
    cache_key = "contracts"
    cached = get_cache(cache_key, 7200)
    if cached: return cached

    # Multiple RSS sources for contract news
    feeds = [
        "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms",
        "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",
        "https://www.business-standard.com/rss/markets-106.rss",
    ]
    
    headlines = []
    for feed_url in feeds:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:30]:
                headlines.append({
                    "title":   entry.get("title", ""),
                    "summary": entry.get("summary", "")[:300],
                    "link":    entry.get("link", ""),
                    "date":    entry.get("published", ""),
                })
        except:
            continue
    
    if not headlines:
        return []
    
    # Send batch to Groq for contract extraction
    headlines_text = "\n".join([
        f"{i+1}. {h['title']}" for i, h in enumerate(headlines[:25])
    ])
    
    prompt = f"""You are an NSE India market analyst scanning news for large contracts.

Here are recent news headlines:
{headlines_text}

Find ALL headlines that mention a company winning, securing, or receiving 
a contract, order, or project worth ₹100 crore or more (or equivalent in USD/EUR).

Respond ONLY in this exact JSON format, no other text:
{{
  "contracts": [
    {{
      "headline_index": 1,
      "company_name": "NBCC India",
      "ticker": "NBCC",
      "contract_value_cr": 2500,
      "contract_value_display": "₹2,500 Cr",
      "client": "Ministry of Housing",
      "contract_type": "Construction",
      "expected_impact": "UP",
      "expected_move_pct": 3.5,
      "reason": "Large government order boosts order book significantly"
    }}
  ]
}}

Rules:
- Only include contracts >= ₹100 crore (or >= $12 million USD)
- ticker must be NSE India ticker symbol (without .NS)
- expected_move_pct: realistic % move expected in 1-5 days (max 15%)
- If no qualifying contracts found, return empty contracts array
- contract_value_cr: value in Indian Crores (convert if needed: 1 USD ≈ 84 INR)"""

    if not groq_client: return []

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.1
        )
        
        text = response.choices[0].message.content.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        result = json.loads(text)
        contracts = result.get("contracts", [])
        
        # Enrich with original headline data
        for c in contracts:
            idx = c.get("headline_index", 1) - 1
            if 0 <= idx < len(headlines):
                c["link"] = headlines[idx]["link"]
                c["date"] = headlines[idx]["date"]
                c["full_headline"] = headlines[idx]["title"]
        
        set_cache(cache_key, contracts)
        return contracts
    except Exception as e:
        print(f"Error in contracts: {e}")
        return []
