from fastapi import APIRouter, Query
import feedparser
import json
import re
import hashlib
import time
from datetime import datetime, timezone
from cache.cache import get_cache, set_cache
from services.groq_service import client as groq_client, get_market_commentary

router = APIRouter()

# ─── RSS Feed Registry ────────────────────────────────────────────────────────

RSS_FEEDS = [
    # ── Indian Markets ──
    {"url": "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms",
     "source": "Economic Times", "category": "INDIA_MARKETS", "priority": 1},
    {"url": "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",
     "source": "Economic Times", "category": "INDIA_INDUSTRY", "priority": 2},
    {"url": "https://economictimes.indiatimes.com/economy/rssfeeds/1373380680.cms",
     "source": "Economic Times", "category": "INDIA_ECONOMY", "priority": 2},

    {"url": "https://www.business-standard.com/rss/markets-106.rss",
     "source": "Business Standard", "category": "INDIA_MARKETS", "priority": 1},
    {"url": "https://www.business-standard.com/rss/economy-policy-102.rss",
     "source": "Business Standard", "category": "INDIA_ECONOMY", "priority": 2},
    {"url": "https://www.business-standard.com/rss/companies-101.rss",
     "source": "Business Standard", "category": "INDIA_COMPANIES", "priority": 1},

    {"url": "https://www.moneycontrol.com/rss/marketreports.xml",
     "source": "Moneycontrol", "category": "INDIA_MARKETS", "priority": 1},
    {"url": "https://www.moneycontrol.com/rss/business.xml",
     "source": "Moneycontrol", "category": "INDIA_BUSINESS", "priority": 2},
    {"url": "https://www.moneycontrol.com/rss/economy.xml",
     "source": "Moneycontrol", "category": "INDIA_ECONOMY", "priority": 2},

    {"url": "https://www.livemint.com/rss/markets",
     "source": "Livemint", "category": "INDIA_MARKETS", "priority": 1},
    {"url": "https://www.livemint.com/rss/companies",
     "source": "Livemint", "category": "INDIA_COMPANIES", "priority": 1},

    {"url": "https://www.financialexpress.com/market/feed/",
     "source": "Financial Express", "category": "INDIA_MARKETS", "priority": 2},

    {"url": "https://feeds.feedburner.com/ndtvprofit-latest",
     "source": "NDTV Profit", "category": "INDIA_BUSINESS", "priority": 2},

    {"url": "https://www.zeebiz.com/markets/rss",
     "source": "Zee Business", "category": "INDIA_MARKETS", "priority": 2},

    # ── Global Macro ──
    {"url": "https://feeds.reuters.com/reuters/businessNews",
     "source": "Reuters", "category": "GLOBAL_MACRO", "priority": 1},
    {"url": "https://www.investing.com/rss/news_25.rss",
     "source": "Investing.com", "category": "COMMODITIES", "priority": 2},
    {"url": "https://www.investing.com/rss/news_1.rss",
     "source": "Investing.com", "category": "FOREX", "priority": 2},

    # ── Official / Government ──
    {"url": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
     "source": "PIB Finance", "category": "GOVT_POLICY", "priority": 1},
]

CATEGORY_LABELS = {
    "INDIA_MARKETS":   {"label": "Markets",     "color": "blue"},
    "INDIA_INDUSTRY":  {"label": "Industry",    "color": "purple"},
    "INDIA_ECONOMY":   {"label": "Economy",     "color": "green"},
    "INDIA_COMPANIES": {"label": "Companies",   "color": "teal"},
    "INDIA_BUSINESS":  {"label": "Business",    "color": "indigo"},
    "GLOBAL_MACRO":    {"label": "Global",      "color": "orange"},
    "COMMODITIES":     {"label": "Commodities", "color": "yellow"},
    "FOREX":           {"label": "Forex",       "color": "pink"},
    "GOVT_POLICY":     {"label": "Govt Policy", "color": "red"},
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "").strip()


def _parse_date(entry) -> str:
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(entry.published).isoformat()
    except Exception:
        pass
    try:
        return entry.get("published", "")
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def _get_disabled_sources() -> list:
    """Read disabled_sources from model_config."""
    try:
        from routers.config import load_config
        return load_config().get("news_feeds", {}).get("disabled_sources", [])
    except Exception:
        return []


def _get_limits() -> dict:
    try:
        from routers.config import load_config
        cfg = load_config().get("news_feeds", {})
        return {
            "max_per_feed":     cfg.get("max_items_per_feed", 10),
            "total":            cfg.get("total_limit", 50),
            "ai_limit":         cfg.get("ai_analysis_limit", 10),
            "cache_minutes":    cfg.get("cache_minutes", 10),
        }
    except Exception:
        return {"max_per_feed": 10, "total": 50, "ai_limit": 10, "cache_minutes": 10}


# ─── AI analysis (unchanged from original) ───────────────────────────────────

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
    except Exception:
        return {"impacted_stocks": [], "impacted_sectors": [],
                "news_category": "OTHER", "market_sentiment": "NEUTRAL"}


