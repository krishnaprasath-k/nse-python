from fastapi import APIRouter
from routers.market import get_market_data
from routers.stock import get_stock_data
from services.indicators import compute_final_trade_signal

router = APIRouter()

@router.get("/trade-signal/{ticker}")
def get_trade_signal(ticker: str):
    market = get_market_data()
    stock = get_stock_data(ticker)

    global_risk = market.get("global_risk", "NEUTRAL")
    india_bias = market.get("india_bias", "RANGE")
    stock_bias = stock.get("indicators", {}).get("bias", "NEUTRAL")
    
    last_close = 0
    if len(stock["ohlcv"]) > 0:
        last_close = float(stock["ohlcv"][-1].get("close", 0))
    atr = stock.get("indicators", {}).get("atr14", 0)

    trade_info = compute_final_trade_signal(global_risk, india_bias, stock_bias, last_close, atr)

    return {
        "decision": trade_info["decision"],
        "entry": trade_info["entry"],
        "stop_loss": trade_info["stop_loss"],
        "target": trade_info["target"],
        "risk_reward": trade_info["risk_reward"],
        "global_risk": global_risk,
        "india_bias": india_bias,
        "stock_bias": stock_bias
    }
