from fastapi import APIRouter, Query
from cache.cache import get_cache
from services.pattern_service import (
    get_pattern_state, trigger_pattern_scan,
    PATTERN_CACHE_KEY, PATTERN_CACHE_TTL,
)

router = APIRouter()


@router.get("/patterns/signals")
def get_pattern_signals(
    pattern: str = Query("", description="Filter by pattern code e.g. BEAR_FLAG"),
    confidence: str = Query("", description="Filter by confidence: High|Medium|Low"),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    signals = get_cache(PATTERN_CACHE_KEY, PATTERN_CACHE_TTL)
    state   = get_pattern_state()

    if signals is None:
        trigger_pattern_scan()
        s = get_pattern_state()
        return {
            "status":   s["status"] if s["status"] == "building" else "building",
            "progress": s["progress"],
            "signals":  [],
            "count":    0,
        }

    if pattern:
        signals = [s for s in signals if pattern.upper() in s["pattern"].upper()]
    if confidence:
        signals = [s for s in signals if s["confidence"].lower() == confidence.lower()]

    signals = signals[:limit]
    return {
        "status":   "ready",
        "progress": 100,
        "count":    len(signals),
        "signals":  signals,
        "summary": {
            "high":   sum(1 for s in signals if s["confidence"] == "High"),
            "medium": sum(1 for s in signals if s["confidence"] == "Medium"),
            "low":    sum(1 for s in signals if s["confidence"] == "Low"),
            "bear_flag":    sum(1 for s in signals if s["pattern"] == "BEAR_FLAG"),
            "dist_channel": sum(1 for s in signals if s["pattern"] == "DIST_CHANNEL"),
            "ema_cross":    sum(1 for s in signals if s["pattern"] == "EMA_CROSS"),
        },
    }


@router.post("/patterns/scan")
def trigger_scan() -> dict:
    """Manually trigger a fresh pattern scan."""
    started = trigger_pattern_scan()
    return {"started": started, "state": get_pattern_state()}
