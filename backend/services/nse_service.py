import requests
import requests
from cache.cache import get_cache, set_cache
import time

class NSEService:
    def __init__(self):
        self.session = requests.Session()
        self.headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept-Language": "en-US",
            "Accept-Encoding": "gzip, deflate",
            "Referer": "https://www.nseindia.com"
        }
        self.session_time = 0
        self._ensure_session()

    def _ensure_session(self):
        # Refresh session every 30 minutes
        if time.time() - self.session_time > 1800:
            try:
                self.session.get("https://www.nseindia.com", headers=self.headers, timeout=10)
                self.session_time = time.time()
            except Exception as e:
                print(f"Error initializing NSE session: {e}")

    def get_market_status(self):
        self._ensure_session()
        cache_key = "nse_market_status"
        cached = get_cache(cache_key, 180) # 3 mins
        if cached: return cached
        try:
            res = self.session.get("https://www.nseindia.com/api/marketStatus", headers=self.headers, timeout=10).json()
            set_cache(cache_key, res)
            return res
        except Exception as e:
            return {"marketState": [{"marketStatus": "Closed", "tradeDate": str(time.time())}]}

    def get_fii_dii(self):
        self._ensure_session()
        cache_key = "nse_fii_dii"
        cached = get_cache(cache_key, 1800) # 30 mins
        if cached: return cached
        try:
            res = self.session.get("https://www.nseindia.com/api/fiidiiTradeReact", headers=self.headers, timeout=10).json()
            set_cache(cache_key, res)
            return res
        except Exception as e:
            return []

nse_service = NSEService()
