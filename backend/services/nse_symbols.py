import io
import requests
import pandas as pd
from cache.cache import get_cache, set_cache

NSE_EQUITY_CSV = "https://archives.nseindia.com/content/equities/EQUITY_L.csv"
CACHE_KEY = "nse_all_symbols_eq"
CACHE_TTL = 86400  # 24h


def get_all_nse_symbols() -> list:
    cached = get_cache(CACHE_KEY, CACHE_TTL)
    if cached:
        return cached

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,*/*",
        }
        r = requests.get(NSE_EQUITY_CSV, headers=headers, timeout=30)
        r.raise_for_status()

        df = pd.read_csv(io.StringIO(r.text))
        df.columns = df.columns.str.strip()

        # Keep only EQ series (ordinary equity shares — maps to yfinance .NS)
        if "SERIES" in df.columns:
            df = df[df["SERIES"].str.strip() == "EQ"]

        sym_col = "SYMBOL"
        name_col = "NAME OF COMPANY"

        symbols = []
        for _, row in df.iterrows():
            sym = str(row[sym_col]).strip()
            name = str(row[name_col]).strip() if name_col in df.columns else sym
            if sym and sym != "nan":
                symbols.append({
                    "ticker": f"{sym}.NS",
                    "symbol": sym,
                    "name": name,
                    "sector": "Unknown",
                })

        set_cache(CACHE_KEY, symbols)
        print(f"[nse_symbols] Loaded {len(symbols)} NSE EQ symbols")
        return symbols

    except Exception as e:
        print(f"[nse_symbols] Failed to fetch symbol list: {e}")
        return []
