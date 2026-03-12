Update the news feed in my NSE Trading Dashboard to use multiple RSS feeds
instead of just Economic Times. Backend: Python FastAPI.

═══════════════════════════════════════════════════════

## RSS FEEDS TO ADD

═══════════════════════════════════════════════════════

Add ALL these feeds to the news service:

── INDIAN FINANCIAL NEWS ─────────────────────────────

Economic Times (already have):
Markets: https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms
Industry: https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms
Economy: https://economictimes.indiatimes.com/economy/rssfeeds/1373380680.cms

Business Standard:
Markets: https://www.business-standard.com/rss/markets-106.rss
Economy: https://www.business-standard.com/rss/economy-policy-102.rss
Companies: https://www.business-standard.com/rss/companies-101.rss

Moneycontrol:
Markets: https://www.moneycontrol.com/rss/marketreports.xml
Business: https://www.moneycontrol.com/rss/business.xml
Economy: https://www.moneycontrol.com/rss/economy.xml

Livemint:
Markets: https://www.livemint.com/rss/markets
Companies: https://www.livemint.com/rss/companies
Economy: https://www.livemint.com/rss/economy

Financial Express:
Market: https://www.financialexpress.com/market/feed/
Economy: https://www.financialexpress.com/economy/feed/

NDTV Profit:
Business: https://feeds.feedburner.com/ndtvprofit-latest

── GLOBAL MACRO NEWS ─────────────────────────────────

Reuters:
Business: https://feeds.reuters.com/reuters/businessNews
Markets: https://feeds.reuters.com/reuters/UKmarkets

Bloomberg (public feed):
Markets: https://feeds.bloomberg.com/markets/news.rss

Investing.com:
Commodities: https://www.investing.com/rss/news_25.rss
Indices: https://www.investing.com/rss/news_285.rss
Forex: https://www.investing.com/rss/news_1.rss

── RBI / GOVT / NSE OFFICIAL ─────────────────────────

NSE India:
Circulars: https://www.nseindia.com/int_rss/rss_circulars.xml

PIB (Press Information Bureau):
Finance: https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3

Zee Business:
Markets: https://www.zeebiz.com/markets/rss

═══════════════════════════════════════════════════════

## BACKEND — Update services/news_service.py

═══════════════════════════════════════════════════════

```python
import feedparser
import time
import hashlib
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

# All RSS feeds with metadata
RSS_FEEDS = [
    # Indian Markets
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

    # Global Macro
    {"url": "https://feeds.reuters.com/reuters/businessNews",
     "source": "Reuters", "category": "GLOBAL_MACRO", "priority": 1},
    {"url": "https://www.investing.com/rss/news_25.rss",
     "source": "Investing.com", "category": "COMMODITIES", "priority": 2},
    {"url": "https://www.investing.com/rss/news_1.rss",
     "source": "Investing.com", "category": "FOREX", "priority": 2},

    # Official
    {"url": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
     "source": "PIB Finance", "category": "GOVT_POLICY", "priority": 1},
]

# Category display config
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

def fetch_all_news(
    limit: int = 50,
    categories: list = None,   # filter by category
    sources: list = None,      # filter by source
) -> list:

    cache_key = f"news_all_{limit}_{str(categories)}_{str(sources)}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    all_items = []
    seen_hashes = set()   # deduplicate by title hash

    feeds_to_fetch = RSS_FEEDS
    if categories:
        feeds_to_fetch = [f for f in RSS_FEEDS if f["category"] in categories]
    if sources:
        feeds_to_fetch = [f for f in feeds_to_fetch if f["source"] in sources]

    for feed_meta in feeds_to_fetch:
        try:
            feed = feedparser.parse(
                feed_meta["url"],
                request_headers={
                    "User-Agent": "Mozilla/5.0 (compatible; NSEDashboard/1.0)"
                }
            )

            for entry in feed.entries[:10]:  # max 10 per feed
                title = entry.get("title", "").strip()
                if not title:
                    continue

                # Deduplicate by title hash
                title_hash = hashlib.md5(title.lower().encode()).hexdigest()
                if title_hash in seen_hashes:
                    continue
                seen_hashes.add(title_hash)

                # Parse published date
                pub_date = ""
                try:
                    if hasattr(entry, "published"):
                        pub_date = parsedate_to_datetime(
                            entry.published
                        ).isoformat()
                except:
                    pub_date = datetime.now(timezone.utc).isoformat()

                # Clean summary
                summary = entry.get("summary", "")
                # Strip HTML tags
                import re
                summary = re.sub(r"<[^>]+>", "", summary).strip()[:400]

                all_items.append({
                    "id":       title_hash,
                    "title":    title,
                    "link":     entry.get("link", ""),
                    "summary":  summary,
                    "published": pub_date,
                    "source":   feed_meta["source"],
                    "category": feed_meta["category"],
                    "category_label": CATEGORY_LABELS.get(
                        feed_meta["category"], {}
                    ).get("label", feed_meta["category"]),
                    "category_color": CATEGORY_LABELS.get(
                        feed_meta["category"], {}
                    ).get("color", "gray"),
                    "priority": feed_meta["priority"],
                    "ai_note":  None,    # filled by Groq below
                    "impact":   None,    # filled by Groq below
                })

        except Exception as e:
            print(f"[RSS ERROR] {feed_meta['source']}: {e}")
            continue

    # Sort: priority 1 first, then by date (newest first)
    all_items.sort(
        key=lambda x: (x["priority"], x["published"]),
        reverse=False
    )
    # Re-sort by date within same priority
    all_items.sort(key=lambda x: x["published"], reverse=True)

    # Limit
    all_items = all_items[:limit]

    # Run Groq AI analysis only on top 10 items (rate limit protection)
    for item in all_items[:10]:
        try:
            analysis = analyze_news_impact(item["title"], item["summary"])
            item["ai_note"] = analysis.get("ai_note", "")
            item["impact"]  = analysis
        except Exception as e:
            print(f"[GROQ ERROR] {e}")
            item["ai_note"] = ""
            item["impact"]  = {"impacted_stocks": [], "market_sentiment": "NEUTRAL"}
        time.sleep(0.5)  # Groq rate limit protection

    _set_cache(cache_key, all_items, ttl=600)  # 10 min cache
    return all_items


def get_news_sources() -> list:
    """Returns list of all available sources for frontend filter UI."""
    return [
        {
            "source":     f["source"],
            "category":   f["category"],
            "label":      CATEGORY_LABELS.get(f["category"], {}).get("label"),
            "color":      CATEGORY_LABELS.get(f["category"], {}).get("color"),
        }
        for f in RSS_FEEDS
    ]
```

