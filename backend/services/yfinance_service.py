import yfinance as yf
from cache.cache import get_cache, set_cache
import pandas as pd
import numpy as np
import time
import os
import httpx
import re
from services.nse_service import nse_service

# FRED API key
FRED_API_KEY = os.getenv("FRED_API_KEY", "8e243b952d9d9db9a3e4fcf4becc25ba")

# ── Helpers ──────────────────────────────────────────────────────────────

def _flatten_yf_download(data, ticker=None):
    """
    yfinance >= 1.0 returns MultiIndex columns by default.
    This safely flattens the DataFrame to single-level columns.
    """
    if data is None or data.empty:
        return pd.DataFrame()

    # If columns are MultiIndex, flatten them
    if isinstance(data.columns, pd.MultiIndex):
        # For single ticker: columns like ('Close', 'TICKER') -> 'Close'
        # For group_by='ticker': columns like ('TICKER', 'Close') -> keep as is
        if data.columns.nlevels == 2:
            # Check if first level is price type or ticker
            first_levels = data.columns.get_level_values(0).unique().tolist()
            price_cols = ['Open', 'High', 'Low', 'Close', 'Volume', 'Adj Close']
            
            if any(c in price_cols for c in first_levels):
                # Format: (Price, Ticker) - get just Price level
                data.columns = data.columns.get_level_values(0)
            elif ticker and ticker in first_levels:
                # Format: (Ticker, Price) with group_by='ticker'
                data = data[ticker]
            else:
                # Try droplevel
                try:
                    data.columns = data.columns.droplevel(1)
                except Exception:
                    pass
    return data


def _safe_float(val):
    """Safely convert to float, handling Series, ndarray, etc."""
    if val is None:
        return 0.0
    if isinstance(val, (pd.Series, np.ndarray)):
        val = val.item() if val.size == 1 else val.iloc[0] if hasattr(val, 'iloc') else float(val[0])
    try:
        f = float(val)
        return f if not (np.isnan(f) or np.isinf(f)) else 0.0
    except (ValueError, TypeError):
        return 0.0


# ── Google Finance Fallback ─────────────────────────────────────────────

# Mapping of our internal tickers to Google Finance identifiers
GOOGLE_FINANCE_MAP = {
    "^GSPC":      "SPX:INDEXSP",
    "^IXIC":      "IXIC:INDEXNASDAQ",       # NASDAQ Composite -> .IXIC:INDEXNASDAQ
    "^NSEI":      "NIFTY_50:INDEXNSE",
    "^NSEBANK":   "NIFTY_BANK:INDEXNSE",
    "^INDIAVIX":  "INDIA_VIX:INDEXNSE",
    "CL=F":       "CL%3DF:NYSEAMERICAN",     # Crude Oil Futures
    "UUP":        "UUP:NYSEARCA",
}


def _scrape_google_finance(ticker: str) -> dict | None:
    """
    Scrape current price from Google Finance as a fallback.
    Returns {"price": float, "change_pct": float, "prev": float} or None.
    """
    gf_id = GOOGLE_FINANCE_MAP.get(ticker)
    if not gf_id:
        # For NSE stocks like RELIANCE.NS -> RELIANCE:NSE
        if ticker.endswith(".NS"):
            symbol = ticker.replace(".NS", "")
            gf_id = f"{symbol}:NSE"
        else:
            return None

    url = f"https://www.google.com/finance/quote/{gf_id}"
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
        r = httpx.get(url, headers=headers, timeout=10, follow_redirects=True)
        if r.status_code != 200:
            return None

        html = r.text

        # Extract price from data-last-price attribute
        price_match = re.search(r'data-last-price="([^"]+)"', html)
        change_match = re.search(r'data-last-normal-market-timestamp="[^"]*"[^>]*data-currency-code="[^"]*"[^>]*', html)
        pct_match = re.search(r'data-last-price="[^"]*"[^>]*data-change-percent="([^"]+)"', html)
        
        # Alternative regex patterns
        if not price_match:
            # Try the YMlKec class pattern
            price_match = re.search(r'class="YMlKec fxKbKc"[^>]*>([0-9,]+\.?\d*)', html)
            if price_match:
                price = float(price_match.group(1).replace(",", ""))
            else:
                return None
        else:
            price = float(price_match.group(1).replace(",", ""))
        
        change_pct = 0.0
        if pct_match:
            try:
                change_pct = float(pct_match.group(1)) / 100
            except (ValueError, TypeError):
                pass
        else:
            # Try percentage extraction from page
            pct_alt = re.search(r'data-change-percent="([^"]+)"', html)
            if pct_alt:
                try:
                    change_pct = float(pct_alt.group(1)) / 100
                except (ValueError, TypeError):
                    pass

        prev = price / (1 + change_pct) if change_pct != 0 else price

        return {
            "price": round(price, 2),
            "change_pct": round(change_pct, 6),
            "prev": round(prev, 2),
        }
    except Exception as e:
        print(f"Google Finance fallback failed for {ticker}: {e}")
        return None


