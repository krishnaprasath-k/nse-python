from config import FRED_API_KEY
from cache.cache import get_cache, set_cache

def get_us_10y_yield():
    if not FRED_API_KEY:
        return None
    try:
        from fredapi import Fred
        fred = Fred(api_key=FRED_API_KEY)
        us10y = fred.get_series('DGS10', observation_start='2024-01-01')
        return us10y.iloc[-1]
    except Exception as e:
        print(f"Error fetching FRED API: {e}")
        return None