Update the router:

```python
# routers/news.py
@app.get("/api/news")
def get_news(
    limit: int = 50,
    category: str = None,      # ?category=INDIA_MARKETS
    source: str = None,        # ?source=Moneycontrol
):
    categories = [category] if category else None
    sources    = [source]    if source    else None
    return fetch_all_news(limit=limit, categories=categories, sources=sources)

@app.get("/api/news/sources")
def get_sources():
    return get_news_sources()
```

═══════════════════════════════════════════════════════

## FRONTEND — Update NewsPanel component

═══════════════════════════════════════════════════════

── FILTER BAR above news list ────────────────────────

Fetch /api/news/sources on mount to build filter options.

Show horizontal scrollable filter chips:
[All] [Markets] [Economy] [Companies] [Global] [Govt Policy]
[Commodities] [Forex] [Industry]

Source filter dropdown (secondary):
All Sources ▾
├── Economic Times
├── Business Standard
├── Moneycontrol
├── Livemint
├── Reuters
└── ... etc

When filter chip is clicked:
→ GET /api/news?category=INDIA_MARKETS
→ re-render news list

── EACH NEWS CARD ────────────────────────────────────

Add these new elements to each card:

1. SOURCE BADGE (top left of card):
   Show source name with a colored left border matching category color.
   Example:
   [● Moneycontrol] [Markets] ← source + category chips
2. Keep existing:
   - Title (orange, clickable)
   - AI NOTE paragraph
   - Impact chips (↑SBIN +2.5% ↓ONGC -1.2%)

3. TIMESTAMP (bottom right):
   Show relative time: "2 hours ago" / "Just now" / "Yesterday"
   Use: timeAgo(item.published)

── CATEGORY COLOR MAP ────────────────────────────────
Use these Tailwind border colors per category:
INDIA_MARKETS: border-l-blue-500
INDIA_ECONOMY: border-l-green-500
INDIA_COMPANIES: border-l-teal-500
GLOBAL_MACRO: border-l-orange-500
COMMODITIES: border-l-yellow-500
FOREX: border-l-pink-500
GOVT_POLICY: border-l-red-500
INDIA_INDUSTRY: border-l-purple-500
INDIA_BUSINESS: border-l-indigo-500

── ADD TO CONFIG PAGE ────────────────────────────────

Under a new "📰 News Feeds" tab in /config:

Show a table of all RSS feeds with toggle switches:
Source Category Status Last Fetched
Economic Times India Markets ON ● 2 min ago
Moneycontrol India Markets ON ● 2 min ago
Reuters Global Macro ON ● 5 min ago
PIB Finance Govt Policy ON ● 8 min ago

Each row has:

- Toggle ON/OFF (saves to model_config.json feeds section)
- "Test" button → fetches that single feed and shows count
- Last fetched time

Add to model_config.json:

```json
"news_feeds": {
  "max_items_per_feed": 10,
  "total_limit": 50,
  "ai_analysis_limit": 10,
  "cache_minutes": 10,
  "disabled_sources": []
}
```

═══════════════════════════════════════════════════════

## DO NOT CHANGE

═══════════════════════════════════════════════════════

- All existing panels (Global Macro, India Market, Chart, etc.)
- Existing AI impact analysis on news items
- Existing cache system
- Dark theme colors
- Stack: React + Vite + Tailwind + Python FastAPI

The feeds are grouped into Indian Markets (ET, BS, Moneycontrol, Livemint, FE, NDTV, Zee), Global Macro (Reuters, Investing.com), and Official (PIB, NSE). Each card gets a colored left border by category and the filter bar lets you instantly switch between them. The Config page gets a new News Feeds tab where you can toggle individual sources on/off without touching code. Sonnet 4.6Claude is AI and can make mistakes. Please double-check responses.ShareContentCopy of