# ── NSE India Fallback for Indices ──────────────────────────────────────

NSE_INDEX_MAP = {
    "^NSEI":      "NIFTY 50",
    "^NSEBANK":   "NIFTY BANK",
    "^INDIAVIX":  "INDIA VIX",
    "^CNXIT":     "NIFTY IT",
    "^CNXPHARMA": "NIFTY PHARMA",
    "^CNXAUTO":   "NIFTY AUTO",
    "^CNXFMCG":   "NIFTY FMCG",
    "^CNXMETAL":  "NIFTY METAL",
    "^CNXREALTY":  "NIFTY REALTY",
    "^CNXENERGY":  "NIFTY ENERGY",
    "^CNXINFRA":   "NIFTY INFRA",
    "^CNXPSUBANK": "NIFTY PSU BANK",
    "^CNXMEDIA":   "NIFTY MEDIA",
    "^CNXCONSUMPTION": "NIFTY INDIA CONSUMPTION",
}


def _fetch_nse_index_data(ticker: str) -> dict | None:
    """
    Fetch index data directly from NSE India API.
    Returns {"price": float, "change_pct": float, "prev": float} or None.
    """
    nse_name = NSE_INDEX_MAP.get(ticker)
    if not nse_name:
        return None

    try:
        data = nse_service.get_all_indices()
        if not data:
            return None

        for idx in data:
            if idx.get("index") == nse_name:
                price = float(idx.get("last", 0))
                pct = float(idx.get("percentChange", 0)) / 100  # NSE returns as percentage
                prev_close = float(idx.get("previousClose", price))
                return {
                    "price": price,
                    "change_pct": pct,
                    "prev": prev_close,
                }
        return None
    except Exception as e:
        print(f"NSE index fallback failed for {ticker}: {e}")
        return None


def _fetch_nse_stock_quote(symbol: str) -> dict | None:
    """
    Fetch individual stock quote from NSE India API.
    symbol should be like 'RELIANCE' (without .NS)
    Returns {"price", "change_pct", "prev", "open", "high", "low", "volume"} or None.
    """
    try:
        data = nse_service.get_stock_quote(symbol)
        if not data:
            return None

        price_info = data.get("priceInfo", {})
        price = float(price_info.get("lastPrice", 0))
        pct = float(price_info.get("pChange", 0)) / 100
        prev_close = float(price_info.get("previousClose", price))
        open_price = float(price_info.get("open", price))
        high = float(price_info.get("intraDayHighLow", {}).get("max", price))
        low = float(price_info.get("intraDayHighLow", {}).get("min", price))

        return {
            "price": price,
            "change_pct": pct,
            "prev": prev_close,
            "open": open_price,
            "high": high,
            "low": low,
        }
    except Exception as e:
        print(f"NSE stock quote fallback failed for {symbol}: {e}")
        return None


# ── Main Functions ──────────────────────────────────────────────────────

