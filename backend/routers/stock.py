from fastapi import APIRouter
from services.yfinance_service import get_stock_history, get_stock_info
from services.indicators import calculate_indicators
import pandas as pd
import numpy as np

router = APIRouter()

@router.get("/stock/{ticker}")
def get_stock_data(ticker: str):
    info = get_stock_info(ticker)
    df = get_stock_history(ticker, period="2y", interval="1d")
    
    if df.empty:
        return {"ticker": ticker, "ohlcv": [], "indicators": {}, "events": [], "name": info["name"], "sector": info["sector"]}

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
                "volume": float(row['Volume'])
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