# ─── Core fetch function ──────────────────────────────────────────────────────

def _fetch_all_news(
    limit: int = 50,
    category: str = None,
    source: str = None,
) -> list:
    limits = _get_limits()
    cache_ttl = limits["cache_minutes"] * 60
    cache_key = f"news_multi_{limit}_{category}_{source}"
    cached = get_cache(cache_key, cache_ttl)
    if cached:
        return cached

    disabled = _get_disabled_sources()
    feeds_to_fetch = [f for f in RSS_FEEDS if f["source"] not in disabled]

    if category:
        feeds_to_fetch = [f for f in feeds_to_fetch if f["category"] == category]
    if source:
        feeds_to_fetch = [f for f in feeds_to_fetch if f["source"] == source]

    all_items = []
    seen_hashes = set()

    for feed_meta in feeds_to_fetch:
        try:
            feed = feedparser.parse(
                feed_meta["url"],
                request_headers={"User-Agent": "Mozilla/5.0 (compatible; NSEDashboard/1.0)"}
            )
            for entry in feed.entries[:limits["max_per_feed"]]:
                title = (entry.get("title") or "").strip()
                if not title:
                    continue

                title_hash = hashlib.md5(title.lower().encode()).hexdigest()
                if title_hash in seen_hashes:
                    continue
                seen_hashes.add(title_hash)

                summary = _strip_html(entry.get("summary", ""))[:400]
                pub_date = _parse_date(entry)
                cat_meta = CATEGORY_LABELS.get(feed_meta["category"], {})

                all_items.append({
                    "id":              title_hash,
                    "title":           title,
                    "link":            entry.get("link", ""),
                    "summary":         summary,
                    "published":       pub_date,
                    "source":          feed_meta["source"],
                    "category":        feed_meta["category"],
                    "category_label":  cat_meta.get("label", feed_meta["category"]),
                    "category_color":  cat_meta.get("color", "gray"),
                    "priority":        feed_meta["priority"],
                    "ai_note":         None,
                    "ai_commentary":   None,
                    "impact":          None,
                })
        except Exception as e:
            print(f"[RSS ERROR] {feed_meta['source']}: {e}")
            continue

    # Sort: newest first, then priority
    all_items.sort(key=lambda x: (x["priority"], x["published"] or ""), reverse=False)
    all_items.sort(key=lambda x: x["published"] or "", reverse=True)
    all_items = all_items[:limit]

    # AI analysis on top N items only
    for item in all_items[:limits["ai_limit"]]:
        try:
            ai_note = get_market_commentary(item["title"])
            impact  = analyze_news_impact(item["title"], item["summary"] or "")
            item["ai_note"]        = ai_note
            item["ai_commentary"]  = ai_note
            item["impact"]         = impact
        except Exception as e:
            print(f"[GROQ ERROR] {e}")
            item["ai_note"]  = ""
            item["impact"]   = {"impacted_stocks": [], "impacted_sectors": [],
                                 "news_category": "OTHER", "market_sentiment": "NEUTRAL"}
        time.sleep(0.4)  # rate-limit protection

    set_cache(cache_key, all_items)
    return all_items


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/news")
def get_news(
    limit: int = Query(default=50, le=100),
    category: str = Query(default=None),
    source: str = Query(default=None),
):
    """Fetch news from all configured RSS feeds.
    Optional filters: ?category=INDIA_MARKETS  ?source=Moneycontrol
    """
    return _fetch_all_news(limit=limit, category=category, source=source)


@router.get("/news/sources")
def get_news_sources():
    """Return all available sources + categories for the frontend filter bar."""
    disabled = _get_disabled_sources()
    seen = set()
    result = []
    for f in RSS_FEEDS:
        key = f["source"]
        if key in seen:
            continue
        seen.add(key)
        cat_meta = CATEGORY_LABELS.get(f["category"], {})
        result.append({
            "source":   f["source"],
            "category": f["category"],
            "label":    cat_meta.get("label", f["category"]),
            "color":    cat_meta.get("color", "gray"),
            "enabled":  f["source"] not in disabled,
        })
    return result


@router.get("/news/categories")
def get_news_categories():
    """Unique category list for filter chips."""
    seen = {}
    for f in RSS_FEEDS:
        cat = f["category"]
        if cat not in seen:
            seen[cat] = CATEGORY_LABELS.get(cat, {"label": cat, "color": "gray"})
    return [{"category": k, **v} for k, v in seen.items()]


@router.get("/news/feed-test/{source_name}")
def test_feed(source_name: str):
    """Quick test — fetch one feed and return item count."""
    feed_meta = next((f for f in RSS_FEEDS if f["source"] == source_name), None)
    if not feed_meta:
        return {"error": "source not found"}
    try:
        feed = feedparser.parse(
            feed_meta["url"],
            request_headers={"User-Agent": "Mozilla/5.0 (compatible; NSEDashboard/1.0)"}
        )
        return {"source": source_name, "count": len(feed.entries), "status": "ok"}
    except Exception as e:
        return {"source": source_name, "count": 0, "status": "error", "detail": str(e)}