def get_indices(period="5d"):
    """
    Fetch market indices data.
    Strategy: yfinance first → NSE India fallback → Google Finance fallback
    """
    cache_key = f"yf_indices_{period}"
    cached = get_cache(cache_key, 180)  # 3 mins
    if cached:
        return cached

    tickers = ["^NSEI", "^NSEBANK", "^INDIAVIX", "^GSPC", "^IXIC", "UUP", "CL=F"]
    res = {}

    # ── Attempt 1: yfinance batch download ──
    try:
        batch = yf.download(tickers, period=period, progress=False, threads=True)
        if batch is not None and not batch.empty and isinstance(batch.columns, pd.MultiIndex):
            close_df = batch["Close"] if "Close" in batch.columns.get_level_values(0) else None
            if close_df is not None:
                for t in tickers:
                    try:
                        if t not in close_df.columns:
                            continue
                        closes = close_df[t].dropna()
                        if len(closes) < 1:
                            continue
                        current_close = _safe_float(closes.iloc[-1])
                        prev_close = _safe_float(closes.iloc[-2]) if len(closes) > 1 else current_close
                        if current_close == 0:
                            continue
                        change_pct = (current_close - prev_close) / prev_close if prev_close != 0 else 0
                        res[t] = {"price": float(current_close), "change_pct": float(change_pct), "prev": float(prev_close)}
                    except Exception as e:
                        print(f"[yfinance batch] Failed to extract {t}: {e}")
    except Exception as e:
        print(f"[yfinance] Batch download failed: {e}")

    # Individual fallback for any tickers missed by the batch
    missing_yf = [t for t in tickers if t not in res or res[t]["price"] == 0]
    if missing_yf:
        print(f"[yfinance] Individual fallback for: {missing_yf}")
        for t in missing_yf:
            try:
                time.sleep(0.2)
                data = yf.download(t, period=period, progress=False, multi_level_index=False)
                data = _flatten_yf_download(data, t)
                if data is None or data.empty or 'Close' not in data.columns:
                    continue
                closes = data['Close'].dropna()
                if len(closes) < 1:
                    continue
                current_close = _safe_float(closes.iloc[-1])
                prev_close = _safe_float(closes.iloc[-2]) if len(closes) > 1 else current_close
                if current_close == 0:
                    continue
                change_pct = (current_close - prev_close) / prev_close if prev_close != 0 else 0
                res[t] = {"price": float(current_close), "change_pct": float(change_pct), "prev": float(prev_close)}
            except Exception as e:
                print(f"[yfinance individual] Failed for {t}: {e}")

    # ── Attempt 2: NSE India fallback for missing Indian indices ──
    nse_tickers = ["^NSEI", "^NSEBANK", "^INDIAVIX"]
    missing_nse = [t for t in nse_tickers if t not in res or res[t]["price"] == 0]
    if missing_nse:
        print(f"[Fallback] NSE India API for: {missing_nse}")
        for t in missing_nse:
            nse_data = _fetch_nse_index_data(t)
            if nse_data and nse_data["price"] > 0:
                res[t] = nse_data

    # ── Attempt 3: Google Finance fallback for still-missing tickers ──
    still_missing = [t for t in tickers if t not in res or res[t]["price"] == 0]
    if still_missing:
        print(f"[Fallback] Google Finance for: {still_missing}")
        for t in still_missing:
            gf_data = _scrape_google_finance(t)
            if gf_data and gf_data["price"] > 0:
                res[t] = gf_data

    # ── FRED for 10Y Treasury Yield ──
    try:
        from fredapi import Fred
        fred = Fred(api_key=FRED_API_KEY)
        t_yield = fred.get_series('DGS10', limit=5).dropna()
        if len(t_yield) >= 2:
            res["TLT"] = {
                "price": float(t_yield.iloc[-1]),
                "change_pct": float((t_yield.iloc[-1] - t_yield.iloc[-2]) / t_yield.iloc[-2]),
                "prev": float(t_yield.iloc[-2]),
            }
        else:
            res["TLT"] = {"price": 4.0, "change_pct": 0, "prev": 4.0}
    except Exception as e:
        print(f"Error fetching FRED yield data: {e}")
        res["TLT"] = {"price": 4.0, "change_pct": 0, "prev": 4.0}

    if res:
        set_cache(cache_key, res)
    return res


def get_stock_history(ticker, period="2y", interval="1d"):
    """
    Fetch stock price history.
    Strategy: yfinance Ticker.history() first → yf.download fallback
    """
    cache_key = f"yf_stock_hist_{ticker}_{period}_{interval}"
    cached = get_cache(cache_key, 3600)  # 1 hour
    if cached:
        return pd.DataFrame(cached)

    # Method 1: Ticker.history() — returns flat columns reliably
    try:
        data = yf.Ticker(ticker).history(period=period, interval=interval)
        if data is not None and not data.empty:
            data.reset_index(inplace=True)
            date_col = data.columns[0]
            data['Date'] = data[date_col].apply(
                lambda x: x.strftime('%Y-%m-%d') if pd.notnull(x) else None
            )
            set_cache(cache_key, data.to_dict(orient='records'))
            return data
    except Exception as e:
        print(f"[yfinance Ticker.history] Failed for {ticker}: {e}")

    # Method 2: yf.download with multi_level_index=False
    try:
        data = yf.download(ticker, period=period, interval=interval, progress=False, multi_level_index=False)
        data = _flatten_yf_download(data, ticker)
        if data is not None and not data.empty:
            data.reset_index(inplace=True)
            date_col = data.columns[0]
            data['Date'] = data[date_col].apply(
                lambda x: x.strftime('%Y-%m-%d') if pd.notnull(x) else None
            )
            set_cache(cache_key, data.to_dict(orient='records'))
            return data
    except Exception as e:
        print(f"[yfinance download] Failed for {ticker}: {e}")

    print(f"[WARN] All methods failed for stock history: {ticker}")
    return pd.DataFrame()


