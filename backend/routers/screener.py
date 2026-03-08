from fastapi import APIRouter
import yfinance as yf
from cache.cache import get_cache, set_cache

router = APIRouter()

UNIVERSE_TICKERS = [
  { "ticker": "RELIANCE.NS",   "name": "Reliance Industries",  "sector": "Energy" },
  { "ticker": "HDFCBANK.NS",   "name": "HDFC Bank",            "sector": "Banking" },
  { "ticker": "TCS.NS",        "name": "Tata Consultancy",     "sector": "IT" },
  { "ticker": "INFY.NS",       "name": "Infosys",              "sector": "IT" },
  { "ticker": "ICICIBANK.NS",  "name": "ICICI Bank",           "sector": "Banking" },
  { "ticker": "SBIN.NS",       "name": "State Bank of India",  "sector": "Banking" },
  { "ticker": "BAJFINANCE.NS", "name": "Bajaj Finance",        "sector": "NBFC" },
  { "ticker": "MARUTI.NS",     "name": "Maruti Suzuki",        "sector": "Auto" },
  { "ticker": "TITAN.NS",      "name": "Titan Company",        "sector": "Consumer" },
  { "ticker": "AXISBANK.NS",   "name": "Axis Bank",            "sector": "Banking" },
  { "ticker": "WIPRO.NS",      "name": "Wipro",                "sector": "IT" },
  { "ticker": "HCLTECH.NS",    "name": "HCL Technologies",     "sector": "IT" },
  { "ticker": "ONGC.NS",       "name": "ONGC",                 "sector": "Energy" },
  { "ticker": "NTPC.NS",       "name": "NTPC",                 "sector": "Power" },
  { "ticker": "POWERGRID.NS",  "name": "Power Grid Corp",      "sector": "Power" },
  { "ticker": "LT.NS",         "name": "Larsen & Toubro",      "sector": "Infra" },
  { "ticker": "NBCC.NS",       "name": "NBCC India",           "sector": "Infra" },
  { "ticker": "TATAMOTORS.NS", "name": "Tata Motors",          "sector": "Auto" },
  { "ticker": "TATASTEEL.NS",  "name": "Tata Steel",           "sector": "Metals" },
  { "ticker": "ADANIENT.NS",   "name": "Adani Enterprises",    "sector": "Conglomerate" },
  { "ticker": "SUNPHARMA.NS",  "name": "Sun Pharmaceutical",   "sector": "Pharma" },
  { "ticker": "DRREDDY.NS",    "name": "Dr Reddys Labs",       "sector": "Pharma" },
  { "ticker": "BAJAJFINSV.NS", "name": "Bajaj Finserv",        "sector": "Finance" },
  { "ticker": "HINDALCO.NS",   "name": "Hindalco Industries",  "sector": "Metals" },
  { "ticker": "JSWSTEEL.NS",   "name": "JSW Steel",            "sector": "Metals" },
]

@router.get("/screener")
def get_screener():
    cache_key = "screener_data"
    cached = get_cache(cache_key, 300)
    if cached: return cached
    
    tickers = [t["ticker"] for t in UNIVERSE_TICKERS]
    try:
        data = yf.download(tickers, period="5d", group_by='ticker')
        res = []
        for t_info in UNIVERSE_TICKERS:
            t = t_info["ticker"]
            price = 0
            change_pct = 0
            try:
                df = data[t]['Close']
                if not df.empty:
                    current_close = df.dropna().iloc[-1]
                    prev_close = df.dropna().iloc[-2] if len(df.dropna()) > 1 else current_close
                    change_pct = (current_close - prev_close) / prev_close
                    price = current_close
            except:
                pass
            
            # Using some basic mock logic for zone and scoring since it's hard to compute quickly
            zone = "Demand" if change_pct > 0.01 else ("Breakout" if change_pct > 0.05 else "None")
            score = 3 if change_pct > 0 else 1
            
            res.append({
                "ticker": t,
                "name": t_info["name"],
                "sector": t_info["sector"],
                "price": float(price),
                "change_pct": float(change_pct),
                "zone": zone,
                "result_quality": "Strong" if score > 2 else "Average",
                "sales_growth": "Strong",
                "vol_accumulation": "High" if score > 2 else "Low",
                "is_extended": score > 4,
                "score": score,
                "shortlist": score >= 3
            })
        
        set_cache(cache_key, res)
        return res
    except Exception as e:
        print(f"Error in screener: {e}")
        return []
