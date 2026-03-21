"""
pattern_service.py
==================
Runs Bear-Flag, Distribution-Channel, and EMA-Cross pattern detection
on the top-scored stocks from the screener cache.
Fetches 6-month OHLCV via yfinance for pattern accuracy.
"""

import gc
import time
import threading
import numpy as np
import yfinance as yf
import pandas as pd
from datetime import datetime
from cache.cache import get_cache, set_cache

PATTERN_CACHE_KEY = "pattern_signals"
PATTERN_CACHE_TTL = 1800   # 30 min
PATTERN_SCAN_SYMBOLS = 80  # top N stocks from screener to scan

_lock  = threading.Lock()
_state = {"status": "idle", "progress": 0, "error": None}


def get_pattern_state() -> dict:
    with _lock:
        return dict(_state)


def _upd(**kw):
    with _lock:
        _state.update(kw)


# ── EMA helper ────────────────────────────────────────────────────────────────

def _ema(prices, period):
    if len(prices) < period:
        return []
    k = 2.0 / (period + 1)
    vals = [prices[0]]
    for p in prices[1:]:
        vals.append(p * k + vals[-1] * (1 - k))
    return vals


# ── Pattern detectors ─────────────────────────────────────────────────────────

def _detect_bear_flag(sym, c) -> dict | None:
    closes = c["close"]; opens = c["open"]
    highs = c["high"];   lows  = c["low"];  vols = c["volume"]
    if len(closes) < 60:
        return None

    e51  = _ema(closes, 51)
    e200 = _ema(closes, 200) if len(closes) >= 200 else _ema(closes, 51)

    curr = closes[-1]; avg_v = float(np.mean(vols[-20:])) or 1
    vr   = vols[-1] / avg_v

    prior_low  = min(lows[-25:-10])
    prior_high = max(highs[-15:-5])
    prior_move = (prior_high - prior_low) / prior_low * 100

    flag_high = max(highs[-8:-1]); flag_low = min(lows[-8:-1])
    flag_ret  = (flag_high - curr) / (prior_high - prior_low) * 100 if (prior_high - prior_low) > 0 else 0

    score = sum([
        prior_move >= 8,
        curr < e51[-1],
        curr < e200[-1],
        curr < flag_low,
        vr >= 1.5,
        closes[-1] < opens[-1] and abs(closes[-1] - opens[-1]) / opens[-1] * 100 >= 1.0,
        flag_ret <= 50,
    ])
    if score < 4:
        return None

    conf = "High" if score >= 6 else "Medium" if score >= 5 else "Low"
    sl   = round(flag_high * 1.005, 2)
    tgt  = round(curr - (sl - curr) * 2, 2)
    drop = round((prior_high - curr) / prior_high * 100, 2)

    return {
        "symbol": sym, "pattern": "BEAR_FLAG", "stage": "Stage1_Fresh",
        "confidence": conf, "current_price": round(curr, 2),
        "ema51": round(e51[-1], 2), "ema200": round(e200[-1], 2),
        "volume_ratio": round(vr, 2), "drop_from_top": drop,
        "entry_zone": f"Below ₹{flag_low:.0f}",
        "stop_loss": f"₹{sl:.0f}", "target": f"₹{tgt:.0f}",
        "timestamp": datetime.now().isoformat(),
    }


def _detect_dist_channel(sym, c) -> dict | None:
    closes = c["close"]; opens = c["open"]
    highs = c["high"];   lows  = c["low"];  vols = c["volume"]
    if len(closes) < 80:
        return None

    e51  = _ema(closes, 51)
    e200 = _ema(closes, 200) if len(closes) >= 200 else _ema(closes, 100)
    curr = closes[-1]; avg_v = float(np.mean(vols[-20:])) or 1

    e51_slope  = (e51[-1] - e51[-10]) / e51[-10] * 100
    e200_slope = (e200[-1] - e200[-10]) / e200[-10] * 100

    spike_found = any(
        vols[i] > avg_v * 2.0 and abs(closes[i] - opens[i]) / opens[i] * 100 >= 2.0 and closes[i] < opens[i]
        for i in range(-40, -15)
    )

    swing_highs = [max(highs[i-2:i+2]) for i in range(-30, -5, 8)]
    lh = all(swing_highs[i] > swing_highs[i+1] for i in range(len(swing_highs) - 1)) if len(swing_highs) >= 2 else False

    top   = max(highs[-60:])
    drop  = (top - curr) / top * 100

    score = sum([
        spike_found,
        curr < e51[-1] and curr < e200[-1],
        e51_slope < -0.5 and e200_slope < -0.3,
        lh,
        drop >= 15,
        drop >= 20,
    ])
    if score < 3:
        return None

    conf  = "High" if score >= 5 else "Medium" if score >= 4 else "Low"
    stage = "Stage1_Fresh" if spike_found else "Stage3_Channel"
    sl    = round(e51[-1] * 1.01, 2)
    tgt   = round(curr * (1 - drop / 200), 2)

    return {
        "symbol": sym, "pattern": "DIST_CHANNEL", "stage": stage,
        "confidence": conf, "current_price": round(curr, 2),
        "ema51": round(e51[-1], 2), "ema200": round(e200[-1], 2),
        "volume_ratio": round(vols[-1] / avg_v, 2), "drop_from_top": round(drop, 2),
        "entry_zone": f"Below ₹{curr:.0f} (in channel)",
        "stop_loss": f"₹{sl:.0f}", "target": f"₹{tgt:.0f}",
        "timestamp": datetime.now().isoformat(),
    }


