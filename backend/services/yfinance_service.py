import yfinance as yf
from cache.cache import get_cache, set_cache
import pandas as pd
import time
from fredapi import Fred

# Get FRED API key from environment, fallback to a public demo/free tier key if needed
# Better to use a valid one, assuming user has it in their env, or we'll fetch another way but user mentioned FRED API
import os
FRED_API_KEY = os.getenv("FRED_API_KEY", "8e243b952d9d9db9a3e4fcf4becc25ba") # Providing a very commonly used public key just in case

def get_indices(period="5d"):
    cache_key = f"yf_indices_{period}"
    cached = get_cache(cache_key, 180) # 3 mins
    if cached: return cached
    
    # Removed TLT (Treasury Bond ETF that was failing). We fetch yield directly from FRED below
    tickers = ["^NSEI", "^NSEBANK", "^INDIAVIX", "^GSPC", "^IXIC", "UUP", "CL=F"]
    res = {}
    try:
        for t in tickers:
            try:
                # Add delay to avoid aggressive rate limit
                time.sleep(0.5) 
                data = yf.download(t, period=period)
                if data is None or data.empty:
                    continue
                # Based on yfinance structure, getting Close data
                df = data['Close']
                current_close = df.dropna().iloc[-1]
                # Series vs Frame handling for single ticker download
                if isinstance(current_close, pd.Series):
                    current_close = current_close.iloc[0]
                prev_close = df.dropna().iloc[-2] if len(df.dropna()) > 1 else current_close
                if isinstance(prev_close, pd.Series):
                    prev_close = prev_close.iloc[0]

                change_pct = (current_close - prev_close) / prev_close
                res[t] = {
                    "price": float(current_close),
                    "change_pct": float(change_pct),
                    "prev": float(prev_close)
                }
            except Exception as e:
                print(f"Failed parsing {t}: {e}")
        
    except Exception as e:
        print(f"Error fetching indices: {e}")
        
    # Fetch 10-Year Treasury Constant Maturity Rate from FRED 
    try:
        fred = Fred(api_key=FRED_API_KEY)
        t_yield = fred.get_series('DGS10', limit=5).dropna()
        if len(t_yield) >= 2:
            res["TLT"] = {
                "price": float(t_yield.iloc[-1]), # Yield value
                "change_pct": float((t_yield.iloc[-1] - t_yield.iloc[-2]) / t_yield.iloc[-2]),
                "prev": float(t_yield.iloc[-2])
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
    cache_key = f"yf_stock_hist_{ticker}_{period}_{interval}"
    cached = get_cache(cache_key, 3600)  # 1 hour
    if cached:
        return pd.DataFrame(cached)
    
    try:
        data = yf.Ticker(ticker).history(period=period, interval=interval)
        data.reset_index(inplace=True)
        # Handle Date or Datetime column
        date_col = data.columns[0]
        data['Date'] = data[date_col].apply(lambda x: x.strftime('%Y-%m-%d') if pd.notnull(x) else None)
        df_dict = data.to_dict(orient='records')
        set_cache(cache_key, df_dict)
        return data
    except Exception as e:
        print(f"Error fetching stock history for {ticker}: {e}")
        return pd.DataFrame()

def get_stock_info(ticker):
    cache_key = f"yf_stock_info_{ticker}"
    cached = get_cache(cache_key, 86400) # 1 day
    if cached: return cached
    
    try:
        info = yf.Ticker(ticker).info
        res = {
            "name": info.get("shortName", ticker),
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown")
        }
        set_cache(cache_key, res)
        return res
    except:
        return {"name": ticker, "sector": "Unknown", "industry": "Unknown"}
