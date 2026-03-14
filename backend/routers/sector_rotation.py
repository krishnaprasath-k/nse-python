from fastapi import APIRouter
import yfinance as yf
import pandas as pd
import time
from cache.cache import get_cache, set_cache
from services.yfinance_service import download_multiple_tickers, _safe_float, _fetch_nse_index_data

router = APIRouter()

# NSE Sector ETFs / Index proxies
SECTOR_TICKERS = {
    "Banking":       "^NSEBANK",
    "IT":            "^CNXIT",
    "Pharma":        "^CNXPHARMA",
    "Auto":          "^CNXAUTO",
    "FMCG":          "^CNXFMCG",
    "Metal":         "^CNXMETAL",
    "Realty":        "^CNXREALTY",
    "Energy":        "^CNXENERGY",
    "Infra":         "^CNXINFRA",
    "PSU Bank":      "^CNXPSUBANK",
    "Media":         "^CNXMEDIA",
    "Consumption":   "^CNXCONSUMPTION",
}


def _momentum_component(ret):
    """Score based on return magnitude, not just direction."""
    if abs(ret) < 0.5:
        return 0
    elif ret > 3:
        return 2
    elif ret > 0:
        return 1
    elif ret < -3:
        return -2
    else:
        return -1


def _get_daily_breakdown(hist, n=5):
    """Get last N trading days' individual returns."""
    if hist is None or len(hist) < n + 1:
        return []
    daily = []
    for i in range(n, 0, -1):
        try:
            close_today = _safe_float(hist["Close"].iloc[-i])
            close_prev = _safe_float(hist["Close"].iloc[-i - 1])
            if close_prev == 0:
                continue
            ret = round(((close_today - close_prev) / close_prev) * 100, 2)
            date_str = str(hist.index[-i].date()) if hasattr(hist.index[-i], 'date') else str(hist.index[-i])
            daily.append({"date": date_str, "return": ret})
        except Exception:
            continue
    return daily


@router.get("/sector-rotation")
def get_sector_rotation() -> dict:
    cache_key = "sector_rotation"
    cached = get_cache(cache_key, 900)
    if cached: return cached

    # Load config thresholds
    from routers.config import load_config
    cfg = load_config()
    sr_cfg = cfg.get("sector_rotation", {})
    strong_th = sr_cfg.get("strong_inflow_score", 5)
    mild_th = sr_cfg.get("mild_inflow_score", 2)

    results = []

    tickers_list = list(SECTOR_TICKERS.values())

    # Use the robust multi-ticker downloader with fallbacks
    ticker_data = download_multiple_tickers(tickers_list, period="3mo")

    for sector, ticker in SECTOR_TICKERS.items():
        try:
            df = ticker_data.get(ticker)

            # If yfinance didn't return data, try NSE India API
            if df is None or df.empty:
                nse_data = _fetch_nse_index_data(ticker)
                if nse_data and nse_data["price"] > 0:
                    results.append({
                        "sector":           sector,
                        "ticker":           ticker,
                        "current":          round(nse_data["price"], 2),
                        "ret_1d":           round(nse_data["change_pct"] * 100, 2),
                        "ret_1w":           0,
                        "ret_1m":           0,
                        "ret_3m":           0,
                        "momentum_score":   _momentum_component(nse_data["change_pct"] * 100),
                        "rotation_signal":  "MILD INFLOW" if nse_data["change_pct"] > 0 else "MILD OUTFLOW",
                        "trend":            "RISING" if nse_data["change_pct"] > 0 else "FALLING",
                        "daily_breakdown":  [],
                        "partial_data":     True,
                    })
                continue

            if 'Close' not in df.columns:
                continue

            hist = df.dropna(subset=['Close'])
            if hist.empty or len(hist) < 20:
                continue

            # Ensure index is DatetimeIndex for date-based lookback
            if not isinstance(hist.index, pd.DatetimeIndex):
                continue

            current = _safe_float(hist["Close"].iloc[-1])
            prev_1d = _safe_float(hist["Close"].iloc[-2])

            if prev_1d == 0 or current == 0:
                continue

            # Date-based lookback instead of hardcoded iloc positions
            today = hist.index[-1]
            one_week_ago = today - pd.Timedelta(days=7)
            one_month_ago = today - pd.Timedelta(days=30)

            week_mask = hist.index <= one_week_ago
            month_mask = hist.index <= one_month_ago

            prev_1w = _safe_float(hist.loc[week_mask, "Close"].iloc[-1]) if week_mask.any() else prev_1d
            prev_1m = _safe_float(hist.loc[month_mask, "Close"].iloc[-1]) if month_mask.any() else prev_1d
            prev_3m = _safe_float(hist["Close"].iloc[0])

            ret_1d = round(((current - prev_1d) / prev_1d) * 100, 2)
            ret_1w = round(((current - prev_1w) / prev_1w) * 100, 2) if prev_1w != 0 else 0
            ret_1m = round(((current - prev_1m) / prev_1m) * 100, 2) if prev_1m != 0 else 0
            ret_3m = round(((current - prev_3m) / prev_3m) * 100, 2) if prev_3m != 0 else 0

            # Magnitude-weighted momentum scoring with time-period weights
            momentum_score = (
                _momentum_component(ret_1d) * 0.5 +    # 1d gets lowest weight
                _momentum_component(ret_1w) * 1.0 +
                _momentum_component(ret_1m) * 1.5 +
                _momentum_component(ret_3m) * 2.0       # 3m gets highest weight
            )
            momentum_score = round(momentum_score, 1)

            if momentum_score >= strong_th:
                rotation_signal = "STRONG INFLOW"
                trend = "RISING"
            elif momentum_score >= mild_th:
                rotation_signal = "MILD INFLOW"
                trend = "RISING"
            elif momentum_score <= -strong_th:
                rotation_signal = "STRONG OUTFLOW"
                trend = "FALLING"
            elif momentum_score <= -mild_th:
                rotation_signal = "MILD OUTFLOW"
                trend = "FALLING"
            else:
                rotation_signal = "NEUTRAL"
                trend = "SIDEWAYS"

            results.append({
                "sector":           sector,
                "ticker":           ticker,
                "current":          round(current, 2),
                "ret_1d":           ret_1d,
                "ret_1w":           ret_1w,
                "ret_1m":           ret_1m,
                "ret_3m":           ret_3m,
                "momentum_score":   momentum_score,
                "rotation_signal":  rotation_signal,
                "trend":            trend,
                "daily_breakdown":  _get_daily_breakdown(hist, 5),
            })

        except Exception as e:
            print(f"Sector {sector} error: {e}")
            continue

    # Sort by momentum score (best performing first)
    results.sort(key=lambda x: x["momentum_score"], reverse=True)

    # Identify top 3 rising and top 3 falling
    rising  = [r for r in results if r["trend"] == "RISING"][:3]
    falling = [r for r in results if r["trend"] == "FALLING"][-3:]

    growth_sectors    = ["IT", "Banking", "Auto", "Metal", "Realty"]
    defensive_sectors = ["FMCG", "Pharma", "PSU Bank", "Energy"]

    top_rising_names  = [r["sector"] for r in rising]
    growth_in_lead    = any(s in top_rising_names for s in growth_sectors)
    preferred_theme   = "GROWTH" if growth_in_lead else "DEFENSIVE"

    res = {
        "sectors":         results,
        "rising_sectors":  rising,
        "falling_sectors": falling,
        "preferred_theme": preferred_theme,
        "rotation_summary": f"Money flowing into: {', '.join(top_rising_names)}" if top_rising_names else "No clear rotation",
    }
    set_cache(cache_key, res)
    return res
