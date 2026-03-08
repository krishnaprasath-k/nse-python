import yfinance as yf
from cache.cache import get_cache, set_cache
import pandas as pd

def get_indices(period="5d"):
    cache_key = f"yf_indices_{period}"
    cached = get_cache(cache_key, 180) # 3 mins
    if cached: return cached
    
    tickers = ["^NSEI", "^NSEBANK", "^INDIAVIX", "^GSPC", "^IXIC", "UUP", "CL=F", "TLT"]
    try:
        data = yf.download(tickers, period=period, group_by='ticker')
        res = {}
        for t in tickers:
            try:
                # Based on yfinance structure, getting Close data
                df = data[t]['Close']
                current_close = df.dropna().iloc[-1]
                prev_close = df.dropna().iloc[-2] if len(df.dropna()) > 1 else current_close
                change_pct = (current_close - prev_close) / prev_close
                res[t] = {
                    "price": float(current_close),
                    "change_pct": float(change_pct),
                    "prev": float(prev_close)
                }
            except Exception as e:
                print(f"Failed parsing {t}: {e}")
        
        if res:
            set_cache(cache_key, res)
        return res
    except Exception as e:
        print(f"Error fetching indices: {e}")
        return {}

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