def get_stock_info(ticker):
    cache_key = f"yf_stock_info_{ticker}"
    cached = get_cache(cache_key, 86400)  # 1 day
    if cached:
        return cached

    try:
        info = yf.Ticker(ticker).info
        res = {
            "name": info.get("shortName", ticker),
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
        }
        set_cache(cache_key, res)
        return res
    except Exception as e:
        print(f"[yfinance] get_stock_info failed for {ticker}: {e}")
        # Fallback: try NSE API for .NS stocks
        if ticker.endswith(".NS"):
            try:
                symbol = ticker.replace(".NS", "")
                data = nse_service.get_stock_quote(symbol)
                if data:
                    info_data = data.get("info", {})
                    res = {
                        "name": info_data.get("companyName", symbol),
                        "sector": info_data.get("industry", "Unknown"),
                        "industry": info_data.get("industry", "Unknown"),
                    }
                    set_cache(cache_key, res)
                    return res
            except Exception:
                pass
        return {"name": ticker, "sector": "Unknown", "industry": "Unknown"}


def download_multiple_tickers(tickers: list, period: str = "1mo", group_by: str = "ticker") -> dict:
    """
    Download data for multiple tickers with fallback.
    Returns a dict of {ticker: DataFrame} with flat columns.
    """
    result = {}

    # Method 1: yf.download bulk (fastest)
    try:
        data = yf.download(
            tickers, period=period, group_by="ticker",
            progress=False, threads=True
        )
        if data is not None and not data.empty:
            for t in tickers:
                try:
                    if isinstance(data.columns, pd.MultiIndex):
                        if t in data.columns.get_level_values(0):
                            df = data[t].copy()
                            # If still MultiIndex, flatten
                            if isinstance(df.columns, pd.MultiIndex):
                                df.columns = df.columns.get_level_values(0)
                            if not df.empty and 'Close' in df.columns:
                                result[t] = df
                    else:
                        # Single ticker returned flat
                        if len(tickers) == 1 and 'Close' in data.columns:
                            result[t] = data.copy()
                except Exception as e:
                    print(f"[bulk download] Error extracting {t}: {e}")
    except Exception as e:
        print(f"[yfinance] Bulk download failed: {e}")

    # Method 2: Individual download fallback for missing tickers
    missing = [t for t in tickers if t not in result]
    if missing:
        print(f"[Fallback] Individual download for: {missing}")
        for t in missing:
            try:
                time.sleep(0.3)
                df = yf.download(t, period=period, progress=False, multi_level_index=False)
                df = _flatten_yf_download(df, t)
                if df is not None and not df.empty and 'Close' in df.columns:
                    result[t] = df
            except Exception as e:
                print(f"[yfinance individual] Failed for {t}: {e}")

    # Method 3: NSE India fallback for .NS stocks
    still_missing = [t for t in tickers if t not in result]
    nse_missing = [t for t in still_missing if t.endswith(".NS") or t.startswith("^")]
    if nse_missing:
        print(f"[Fallback] NSE API for: {nse_missing}")
        for t in nse_missing:
            if t.startswith("^"):
                # Index
                nse_data = _fetch_nse_index_data(t)
                if nse_data and nse_data["price"] > 0:
                    # Create minimal DataFrame
                    df = pd.DataFrame([{
                        "Close": nse_data["price"],
                        "Open": nse_data["price"],
                        "High": nse_data["price"],
                        "Low": nse_data["price"],
                        "Volume": 0,
                    }])
                    result[t] = df
            elif t.endswith(".NS"):
                symbol = t.replace(".NS", "")
                nse_data = _fetch_nse_stock_quote(symbol)
                if nse_data and nse_data["price"] > 0:
                    df = pd.DataFrame([{
                        "Close": nse_data["price"],
                        "Open": nse_data.get("open", nse_data["price"]),
                        "High": nse_data.get("high", nse_data["price"]),
                        "Low": nse_data.get("low", nse_data["price"]),
                        "Volume": 0,
                    }])
                    result[t] = df

    return result
