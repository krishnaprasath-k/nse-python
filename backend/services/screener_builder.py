import gc
import time
import threading
import numpy as np
import yfinance as yf
import pandas as pd
from cache.cache import get_cache, set_cache

BATCH_SIZE = 50
BATCH_DELAY = 1.5
SCREENER_CACHE_KEY = "screener_full_data"
SCREENER_CACHE_TTL = 14400  # 4 hours

_lock = threading.Lock()
_state = {
    "status": "idle",
    "progress": 0,
    "total": 0,
    "processed": 0,
    "started_at": None,
    "error": None,
}


def get_screener_state() -> dict:
    with _lock:
        return dict(_state)


def _update(**kwargs):
    with _lock:
        _state.update(kwargs)


def _safe(val):
    if val is None:
        return 0.0
    if isinstance(val, pd.Series):
        val = val.iloc[0] if len(val) > 0 else 0.0
    try:
        f = float(val)
        return f if not (np.isnan(f) or np.isinf(f)) else 0.0
    except Exception:
        return 0.0


def _ema(prices: list, period: int = 21) -> float | None:
    if len(prices) < period:
        return None
    k = 2 / (period + 1)
    v = prices[0]
    for p in prices[1:]:
        v = p * k + v * (1 - k)
    return v


def _compute_seasonal_score(closes: list) -> int:
    """
    Estimate seasonal favorability from recent price data.
    Uses current month's trend as a proxy.
    """
    if len(closes) < 22:
        return 1  # default neutral
    current_chunk = closes[-15:]
    if current_chunk[0] == 0:
        return 1

    current_ret = (current_chunk[-1] - current_chunk[0]) / current_chunk[0]

    if current_ret > 0.02:
        return 2
    elif current_ret > -0.02:
        return 1
    else:
        return 0


def _score_stock(ticker: str, name: str, sector: str, closes: list, cfg: dict,
                 global_risk: str = "NEUTRAL", india_bias: str = "RANGE",
                 sector_scores: dict = None) -> dict | None:
    if len(closes) < 5:
        return None

    price = closes[-1]
    prev = closes[-2]
    change_pct = (price - prev) / prev if prev != 0 else 0.0

    ema_cfg = cfg.get("ema_timing", {})
    period = ema_cfg.get("period", 21)
    best_pct = ema_cfg.get("best_timing_pct", 1.0)
    near_pct = ema_cfg.get("near_ema_pct", 3.0)
    ext_pct = ema_cfg.get("extended_pct", 5.0)

    ema21 = _ema(closes, period)
    if ema21 and ema21 != 0:
        prox = ((price - ema21) / ema21) * 100
        abs_prox = abs(prox)
        if prox < -near_pct:
            sig, quality = "BELOW EMA", 2
        elif abs_prox <= best_pct:
            sig, quality = "BEST TIMING", 5
        elif abs_prox <= near_pct:
            sig, quality = "NEAR EMA", 3
        elif abs_prox <= ext_pct:
            sig, quality = "SLIGHTLY EXTENDED", 1
        else:
            sig, quality = "EXTENDED", 0
        is_extended = abs_prox > ext_pct
        is_near = abs_prox <= best_pct
    else:
        prox, sig, quality, is_extended, is_near = 0.0, "INSUFFICIENT_DATA", 0, False, False

    zone = "Breakout" if change_pct > 0.05 else ("Demand" if change_pct > 0.01 else "None")

    us_cfg = cfg.get("universe_score", {})
    shortlist_th = us_cfg.get("shortlist_threshold", 3)
    score = sum([
        1 if zone in ["Demand", "Breakout"] else 0,
        1 if change_pct > 0.02 else 0,
        1 if change_pct > 0 else 0,
        1 if abs(change_pct) > 0.005 else 0,
        1 if not is_extended else 0,
        1 if is_near else 0,
    ])

    # Real probability scores from live market data
    macro_score = {"RISK ON": 2, "NEUTRAL": 1, "RISK OFF": 0}.get(global_risk, 1)

    sector_score = 0
    if sector_scores and sector in sector_scores:
        ms = sector_scores[sector]
        sr_cfg = cfg.get("sector_rotation", {})
        strong_th = sr_cfg.get("strong_inflow_score", 5)
        mild_th = sr_cfg.get("mild_inflow_score", 2)
        if ms >= strong_th:
            sector_score = 2
        elif ms >= mild_th:
            sector_score = 1

    seasonal_score = _compute_seasonal_score(closes)

    prob = {
        "macro": macro_score,
        "sector": sector_score,
        "event": 0,
        "seasonal": seasonal_score,
        "statistical": 2 if sig == "BEST TIMING" else 1 if sig == "NEAR EMA" else 0,
        "technical": min(score, 2),
    }
    final_score = sum(prob.values())

    scr_cfg = cfg.get("screener", {})
    strong_buy_th = scr_cfg.get("strong_buy_threshold", 8)
    buy_th = scr_cfg.get("buy_threshold", 6)
    watch_th = scr_cfg.get("watch_threshold", 4)

    final_signal = (
        "STRONG BUY" if final_score >= strong_buy_th else
        "BUY" if final_score >= buy_th else
        "WATCH" if final_score >= watch_th else
        "AVOID"
    )

    return {
        "ticker": ticker,
        "name": name,
        "sector": sector,
        "price": round(price, 2),
        "change_pct": round(change_pct, 6),
        "zone": zone,
        "ema21": round(ema21, 2) if ema21 else None,
        "ema_proximity": round(prox, 2),
        "ema_signal": sig,
        "score": score,
        "shortlist": score >= shortlist_th,
        "probability_scores": prob,
        "final_score": final_score,
        "final_signal": final_signal,
    }


