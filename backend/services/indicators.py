import pandas as pd
import numpy as np

def _load_model_config():
    """Load the live model config. Import here to avoid circular deps."""
    from routers.config import load_config
    return load_config()


def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Replicates all MONTHLY_DATA sheet calculations from the Excel model.
    All periods & multipliers are read from model_config.json.
    Input df must have columns: Open, High, Low, Close, Volume
    """
    cfg = _load_model_config()
    tech = cfg.get("technicals", {})
    mom = cfg.get("momentum", {})

    dma_short = tech.get("dma_short", 20)
    dma_long = tech.get("dma_long", 50)
    atr_period = tech.get("atr_period", 14)
    return_short = tech.get("return_short_days", 5)
    return_long = tech.get("return_long_days", 20)
    vol_avg_period = tech.get("vol_avg_period", 20)
    vol_spike_mult = tech.get("vol_spike_multiplier", 1.5)

    mom_bullish = mom.get("bullish_threshold", 2)
    mom_bearish = mom.get("bearish_threshold", -2)
    weight_1d = mom.get("weight_1d", 1)
    weight_20d = mom.get("weight_20d", 1)

    df['MA20']  = df['Close'].rolling(dma_short).mean()
    df['MA50']  = df['Close'].rolling(dma_long).mean()
    df['MA200'] = df['Close'].rolling(200).mean()

    prev_close = df['Close'].shift(1)
    df['TR'] = pd.concat([
        df['High'] - df['Low'],
        (df['High'] - prev_close).abs(),
        (df['Low']  - prev_close).abs()
    ], axis=1).max(axis=1)
    df['ATR14'] = df['TR'].rolling(atr_period).mean()

    df['return_1d']  = df['Close'].pct_change(1)
    df['return_5d']  = df['Close'].pct_change(return_short)
    df['return_20d'] = df['Close'].pct_change(return_long)

    df['vol_ma20']   = df['Volume'].rolling(vol_avg_period).mean()
    df['vol_spike']  = df['Volume'] > (vol_spike_mult * df['vol_ma20'])

    # Magnitude-weighted momentum: use actual returns, not just sign
    def _momentum_bucket(ret):
        """Convert return to magnitude-based score."""
        if abs(ret) < 0.005:  # < 0.5%
            return 0
        elif ret > 0.03:     # > 3%
            return 2
        elif ret > 0:
            return 1
        elif ret < -0.03:    # < -3%
            return -2
        else:
            return -1

    df['momentum_score'] = (
        df['return_1d'].apply(_momentum_bucket) * weight_1d +
        df['return_20d'].apply(_momentum_bucket) * weight_20d
    )
    df['bias'] = df['momentum_score'].apply(
        lambda x: 'STRONG BULLISH' if x >= mom_bullish
                  else ('STRONG BEARISH' if x <= mom_bearish else 'NEUTRAL')
    )
    return df


def compute_global_risk_signal(sp500_ret, tlt_today, tlt_prev, uup_today, uup_prev):
    cfg = _load_model_config()
    gm = cfg.get("global_macro", {})

    sp_weight = gm.get("sp500_weight", 1)
    yield_weight = gm.get("yield_weight", 1)
    dxy_weight = gm.get("dxy_weight", 1)
    risk_on_th = gm.get("risk_on_threshold", 2)
    risk_off_th = gm.get("risk_off_threshold", -2)

    sp_signal     = (1 if sp500_ret > 0 else -1) * sp_weight
    yield_signal  = (1 if tlt_today > tlt_prev else -1) * yield_weight
    dollar_signal = (1 if uup_today < uup_prev else -1) * dxy_weight
    score = sp_signal + yield_signal + dollar_signal
    label = "RISK ON" if score >= risk_on_th else ("RISK OFF" if score <= risk_off_th else "NEUTRAL")
    return label, score


def compute_india_signal(nifty_ret, fii_net_positive: bool, vix: float):
    cfg = _load_model_config()
    im = cfg.get("india_market", {})

    nifty_w = im.get("nifty_weight", 1)
    breadth_w = im.get("breadth_weight", 1)
    vix_w = im.get("vix_weight", 1)
    vix_th = im.get("vix_low_threshold", 20)
    strong_th = im.get("strong_threshold", 2)
    weak_th = im.get("weak_threshold", -2)

    nifty_signal = (1 if nifty_ret > 0 else -1) * nifty_w
    fii_signal   = (1 if fii_net_positive else -1) * breadth_w
    vix_signal   = (1 if vix < vix_th else -1) * vix_w
    score = nifty_signal + fii_signal + vix_signal
    label = "STRONG" if score >= strong_th else ("WEAK" if score <= weak_th else "RANGE")
    return label, score


def score_stock(zone: str, result_quality: str, sales_growth: str,
                vol_accumulation: str, is_extended: bool) -> int:
    cfg = _load_model_config()
    us = cfg.get("universe_score", {})

    score_max = us.get("score_max", 5)
    zone_vals = us.get("zone_values", ["Demand", "Breakout"])
    rq_val = us.get("results_quality_value", "Strong")
    sg_val = us.get("sales_growth_value", "Strong")
    va_val = us.get("volume_accum_value", "High")

    return min(score_max, sum([
        zone in zone_vals,
        result_quality == rq_val,
        sales_growth == sg_val,
        vol_accumulation == va_val,
        not is_extended
    ]))


def compute_final_trade_signal(global_risk, india_bias, stock_bias,
                                last_close: float, atr: float) -> dict:
    cfg = _load_model_config()
    td = cfg.get("trade_decision", {})
    ts = cfg.get("trade_sizing", {})

    sl_mult = ts.get("atr_sl_multiplier", 1.5)
    tgt_mult = ts.get("atr_target_multiplier", 3.0)

    buy_india = td.get("buy_requires_india_not_weak", True)
    buy_global = td.get("buy_requires_global_not_off", True)
    sell_india = td.get("sell_requires_india_weak", True)

    # Build buy condition
    buy_ok = stock_bias == "STRONG BULLISH"
    if buy_india:
        buy_ok = buy_ok and india_bias in ["STRONG", "RANGE"]
    if buy_global:
        buy_ok = buy_ok and global_risk != "RISK OFF"

    # Build sell condition
    sell_ok = stock_bias == "STRONG BEARISH"
    if sell_india:
        sell_ok = sell_ok and india_bias == "WEAK"

    if buy_ok:
        decision = "BUY TODAY"
    elif sell_ok:
        decision = "SELL TODAY"
    else:
        decision = "WATCHLIST"

    stop_loss   = round(last_close - sl_mult * atr, 2)
    target      = round(last_close + tgt_mult * atr, 2)
    rr          = round((target - last_close) / max(last_close - stop_loss, 0.01), 2)

    return {
        "decision":    decision,
        "entry":       last_close,
        "stop_loss":   stop_loss,
        "target":      target,
        "risk_reward": rr
    }
