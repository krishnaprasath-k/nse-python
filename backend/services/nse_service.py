import requests
from cache.cache import get_cache, set_cache
import time

class NSEService:
    BASE_URL = "https://www.nseindia.com"

    def __init__(self):
        self.session = requests.Session()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": "https://www.nseindia.com",
            "X-Requested-With": "XMLHttpRequest",
            "Connection": "keep-alive",
        }
        self.session_time = 0

    def _ensure_session(self):
        """Refresh session cookies every 5 minutes (NSE sessions expire quickly)."""
        if time.time() - self.session_time > 300:
            try:
                r = self.session.get(
                    self.BASE_URL,
                    headers=self.headers,
                    timeout=10,
                )
                if r.status_code == 200:
                    self.session_time = time.time()
                time.sleep(0.5)
            except Exception as e:
                print(f"[NSE] Error initializing session: {e}")

    def _api_get(self, path: str, timeout: int = 10):
        """Make request to NSE API with session & retry."""
        self._ensure_session()
        url = f"{self.BASE_URL}{path}"
        attempts = 2
        for attempt in range(attempts):
            try:
                r = self.session.get(url, headers=self.headers, timeout=timeout)
                if r.status_code == 200:
                    return r.json()
                elif r.status_code == 401 or r.status_code == 403:
                    # Session expired, refresh and retry
                    print(f"[NSE] Session expired (HTTP {r.status_code}), refreshing...")
                    self.session_time = 0
                    self._ensure_session()
                else:
                    print(f"[NSE] HTTP {r.status_code} for {path}")
            except Exception as e:
                print(f"[NSE] Request error for {path}: {e}")
                if attempt == 0:
                    self.session_time = 0
                    self._ensure_session()
        return None

    def get_market_status(self):
        cache_key = "nse_market_status"
        cached = get_cache(cache_key, 180)  # 3 mins
        if cached:
            return cached
        data = self._api_get("/api/marketStatus")
        if data:
            set_cache(cache_key, data)
            return data
        return {"marketState": [{"marketStatus": "Closed", "tradeDate": str(time.time())}]}

    def get_fii_dii(self):
        cache_key = "nse_fii_dii_v2"
        cached = get_cache(cache_key, 1800)  # 30 mins
        if cached:
            return cached
        try:
            data = self._api_get("/api/fiidiiTradeReact")
            if data:
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
            print(f"[NSE] FII/DII error: {e}")

        return {
            "fii_net": 0,
            "dii_net": 0,
            "fii_status": "Selling",
            "dii_status": "Selling",
        }

    def get_all_indices(self):
        """
        Fetch all NSE indices data.
        Returns a list of dicts with keys: index, last, percentChange, previousClose, etc.
        """
        cache_key = "nse_all_indices"
        cached = get_cache(cache_key, 180)  # 3 mins
        if cached:
            return cached
        data = self._api_get("/api/allIndices")
        if data and "data" in data:
            result = data["data"]
            set_cache(cache_key, result)
            return result
        return []

    def get_stock_quote(self, symbol: str):
        """
        Fetch stock quote for an individual NSE-listed symbol.
        symbol should be like 'RELIANCE', 'SBIN', etc. (without .NS)
        """
        cache_key = f"nse_stock_quote_{symbol}"
        cached = get_cache(cache_key, 180)  # 3 mins
        if cached:
            return cached
        data = self._api_get(f"/api/quote-equity?symbol={symbol}")
        if data:
            set_cache(cache_key, data)
            return data
        return None

    def get_stock_trade_info(self, symbol: str):
        """
        Fetch trade info for a stock (volume, deliverable, etc.)
        """
        cache_key = f"nse_trade_info_{symbol}"
        cached = get_cache(cache_key, 300)
        if cached:
            return cached
        data = self._api_get(f"/api/quote-equity?symbol={symbol}&section=trade_info")
        if data:
            set_cache(cache_key, data)
            return data
        return None

    def get_gainers_losers(self, index_name: str = "NIFTY 50"):
        """
        Fetch gainers and losers for an index.
        """
        cache_key = f"nse_gainers_losers_{index_name}"
        cached = get_cache(cache_key, 300)
        if cached:
            return cached

        # NSE uses URL encoding
        encoded = index_name.replace(" ", "%20")
        data = self._api_get(f"/api/live-analysis-variations?index={encoded}")
        if data:
            set_cache(cache_key, data)
            return data
        return None


nse_service = NSEService()