def _detect_ema_cross(sym, c) -> dict | None:
    closes = c["close"]; opens = c["open"]
    highs = c["high"];   lows  = c["low"];  vols = c["volume"]
    if len(closes) < 60:
        return None

    e51  = _ema(closes, 51)
    e200 = _ema(closes, 200) if len(closes) >= 200 else _ema(closes, 100)
    curr = closes[-1]; prev = closes[-2]; avg_v = float(np.mean(vols[-20:])) or 1
    vr   = vols[-1] / avg_v

    just_crossed = prev >= e51[-2] and curr < e51[-1]

    was_above = 0
    for i in range(-15, -1):
        if closes[i] >= e51[i]:
            was_above += 1
        else:
            break

    e51_slope = (e51[-1] - e51[-5]) / e51[-5] * 100
    top  = max(highs[-30:])
    drop = (top - curr) / top * 100

    score = sum([
        just_crossed,
        was_above >= 8,
        -2.0 < e51_slope < 0.2,
        closes[-1] < opens[-1] and abs(closes[-1] - opens[-1]) / opens[-1] * 100 >= 1.5,
        vr >= 1.5,
        e200[-1] > curr,
        drop < 15,
    ])

    if not just_crossed or score < 4:
        return None

    conf = "High" if score >= 6 else "Medium" if score >= 5 else "Low"
    sl   = round(max(highs[-3:]) * 1.003, 2)
    tgt  = round(curr - (sl - curr) * 2.5, 2)

    return {
        "symbol": sym, "pattern": "EMA_CROSS", "stage": "Stage1_Fresh",
        "confidence": conf, "current_price": round(curr, 2),
        "ema51": round(e51[-1], 2), "ema200": round(e200[-1], 2),
        "volume_ratio": round(vr, 2), "drop_from_top": round(drop, 2),
        "entry_zone": f"Below ₹{curr:.0f} (just crossed)",
        "stop_loss": f"₹{sl:.0f}", "target": f"₹{tgt:.0f}",
        "timestamp": datetime.now().isoformat(),
    }


# ── Main scanner ──────────────────────────────────────────────────────────────

def _safe(v):
    try:
        f = float(v)
        return f if not (np.isnan(f) or np.isinf(f)) else 0.0
    except Exception:
        return 0.0


def run_pattern_scan():
    _upd(status="building", progress=0, error=None)
    try:
        from cache.cache import get_cache as gc2
        from services.screener_builder import SCREENER_CACHE_KEY, SCREENER_CACHE_TTL

        screener_data = gc2(SCREENER_CACHE_KEY, SCREENER_CACHE_TTL)
        if screener_data:
            tickers = [s["ticker"] for s in screener_data[:PATTERN_SCAN_SYMBOLS]]
        else:
            from services.nse_symbols import get_all_nse_symbols
            syms = get_all_nse_symbols()
            tickers = [s["ticker"] for s in syms[:PATTERN_SCAN_SYMBOLS]]

        signals = []
        batch_size = 25
        batches = [tickers[i:i+batch_size] for i in range(0, len(tickers), batch_size)]

        for idx, batch in enumerate(batches):
            raw = None
            try:
                raw = yf.download(batch, period="6mo", progress=False,
                                  auto_adjust=True, threads=True)
                for t in batch:
                    try:
                        if isinstance(raw.columns, pd.MultiIndex):
                            if t not in raw["Close"].columns:
                                continue
                            cl = raw["Close"][t].dropna()
                            op = raw["Open"][t].reindex(cl.index).ffill()
                            hi = raw["High"][t].reindex(cl.index).ffill()
                            lo = raw["Low"][t].reindex(cl.index).ffill()
                            vo = raw["Volume"][t].reindex(cl.index).fillna(0)
                        else:
                            cl = raw["Close"].dropna()
                            op = raw["Open"].reindex(cl.index).ffill()
                            hi = raw["High"].reindex(cl.index).ffill()
                            lo = raw["Low"].reindex(cl.index).ffill()
                            vo = raw["Volume"].reindex(cl.index).fillna(0)

                        if len(cl) < 60:
                            continue

                        candles = {
                            "close":  [_safe(v) for v in cl.tolist()],
                            "open":   [_safe(v) for v in op.tolist()],
                            "high":   [_safe(v) for v in hi.tolist()],
                            "low":    [_safe(v) for v in lo.tolist()],
                            "volume": [_safe(v) for v in vo.tolist()],
                        }

                        for detector in [_detect_ema_cross, _detect_bear_flag, _detect_dist_channel]:
                            try:
                                sig = detector(t, candles)
                                if sig:
                                    signals.append(sig)
                            except Exception:
                                pass
                    except Exception:
                        pass
            except Exception as e:
                print(f"[pattern_service] Batch {idx} error: {e}")
            finally:
                del raw
                gc.collect()

            progress = int(min((idx + 1) * batch_size, len(tickers)) / len(tickers) * 100)
            _upd(progress=progress)
            time.sleep(1.0)

        signals.sort(key=lambda x: (x["confidence"] == "High", x["confidence"] == "Medium"), reverse=True)
        set_cache(PATTERN_CACHE_KEY, signals)
        _upd(status="ready", progress=100)
        print(f"[pattern_service] Done — {len(signals)} signals found")

    except Exception as e:
        print(f"[pattern_service] Fatal: {e}")
        _upd(status="error", error=str(e))


def trigger_pattern_scan() -> bool:
    if get_cache(PATTERN_CACHE_KEY, PATTERN_CACHE_TTL) is not None:
        return False
    state = get_pattern_state()
    if state["status"] == "building":
        return False
    threading.Thread(target=run_pattern_scan, daemon=True).start()
    return True
