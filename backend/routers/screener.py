import math
from fastapi import APIRouter, Query
from cache.cache import get_cache, set_cache
from services.screener_builder import (
    get_screener_state, trigger_if_needed,
    SCREENER_CACHE_KEY, SCREENER_CACHE_TTL,
)
from services.probability_ranking import rank_watchlist

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


RANKED_CACHE_KEY = "screener_ranked"
RANKED_CACHE_TTL = 300  # 5 min — fast refresh, avoids re-scoring 500+ stocks

_ENRICH_FIELDS = ("name", "sector", "price", "change_pct", "ema_signal", "zone")
_ENRICH_DEFAULTS = {"name": "-", "sector": "-", "price": None, "change_pct": 0, "ema_signal": "-", "zone": "-"}


@router.get("/screener/ranked")
def get_ranked(
    top: int = Query(15, ge=1, le=50),
) -> dict:
    """
    Returns top BUY and top SELL candidates side by side.
    Cached for 5 min to avoid re-ranking 500+ stocks on every request.
    """
    full = get_cache(SCREENER_CACHE_KEY, SCREENER_CACHE_TTL)
    if full is None:
        trigger_if_needed()
        state = get_screener_state()
        return {
            "status": state["status"] if state["status"] == "building" else "building",
            "progress": state["progress"],
            "buy": [],
            "sell": [],
            "market": {},
        }

    # Check ranked cache first
    cached = get_cache(RANKED_CACHE_KEY, RANKED_CACHE_TTL)
    if cached and cached.get("_top", 0) >= top:
        return {
            "status": "ready",
            "buy":    cached["buy"][:top],
            "sell":   cached["sell"][:top],
            "market": cached["market"],
        }

    # Build O(1) ticker→stock index once
    index = {s["ticker"]: s for s in full}

    # Fetch market regime once
    global_risk = "NEUTRAL"
    india_bias  = "RANGE"
    try:
        from routers.market import get_market_data
        md = get_market_data()
        global_risk = md.get("global_risk", "NEUTRAL")
        india_bias  = md.get("india_bias",  "RANGE")
    except Exception:
        pass

    ranked = rank_watchlist(
        screener_results=full,
        global_risk=global_risk,
        india_bias=india_bias,
        max_positions=top,
    )

    max_top = max(top, 30)  # cache a wider slice to serve future requests

    buy_list  = _build_list(ranked["full_long_ranked"][:max_top],  index, include_demand=True)
    sell_list = (_build_list(ranked["full_short_ranked"][:max_top], index)
                 if ranked["full_short_ranked"]
                 else _build_sell_from_screener(full, max_top))

    market_info = {
        "global_risk": global_risk,
        "india_bias":  india_bias,
        "is_bearish":  ranked["market_regime"]["is_bearish"],
    }

    # Cache the wider slice for subsequent requests
    set_cache(RANKED_CACHE_KEY, {
        "buy":    buy_list,
        "sell":   sell_list,
        "market": market_info,
        "_top":   max_top,
    })

    return {
        "status": "ready",
        "buy":    buy_list[:top],
        "sell":   sell_list[:top],
        "market": market_info,
    }


def _build_list(ranked_items: list, index: dict, include_demand: bool = False) -> list:
    """Build enriched response list from ranked results + O(1) index lookup."""
    result = []
    for i, r in enumerate(ranked_items):
        ticker = r["ticker"]
        raw = index.get(ticker)
        enriched = {f: raw.get(f, _ENRICH_DEFAULTS[f]) for f in _ENRICH_FIELDS} if raw else dict(_ENRICH_DEFAULTS)
        entry = {
            "rank":        i + 1,
            "ticker":      ticker,
            "total_score": r["total_score"],
            "signal":      r["signal"],
            "breakdown":   r["breakdown"],
            **enriched,
        }
        if include_demand:
            entry["demand_type"] = r.get("demand_type", "-")
        result.append(entry)
    return result


def _build_sell_from_screener(full: list, top: int) -> list:
    """Fallback sell list from weakest-scoring stocks when market isn't bearish."""
    sorted_weak = sorted(full, key=lambda x: x.get("final_score", 0))[:top]
    return [
        {
            "rank":        i + 1,
            "ticker":      s["ticker"],
            "total_score": s.get("final_score", 0),
            "signal":      s.get("final_signal", "AVOID"),
            "name":        s.get("name", s["ticker"]),
            "sector":      s.get("sector", "-"),
            "price":       s.get("price"),
            "change_pct":  s.get("change_pct", 0),
            "ema_signal":  s.get("ema_signal", "-"),
            "zone":        s.get("zone", "-"),
            "breakdown":   {},
        }
        for i, s in enumerate(sorted_weak)
    ]
