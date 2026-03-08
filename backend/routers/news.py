from fastapi import APIRouter
import feedparser
from services.groq_service import get_market_commentary

router = APIRouter()

FEEDS = {
    "markets": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"
}

@router.get("/news")
def get_news(limit: int = 10):
    feed = feedparser.parse(FEEDS["markets"])
    res = []
    for e in feed.entries[:limit]:
        title = e.title
        summary = getattr(e, 'summary', '')
        link = e.link
        published = e.published
        ai_commentary = get_market_commentary(title)
        res.append({
            "title": title,
            "link": link,
            "published": published,
            "summary": summary,
            "ai_commentary": ai_commentary
        })
    return res
