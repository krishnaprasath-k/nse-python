import math
from fastapi import APIRouter, Query
from cache.cache import get_cache
from services.screener_builder import (
    get_screener_state, trigger_if_needed,
    SCREENER_CACHE_KEY, SCREENER_CACHE_TTL,
)

router = APIRouter()


@router.get("/screener/status")
def screener_status() -> dict:
    return get_screener_state()


@router.get("/screener")
def get_screener(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    sort: str = Query("score"),        # score | return | name | ema
    order: str = Query("desc"),        # asc | desc
    filter: str = Query("all"),        # all | buy | watch | avoid | best_timing
    search: str = Query(""),
    sector: str = Query(""),
) -> dict:
    full = get_cache(SCREENER_CACHE_KEY, SCREENER_CACHE_TTL)
    state = get_screener_state()

    if full is None:
        trigger_if_needed()
        current = get_screener_state()
        return {
            "status": current["status"] if current["status"] == "building" else "building",
            "progress": current["progress"],
            "total": 0,
            "page": page,
            "limit": limit,
            "total_pages": 0,
            "stocks": [],
            "summary": {},
        }

    stocks = list(full)

    # Filters
    if filter == "buy":
        stocks = [s for s in stocks if s["final_signal"] in ("BUY", "STRONG BUY")]
    elif filter == "watch":
        stocks = [s for s in stocks if s["final_signal"] == "WATCH"]
    elif filter == "avoid":
        stocks = [s for s in stocks if s["final_signal"] == "AVOID"]
    elif filter == "best_timing":
        stocks = [s for s in stocks if s["ema_signal"] == "BEST TIMING"]

    if sector:
        stocks = [s for s in stocks if s.get("sector", "").lower() == sector.lower()]

    if search:
        q = search.lower()
        stocks = [s for s in stocks if q in s["name"].lower() or q in s["ticker"].lower()]

    # Sort
    reverse = order == "desc"
    if sort == "score":
        stocks.sort(key=lambda x: x["final_score"], reverse=reverse)
    elif sort == "return":
        stocks.sort(key=lambda x: x["change_pct"], reverse=reverse)
    elif sort == "name":
        stocks.sort(key=lambda x: x["name"].lower(), reverse=reverse)
    elif sort == "ema":
        ema_order = {"BEST TIMING": 5, "NEAR EMA": 4, "SLIGHTLY EXTENDED": 3,
                     "BELOW EMA": 2, "EXTENDED": 1, "INSUFFICIENT_DATA": 0}
        stocks.sort(key=lambda x: ema_order.get(x["ema_signal"], 0), reverse=reverse)

    total = len(stocks)
    total_pages = max(1, math.ceil(total / limit))
    page = min(page, total_pages)
    offset = (page - 1) * limit
    page_stocks = stocks[offset: offset + limit]

    buy_count = sum(1 for s in stocks if s["final_signal"] in ("BUY", "STRONG BUY"))
    best_timing = sum(1 for s in stocks if s["ema_signal"] == "BEST TIMING")

    return {
        "status": "ready",
        "progress": 100,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "stocks": page_stocks,
        "summary": {
            "buy_count": buy_count,
            "watch_count": sum(1 for s in stocks if s["final_signal"] == "WATCH"),
            "avoid_count": total - buy_count - sum(1 for s in stocks if s["final_signal"] == "WATCH"),
            "best_timing_count": best_timing,
        },
    }
