import io
import requests
import pandas as pd
from cache.cache import get_cache, set_cache

NIFTY500_CSV = "https://archives.nseindia.com/content/indices/ind_nifty500list.csv"
NSE_EQUITY_CSV = "https://archives.nseindia.com/content/equities/EQUITY_L.csv"  # fallback
CACHE_KEY = "nse_nifty500_symbols"
CACHE_TTL = 86400  # 24h

# Map Nifty 500 Industry values to sector rotation sector names
INDUSTRY_TO_SECTOR = {
    "Financial Services":                "Banking",
    "Banks":                             "Banking",
    "Information Technology":            "IT",
    "Pharmaceuticals & Biotechnology":   "Pharma",
    "Pharmaceuticals":                   "Pharma",
    "Healthcare":                        "Pharma",
    "Healthcare Services":               "Pharma",
    "Automobile and Auto Components":    "Auto",
    "Automobiles":                       "Auto",
    "Auto Components":                   "Auto",
    "Fast Moving Consumer Goods":        "FMCG",
    "FMCG":                              "FMCG",
    "Metals & Mining":                   "Metal",
    "Metals":                            "Metal",
    "Construction":                      "Realty",
    "Realty":                            "Realty",
    "Real Estate":                       "Realty",
    "Construction Materials":            "Infra",
    "Oil Gas & Consumable Fuels":        "Energy",
    "Oil & Gas":                         "Energy",
    "Power":                             "Energy",
    "Capital Goods":                     "Infra",
    "Infrastructure":                    "Infra",
    "Media Entertainment & Publication": "Media",
    "Media":                             "Media",
    "Consumer Services":                 "Consumption",
    "Consumer Durables":                 "Consumption",
    "Textiles":                          "Consumption",
    "Telecommunication":                 "IT",
    "Diversified":                       "Unknown",
    "Chemicals":                         "Unknown",
    "Forest Materials":                  "Unknown",
    "Services":                          "Unknown",
    "Insurance":                         "Banking",
}


def _map_sector(industry: str) -> str:
    """Map NSE Industry name to sector rotation sector name."""
    if not industry or industry == "nan":
        return "Unknown"
    # Try exact match first
    sector = INDUSTRY_TO_SECTOR.get(industry)
    if sector:
        return sector
    # Try partial match
    industry_lower = industry.lower()
    for key, val in INDUSTRY_TO_SECTOR.items():
        if key.lower() in industry_lower or industry_lower in key.lower():
            return val
    return "Unknown"


def get_all_nse_symbols() -> list:
    cached = get_cache(CACHE_KEY, CACHE_TTL)
    if cached:
        return cached

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,*/*",
    }

    # Try Nifty 500 CSV first
    try:
        r = requests.get(NIFTY500_CSV, headers=headers, timeout=30)
        r.raise_for_status()

        df = pd.read_csv(io.StringIO(r.text))
        df.columns = df.columns.str.strip()

        # Nifty 500 CSV columns: Company Name, Industry, Symbol, Series, ISIN Code
        sym_col = "Symbol"
        name_col = "Company Name"
        industry_col = "Industry"

        symbols = []
        for _, row in df.iterrows():
            sym = str(row.get(sym_col, "")).strip()
            name = str(row.get(name_col, sym)).strip()
            industry = str(row.get(industry_col, "")).strip()
            if sym and sym != "nan":
                symbols.append({
                    "ticker": f"{sym}.NS",
                    "symbol": sym,
                    "name": name,
                    "sector": _map_sector(industry),
                    "industry": industry,
                })

        if symbols:
            set_cache(CACHE_KEY, symbols)
            print(f"[nse_symbols] Loaded {len(symbols)} Nifty 500 symbols")
            return symbols

    except Exception as e:
        print(f"[nse_symbols] Failed to fetch Nifty 500 list: {e}")

    # Fallback: all NSE EQ stocks
    try:
        r = requests.get(NSE_EQUITY_CSV, headers=headers, timeout=30)
        r.raise_for_status()

        df = pd.read_csv(io.StringIO(r.text))
        df.columns = df.columns.str.strip()

        if "SERIES" in df.columns:
            df = df[df["SERIES"].str.strip() == "EQ"]

        symbols = []
        for _, row in df.iterrows():
            sym = str(row["SYMBOL"]).strip()
            name = str(row.get("NAME OF COMPANY", sym)).strip()
            if sym and sym != "nan":
                symbols.append({
                    "ticker": f"{sym}.NS",
                    "symbol": sym,
                    "name": name,
                    "sector": "Unknown",
                    "industry": "Unknown",
                })

        set_cache(CACHE_KEY, symbols)
        print(f"[nse_symbols] Fallback: Loaded {len(symbols)} NSE EQ symbols")
        return symbols

    except Exception as e:
        print(f"[nse_symbols] Failed to fetch fallback symbol list: {e}")
        return []
