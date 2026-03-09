from fastapi import APIRouter
from services.yfinance_service import get_stock_history, get_stock_info
from services.indicators import calculate_indicators
import pandas as pd
import numpy as np

router = APIRouter()

@router.get("/stock/{ticker}")
def get_stock_data(ticker: str):
    try:
        info = get_stock_info(ticker)
        df = get_stock_history(ticker, period="2y", interval="1d")
        
        if df.empty:
            return {"ticker": ticker, "ohlcv": [], "indicators": {}, "events": [], "name": info["name"], "sector": info["sector"]}

        # Check if Close and Volume exist
        if 'Close' not in df.columns or 'Volume' not in df.columns:
            return {"error": f"Missing columns in df: {list(df.columns)}", "df_head": df.head().to_dict()}

        df_clean = df.dropna(subset=['Close', 'Volume']).copy()
        if df_clean.empty:
            return {"ticker": ticker, "ohlcv": [], "indicators": {}, "events": [], "name": info["name"], "sector": info["sector"]}

        df_ind = calculate_indicators(df_clean)
        latest = df_ind.iloc[-1]
        
        ohlcv = []
        for _, row in df_ind.fillna(0).iterrows():
            try:
                ohlcv.append({
                    "time": str(row['Date']),
                    "open": float(row['Open']),
                    "high": float(row['High']),
                    "low": float(row['Low']),
                    "close": float(row['Close']),
                    "volume": float(row['Volume']),
                    "vol_spike": bool(row.get('vol_spike', False))
                })
            except:
                pass

        def safe_float(v):
            return float(v) if pd.notna(v) and not np.isinf(v) else 0.0

        indicators_res = {
            "ma20": safe_float(latest.get('MA20', 0)),
            "ma50": safe_float(latest.get('MA50', 0)),
            "ma200": safe_float(latest.get('MA200', 0)),
            "atr14": safe_float(latest.get('ATR14', 0)),
            "return_1d": safe_float(latest.get('return_1d', 0)),
            "return_5d": safe_float(latest.get('return_5d', 0)),
            "return_20d": safe_float(latest.get('return_20d', 0)),
            "vol_ma20": safe_float(latest.get('vol_ma20', 0)),
            "vol_spike": bool(latest.get('vol_spike', False)),
            "momentum_score": safe_float(latest.get('momentum_score', 0)),
            "bias": str(latest.get('bias', 'NEUTRAL'))
        }

        events = [] # To do: integrate yahoo actions

        return {
            "ticker": ticker,
            "name": info["name"],
            "sector": info["sector"],
            "ohlcv": ohlcv,
            "indicators": indicators_res,
            "events": events
        }
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.get("/stock/{ticker}/events")
def get_corporate_events(ticker: str):
    import yfinance as yf
    try:
        t = yf.Ticker(ticker)
        events = []

        # Dividends
        try:
            for date, amount in t.dividends.items():
                events.append({
                    "date":       str(date.date()),
                    "type":       "DIVIDEND",
                    "detail":     f"₹{round(float(amount), 2)} Dividend",
                    "color":      "purple"
                })
        except: pass

        # Stock splits
        try:
            for date, ratio in t.splits.items():
                events.append({
                    "date":   str(date.date()),
                    "type":   "SPLIT",
                    "detail": f"{ratio}:1 Split",
                    "color":  "pink"
                })
        except: pass

        # Earnings dates
        try:
            earnings = t.earnings_dates
            if earnings is not None:
                for date in earnings.index[:20]:  # last 20 results
                    events.append({
                        "date":   str(date.date()),
                        "type":   "RESULT",
                        "detail": "Quarterly Result",
                        "color":  "blue"
                    })
        except: pass

        # Sort by date descending
        events.sort(key=lambda x: x["date"], reverse=True)
        return events[:30]  # last 30 events
    except Exception as e:
        return []

@router.get("/stock/{ticker}/seasonal")
def get_seasonal_pattern(ticker: str, years: int = 10):
    import yfinance as yf
    import pandas as pd
    try:
        df = yf.download(ticker, period=f"{years}y", progress=False, auto_adjust=True)
        if df.empty: return []
        df = df[["Close"]].copy()

        # Monthly returns
        monthly = df["Close"].resample("ME").agg(["first", "last"])
        monthly["return"]   = (monthly["last"] - monthly["first"]) / monthly["first"] * 100
        monthly["month"]    = monthly.index.month
        monthly["month_name"] = monthly.index.strftime("%b")
        monthly["positive"] = monthly["return"] > 0

        summary = monthly.groupby("month_name").agg(
            avg_return  = ("return",   "mean"),
            win_rate    = ("positive", "mean"),
            count       = ("return",   "count"),
        ).round(2)

        # Fix month order
        month_order = ["Jan","Feb","Mar","Apr","May","Jun",
                       "Jul","Aug","Sep","Oct","Nov","Dec"]
        summary = summary.reindex([m for m in month_order if m in summary.index])

        result = []
        for month, row in summary.iterrows():
            result.append({
                "month":      month,
                "avg_return": round(row["avg_return"], 2) if pd.notna(row["avg_return"]) else 0,
                "win_rate":   round(row["win_rate"] * 100, 1) if pd.notna(row["win_rate"]) else 0,
                "signal":     "RISING"  if row["win_rate"] >= 0.6 else
                              "FALLING" if row["win_rate"] <= 0.4 else "MIXED",
                "years":      int(row["count"]) if pd.notna(row["count"]) else 0,
            })
        return result
    except Exception as e:
        return []

@router.get("/stock/{ticker}/correlation")
def get_correlation(ticker: str, period: str = "1y"):
    import yfinance as yf
    import pandas as pd
    try:
        peers = {
            "Nifty 50":    "^NSEI",
            "BankNifty":   "^NSEBANK",
            "Crude Oil":   "CL=F",
            "US Dollar":   "DX-Y.NYB",
            "India VIX":   "^INDIAVIX",
            "HDFCBANK":    "HDFCBANK.NS",
            "ICICIBANK":   "ICICIBANK.NS",
            "AXISBANK":    "AXISBANK.NS",
        }

        all_tickers = [ticker] + list(peers.values())
        raw = yf.download(all_tickers, period=period, progress=False, auto_adjust=True)
        if raw.empty or "Close" not in raw.columns: return []
        
        closes = raw["Close"].pct_change().dropna()
        closes.columns = [ticker] + list(peers.keys())

        if ticker not in closes.columns: return []
        
        corr = closes.corr()[ticker].drop(ticker).round(3)

        result = []
        for name, val in corr.items():
            if pd.isna(val): continue
            result.append({
                "name":       name,
                "correlation": float(val),
                "strength":   "Strong +"  if val >= 0.7  else
                              "Moderate+" if val >= 0.4  else
                              "Weak"      if val >= 0.1  else
                              "Strong -"  if val <= -0.4 else "Moderate-",
                "note":       "Moves with index — low alpha" if val >= 0.7 else
                              "Partial correlation"           if val >= 0.4 else
                              "Largely independent"           if val >= 0.1 else
                              "Hedge value"                   if val < 0   else
                              "No relationship",
            })

        result.sort(key=lambda x: abs(x["correlation"]), reverse=True)
        return result
    except Exception as e:
        return []