def build_screener():
    _update(status="building", progress=0, total=0, processed=0,
            started_at=time.time(), error=None)
    try:
        from services.nse_symbols import get_all_nse_symbols
        from routers.config import load_config
        cfg = load_config()

        symbols = get_all_nse_symbols()
        if not symbols:
            _update(status="error", error="Failed to fetch symbol list")
            return

        tickers = [s["ticker"] for s in symbols]
        meta = {s["ticker"]: s for s in symbols}
        _update(total=len(tickers))

        # Fetch real market context for probability scoring
        global_risk = "NEUTRAL"
        india_bias = "RANGE"
        sector_scores = {}

        try:
            from routers.market import get_market_data
            market_data = get_market_data()
            global_risk = market_data.get("global_risk", "NEUTRAL")
            india_bias = market_data.get("india_bias", "RANGE")
        except Exception as e:
            print(f"[screener_builder] Market data fetch failed: {e}")

        try:
            from routers.sector_rotation import get_sector_rotation
            sr_data = get_sector_rotation()
            for s in sr_data.get("sectors", []):
                sector_scores[s["sector"]] = s["momentum_score"]
        except Exception as e:
            print(f"[screener_builder] Sector rotation fetch failed: {e}")

        results = []
        batches = [tickers[i:i + BATCH_SIZE] for i in range(0, len(tickers), BATCH_SIZE)]

        for idx, batch in enumerate(batches):
            raw = None
            try:
                raw = yf.download(batch, period="3mo", progress=False,
                                  auto_adjust=True, threads=True)
                for t in batch:
                    try:
                        if isinstance(raw.columns, pd.MultiIndex):
                            if t not in raw["Close"].columns:
                                continue
                            closes_s = raw["Close"][t].dropna()
                        else:
                            closes_s = raw["Close"].dropna() if len(batch) == 1 else pd.Series(dtype=float)

                        if closes_s.empty or len(closes_s) < 5:
                            continue

                        closes = [_safe(v) for v in closes_s.tolist()]
                        m = meta.get(t, {})
                        row = _score_stock(
                            t, m.get("name", t), m.get("sector", "Unknown"),
                            closes, cfg, global_risk, india_bias, sector_scores
                        )
                        if row:
                            results.append(row)
                    except Exception:
                        pass
            except Exception as e:
                print(f"[screener_builder] Batch {idx} error: {e}")
            finally:
                del raw
                gc.collect()

            processed = min((idx + 1) * BATCH_SIZE, len(tickers))
            _update(processed=processed, progress=int(processed / len(tickers) * 100))
            time.sleep(BATCH_DELAY)

        results.sort(key=lambda x: x["final_score"], reverse=True)
        set_cache(SCREENER_CACHE_KEY, results)
        _update(status="ready", progress=100)
        print(f"[screener_builder] Done — {len(results)} stocks scored")

    except Exception as e:
        print(f"[screener_builder] Fatal: {e}")
        _update(status="error", error=str(e))


def trigger_if_needed() -> bool:
    if get_cache(SCREENER_CACHE_KEY, SCREENER_CACHE_TTL) is not None:
        return False
    state = get_screener_state()
    if state["status"] == "building":
        return False
    threading.Thread(target=build_screener, daemon=True).start()
    return True
