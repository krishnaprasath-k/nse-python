import requests
from cache.cache import get_cache, set_cache
import time

class NSEService:
    def __init__(self):
        self.session = requests.Session()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": "https://www.nseindia.com",
            "X-Requested-With": "XMLHttpRequest",
        }
        self.session_time = 0

    def _ensure_session(self):
        # Refresh session every 30 minutes
        if time.time() - self.session_time > 1800:
            try:
                self.session.get("https://www.nseindia.com", headers=self.headers, timeout=10)
                time.sleep(1)
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
        cache_key = "nse_fii_dii_v2"
        cached = get_cache(cache_key, 1800) # 30 mins
        if cached: return cached
        try:
            res = self.session.get(
                "https://www.nseindia.com/api/fiidiiTradeReact",
                headers=self.headers,
                timeout=10
            )
            data = res.json()
            
            fii_net = 0
            dii_net = 0
            for item in data:
                if item.get("category") == "FII/FPI":
                    fii_net = float(item.get("netVal", 0))
                if item.get("category") == "DII":
                    dii_net = float(item.get("netVal", 0))
            
            result = {
                "fii_net": fii_net,
                "dii_net": dii_net,
                "fii_status": "Buying" if fii_net > 0 else "Selling",
                "dii_status": "Buying" if dii_net > 0 else "Selling",
            }
            set_cache(cache_key, result)
            return result
        except Exception as e:
            return {
                "fii_net": 0,
                "dii_net": 0,
                "fii_status": "Selling",
                "dii_status": "Selling",
            }

nse_service = NSEService()
