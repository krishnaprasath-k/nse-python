import pandas as pd
import numpy as np

def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Replicates all MONTHLY_DATA sheet calculations from the Excel model.
    Input df must have columns: Open, High, Low, Close, Volume
    """
    df['MA20']  = df['Close'].rolling(20).mean()
    df['MA50']  = df['Close'].rolling(50).mean()
    df['MA200'] = df['Close'].rolling(200).mean()

    prev_close = df['Close'].shift(1)
    df['TR'] = pd.concat([
        df['High'] - df['Low'],
        (df['High'] - prev_close).abs(),
        (df['Low']  - prev_close).abs()
    ], axis=1).max(axis=1)
    df['ATR14'] = df['TR'].rolling(14).mean()

    df['return_1d']  = df['Close'].pct_change(1)
    df['return_5d']  = df['Close'].pct_change(5)
    df['return_20d'] = df['Close'].pct_change(20)

    df['vol_ma20']   = df['Volume'].rolling(20).mean()
    df['vol_spike']  = df['Volume'].rolling(5).max() > (1.5 * df['vol_ma20'])

    df['momentum_score'] = np.sign(df['return_1d']) + np.sign(df['return_20d'])
    df['bias'] = df['momentum_score'].apply(
        lambda x: 'STRONG BULLISH' if x >= 2
                  else ('STRONG BEARISH' if x <= -2 else 'NEUTRAL')
    )
    return df

def compute_global_risk_signal(sp500_ret, tlt_today, tlt_prev, uup_today, uup_prev):
    sp_signal     = 1 if sp500_ret > 0 else -1
    yield_signal  = 1 if tlt_today > tlt_prev else -1
    dollar_signal = 1 if uup_today < uup_prev else -1
    score = sp_signal + yield_signal + dollar_signal
    label = "RISK ON" if score >= 2 else ("RISK OFF" if score <= -2 else "NEUTRAL")
    return label, score

def compute_india_signal(nifty_ret, fii_net_positive: bool, vix: float):
    nifty_signal = 1 if nifty_ret > 0 else -1
    fii_signal   = 1 if fii_net_positive else -1
    vix_signal   = 1 if vix < 20 else -1
    score = nifty_signal + fii_signal + vix_signal
    label = "STRONG" if score >= 2 else ("WEAK" if score <= -2 else "RANGE")
    return label, score

def score_stock(zone: str, result_quality: str, sales_growth: str,
                vol_accumulation: str, is_extended: bool) -> int:
    return min(5, sum([
        zone in ["Demand", "Breakout"],
        result_quality == "Strong",
        sales_growth == "Strong",
        vol_accumulation == "High",
        not is_extended
    ]))

def compute_final_trade_signal(global_risk, india_bias, stock_bias,
                                last_close: float, atr: float) -> dict:
    if stock_bias == "STRONG BULLISH" and india_bias in ["STRONG", "RANGE"] and global_risk != "RISK OFF":
        decision = "BUY TODAY"
    elif stock_bias == "STRONG BEARISH" and india_bias == "WEAK":
        decision = "SELL TODAY"
    else:
        decision = "WATCHLIST"

    stop_loss   = round(last_close - 1.5 * atr, 2)
    target      = round(last_close + 3.0 * atr, 2)
    rr          = round((target - last_close) / max(last_close - stop_loss, 0.01), 2)

    return {
        "decision":    decision,
        "entry":       last_close,
        "stop_loss":   stop_loss,
        "target":      target,
        "risk_reward": rr
    }
