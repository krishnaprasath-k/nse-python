from fastapi import APIRouter
import yfinance as yf
import pandas as pd
import time
from cache.cache import get_cache, set_cache

router = APIRouter()

# NSE Sector ETFs / Index proxies
SECTOR_TICKERS = {
    "Banking":       "^NSEBANK",        # BankNifty
    "IT":            "^CNXIT",          # Nifty IT Index
    "Pharma":        "^CNXPHARMA",      # Nifty Pharma
    "Auto":          "^CNXAUTO",        # Nifty Auto
    "FMCG":          "^CNXFMCG",        # Nifty FMCG
    "Metal":         "^CNXMETAL",       # Nifty Metal
    "Realty":        "^CNXREALTY",      # Nifty Realty
    "Energy":        "^CNXENERGY",      # Nifty Energy
    "Infra":         "^CNXINFRA",       # Nifty Infra
    "PSU Bank":      "^CNXPSUBANK",     # PSU Bank Index
    "Media":         "^CNXMEDIA",       # Nifty Media
    "Consumption":   "^CNXCONSUMPTION", # Nifty India Consumption
}

@router.get("/sector-rotation")
def get_sector_rotation() -> dict:
    cache_key = "sector_rotation"
    cached = get_cache(cache_key, 900)
    if cached: return cached

    results = []
    
    tickers_list = list(SECTOR_TICKERS.values())
    try:
        data = yf.download(tickers_list, period="3mo", group_by="ticker")
    except Exception as e:
        print(f"Bulk download failed: {e}")
        data = None

    for sector, ticker in SECTOR_TICKERS.items():
        try:
            if data is None:
                continue
            
            # yf.download with group_by="ticker" returns a multiindex dataframe
            # where the topmost level of columns is the ticker.
            try:
                hist = data[ticker].dropna() if len(tickers_list) > 1 else data.dropna()
            except Exception:
                continue
                
            if hist.empty or len(hist) < 20:
                continue
            
            if 'Close' not in hist.columns:
                continue
                
            current = float(hist["Close"].iloc[-1])
            prev_1d = float(hist["Close"].iloc[-2])
            prev_1w = float(hist["Close"].iloc[-6]) if len(hist) >= 6 else prev_1d
            prev_1m = float(hist["Close"].iloc[-22]) if len(hist) >= 22 else prev_1d
            prev_3m = float(hist["Close"].iloc[0])
            
            ret_1d = round(((current - prev_1d) / prev_1d) * 100, 2)
            ret_1w = round(((current - prev_1w) / prev_1w) * 100, 2)
            ret_1m = round(((current - prev_1m) / prev_1m) * 100, 2)
            ret_3m = round(((current - prev_3m) / prev_3m) * 100, 2)
            
            # Relative strength vs Nifty 50 (momentum score)
            # Positive = outperforming Nifty
            momentum_score = (
                (1 if ret_1d > 0 else -1) +
                (1 if ret_1w > 0 else -1) +
                (1 if ret_1m > 0 else -1) +
                (1 if ret_3m > 0 else -1)
            )
            
            # Rotation signal
            if momentum_score >= 3:
                rotation_signal = "STRONG INFLOW"
                trend = "RISING"
            elif momentum_score >= 1:
                rotation_signal = "MILD INFLOW"
                trend = "RISING"
            elif momentum_score <= -3:
                rotation_signal = "STRONG OUTFLOW"
                trend = "FALLING"
            elif momentum_score <= -1:
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
            
            time.sleep(0.3)  # rate limit protection
            
        except Exception as e:
            print(f"Sector {sector} error: {e}")
            continue
    
    # Sort by momentum score (best performing first)
    results.sort(key=lambda x: x["momentum_score"], reverse=True)
    
    # Identify top 3 rising and top 3 falling
    rising  = [r for r in results if r["trend"] == "RISING"][:3]
    falling = [r for r in results if r["trend"] == "FALLING"][-3:]
    
    # Map to Global_Macro signal (replicates Trade_Dashboard D4)
    # If S&P up: prefer GROWTH sectors (IT, Banking, Auto)
    # If S&P down: prefer DEFENSIVE sectors (FMCG, Pharma, PSU)
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
        "rotation_summary": f"Money flowing into: {', '.join(top_rising_names)}",
    }
    set_cache(cache_key, res)
    return res
