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

@router.get("/sector-rotation")
def get_sector_rotation() -> dict:
    cache_key = "sector_rotation"
    cached = get_cache(cache_key, 900)
    if cached: return cached

    # Load config thresholds
    from routers.config import load_config
    cfg = load_config()
    sr_cfg = cfg.get("sector_rotation", {})
    strong_th = sr_cfg.get("strong_inflow_score", 3)
    mild_th = sr_cfg.get("mild_inflow_score", 1)
    
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
                    # With only current data we can't compute multi-period returns
                    # But we can at least show the sector with 1-day return
                    results.append({
                        "sector":           sector,
                        "ticker":           ticker,
                        "current":          round(nse_data["price"], 2),
                        "ret_1d":           round(nse_data["change_pct"] * 100, 2),
                        "ret_1w":           round(nse_data["change_pct"] * 100, 2),  # Approximate
                        "ret_1m":           0,
                        "ret_3m":           0,
                        "momentum_score":   1 if nse_data["change_pct"] > 0 else -1,
                        "rotation_signal":  "MILD INFLOW" if nse_data["change_pct"] > 0 else "MILD OUTFLOW",
                        "trend":            "RISING" if nse_data["change_pct"] > 0 else "FALLING",
                    })
                continue
            
            if 'Close' not in df.columns:
                continue

            hist = df.dropna(subset=['Close'])
            if hist.empty or len(hist) < 20:
                continue
                
            current = _safe_float(hist["Close"].iloc[-1])
            prev_1d = _safe_float(hist["Close"].iloc[-2])
            prev_1w = _safe_float(hist["Close"].iloc[-6]) if len(hist) >= 6 else prev_1d
            prev_1m = _safe_float(hist["Close"].iloc[-22]) if len(hist) >= 22 else prev_1d
            prev_3m = _safe_float(hist["Close"].iloc[0])
            
            if prev_1d == 0 or current == 0:
                continue

            ret_1d = round(((current - prev_1d) / prev_1d) * 100, 2)
            ret_1w = round(((current - prev_1w) / prev_1w) * 100, 2) if prev_1w != 0 else 0
            ret_1m = round(((current - prev_1m) / prev_1m) * 100, 2) if prev_1m != 0 else 0
            ret_3m = round(((current - prev_3m) / prev_3m) * 100, 2) if prev_3m != 0 else 0
            
            momentum_score = (
                (1 if ret_1d > 0 else -1) +
                (1 if ret_1w > 0 else -1) +
                (1 if ret_1m > 0 else -1) +
                (1 if ret_3m > 0 else -1)
            )
            
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
