"""
probability_ranking.py
======================
Implements the full 100-point Probability Ranking System derived from Stock_model.md
(Institutional-Style Short-Term Trading Framework — Model-1 → Model-4)

Scoring Dimensions (total = 100):
  1. Market Regime     (0-20)  — Model-0 gate
  2. Demand Catalyst   (0-25)  — Model-1: sector + demand type
  3. Technical Structure (0-20) — Model-2: pullback pattern
  4. Momentum Quality  (0-15)  — Model-2: RSI + bias
  5. Volume Confirmation (0-10) — Model-2: institutional accumulation
  6. Execution Readiness (0-10) — Model-3/4: EMA proximity + R:R

Signal thresholds:
  STRONG BUY  ≥ 80
  BUY         ≥ 65
  WATCH       ≥ 50
  WEAK WATCH  ≥ 35
  AVOID       < 35
  SHORT       ≥ 65 (bearish regime only)
"""

from __future__ import annotations
from typing import Optional

# ─── Priority Sectors (Model-1) ──────────────────────────────────────────────

PRIORITY_SECTORS = {
    # Tier-1: highest demand urgency / policy backing  (score = 15)
    "semiconductor", "electronics", "ems", "defence", "power", "energy",
    "fertilizer", "agro", "agriculture", "oil & gas", "gas", "petroleum",
    "metals", "copper", "steel", "aluminium", "infrastructure", "water",
    "irrigation", "renewable energy",
    # Tier-2: secondary priority (score = 8)
    "banking", "finance", "chemicals", "real estate", "construction",
    "telecom", "logistics", "shipping",
}

DEFENSIVE_SECTORS = {"fmcg", "pharma", "utilities", "healthcare", "consumer staples"}

SPECULATIVE_SECTORS = {"small cap", "microcap", "penny", "speculative"}


def _sector_score(sector: str) -> int:
    """Dimension 2a — Sector classification (0-15)."""
    s = sector.lower()
    if any(p in s for p in list(PRIORITY_SECTORS)[:20]):
        return 15
    if any(p in s for p in list(PRIORITY_SECTORS)[20:]):
        return 8
    if any(d in s for d in DEFENSIVE_SECTORS):
        return 3
    if any(sp in s for sp in SPECULATIVE_SECTORS):
        return 0
    return 5  # unknown but not speculative


def _demand_type_score(demand_type: Optional[str]) -> int:
    """
    Dimension 2b — Demand type (0-10).
    demand_type values: 'urgent', 'policy', 'commodity', 'seasonal', None
    """
    mapping = {
        "urgent":    10,   # Power, Fertilizer crop-season, Energy supply
        "policy":    8,    # Budget, PLI, Defence procurement, Infra
        "commodity": 6,    # Global supply imbalances
        "seasonal":  4,    # Predictable annual cycles
    }
    if demand_type is None:
        return 0
    return mapping.get(demand_type.lower(), 0)


def _infer_demand_type(sector: str) -> Optional[str]:
    """
    Auto-infer demand type from sector name when not explicitly provided.
    This is a heuristic fallback.
    """
    s = sector.lower()
    if any(k in s for k in ["power", "energy", "oil", "gas", "fertilizer"]):
        return "urgent"
    if any(k in s for k in ["defence", "semiconductor", "ems", "infra", "water", "irrigation", "renewable"]):
        return "policy"
    if any(k in s for k in ["copper", "steel", "aluminium", "metals"]):
        return "commodity"
    if any(k in s for k in ["agro", "agriculture", "seasonal"]):
        return "seasonal"
    return None


# ─── Dimension 1: Market Regime Score (0-20) ─────────────────────────────────

def _regime_score(global_risk: str, india_bias: str) -> int:
    """Model-0 market regime gate."""
    gr = global_risk.upper()
    ib = india_bias.upper()

    if gr == "RISK ON"  and ib == "STRONG": return 20
    if gr == "RISK ON"  and ib == "RANGE":  return 16
    if gr == "NEUTRAL"  and ib == "STRONG": return 14
    if gr == "NEUTRAL"  and ib == "RANGE":  return 10
    if gr == "NEUTRAL"  and ib == "WEAK":   return 4
    # RISK OFF or WEAK India for longs = blocked
    return 0


def _regime_score_bearish(global_risk: str, india_bias: str) -> int:
    """Model-4 bearish regime score — inverted."""
    gr = global_risk.upper()
    ib = india_bias.upper()
    if gr == "RISK OFF" and ib == "WEAK":   return 20
    if gr == "RISK OFF" and ib == "RANGE":  return 14
    if gr == "NEUTRAL"  and ib == "WEAK":   return 10
    return 0


# ─── Dimension 3: Technical Structure (0-20) ─────────────────────────────────

def _technical_structure_score(ema_signal: str, change_pct: float, zone: str) -> int:
    """
    Model-2 pullback + price pattern scoring.
    Uses outputs already computed in screener_builder._score_stock()
    """
    # Gap-up disqualifier (Model-3: do not buy gap-ups > 2%)
    if change_pct > 0.02:
        return 0  # Extended gap-up — wait for VWAP fill

    # Zone assessment
    if zone == "Breakout" and ema_signal in ("BEST TIMING", "NEAR EMA"):
        return 20  # Price reacting from breakout level with structure
    if zone == "Demand" and ema_signal == "BEST TIMING":
        return 16
    if zone == "Demand" and ema_signal in ("NEAR EMA", "BELOW EMA"):
        return 14
    if ema_signal == "BELOW EMA":
        return 10  # Demand zone, potential recovery
    if ema_signal in ("SLIGHTLY EXTENDED",):
        return 4
    if ema_signal == "EXTENDED":
        return 0   # Never buy extended stocks
    return 6  # neutral / insufficient data


# ─── Dimension 4: Momentum Quality (0-15) ────────────────────────────────────

def _momentum_score(bias: str, rsi: Optional[float] = None) -> int:
    """
    Model-2 RSI + momentum bias scoring.
    Primary: bias from indicators.py ('STRONG BULLISH', 'NEUTRAL', 'STRONG BEARISH')
    Secondary: RSI range 50-60 is ideal per model spec
    """
    base = {"STRONG BULLISH": 10, "NEUTRAL": 4, "STRONG BEARISH": 0}.get(bias.upper(), 4)

    if rsi is None:
        return base

    # RSI refinement
    if 50 <= rsi <= 60:
        rsi_bonus = 5   # ideal range per model spec
    elif 45 <= rsi <= 65:
        rsi_bonus = 3
    elif 40 <= rsi <= 70:
        rsi_bonus = 1
    elif rsi > 70:
        rsi_bonus = -3  # overbought penalty
    else:
        rsi_bonus = -5  # oversold / bearish

    return max(0, min(15, base + rsi_bonus))


def _momentum_score_bearish(bias: str, rsi: Optional[float] = None) -> int:
    """Model-4 momentum — inverted."""
    base = {"STRONG BEARISH": 10, "NEUTRAL": 4, "STRONG BULLISH": 0}.get(bias.upper(), 4)
    if rsi is None:
        return base
    if rsi < 40:
        rsi_bonus = 5   # RSI < 45 is Model-4 confirmation
    elif rsi < 45:
        rsi_bonus = 3
    elif rsi < 50:
        rsi_bonus = 1
    else:
        rsi_bonus = -3
    return max(0, min(15, base + rsi_bonus))


# ─── Dimension 5: Volume Confirmation (0-10) ─────────────────────────────────

def _volume_score(vol_spike: bool, change_pct: float,
                  vol_ratio: Optional[float] = None) -> int:
    """
    Model-2: institutional accumulation pattern.
    - Declining volume on pullback + rising volume on rebound = best
    - vol_ratio = today_volume / avg_volume (from vol_ma20)
    """
    if vol_ratio is not None:
        if change_pct > 0 and vol_ratio > 1.8:
            return 10   # Strong rebound volume — institutional buying
        if change_pct > 0 and vol_ratio > 1.3:
            return 7
        if change_pct < 0 and vol_ratio < 0.8:
            return 6    # Declining volume on pullback — healthy
        if vol_ratio < 0.6:
            return 3    # Low volume — insufficient conviction
        if change_pct < 0 and vol_ratio > 1.3:
            return 0    # Increasing volume on down days — distribution

    # Fallback: vol_spike flag from indicators.py
    if vol_spike:
        return 4 if change_pct > 0 else 0
    return 2


# ─── Dimension 6: Execution Readiness (0-10) ─────────────────────────────────

def _execution_score(ema_signal: str, risk_reward: Optional[float] = None) -> int:
    """Model-3: EMA proximity + risk-reward."""
    ema_map = {
        "BEST TIMING":        10,
        "NEAR EMA":           7,
        "BELOW EMA":          4,
        "SLIGHTLY EXTENDED":  2,
        "EXTENDED":           0,
        "INSUFFICIENT_DATA":  0,
    }
    base = ema_map.get(ema_signal, 0)

    if risk_reward is None:
        return base

    # Model-3 rule: 2% SL → 4-5% target = min R:R 2:1
    if risk_reward >= 3.0:
        rr_adj = 2
    elif risk_reward >= 2.0:
        rr_adj = 0
    else:
        rr_adj = -3   # Poor risk-reward, do not enter

    return max(0, min(10, base + rr_adj))


# ─── Model-4 Bearish Stock Checks ────────────────────────────────────────────

def _bearish_structure_score(ema_signal: str, change_pct: float) -> int:
    """Structural weakness for Model-4 short candidates."""
    if ema_signal in ("BELOW EMA",) and change_pct < 0:
        return 20   # Below EMAs + down day = strong short structure
    if ema_signal in ("NEAR EMA",) and change_pct < -0.01:
        return 12
    if change_pct < -0.02:
        return 8
    return 0


# ─── Main Ranking Functions ───────────────────────────────────────────────────

def rank_stock_long(
    ticker: str,
    sector: str,
    ema_signal: str,
    zone: str,
    change_pct: float,
    bias: str,
    vol_spike: bool,
    global_risk: str = "NEUTRAL",
    india_bias: str  = "RANGE",
    demand_type: Optional[str] = None,
    rsi: Optional[float] = None,
    vol_ratio: Optional[float] = None,
    risk_reward: Optional[float] = None,
) -> dict:
    """
    Full 100-point probability score for LONG candidates (Model-1 → Model-3).
    Returns a ranked dict with breakdown and signal.
    """
    # Auto-infer demand type from sector if not provided
    if demand_type is None:
        demand_type = _infer_demand_type(sector)

    d1_regime    = _regime_score(global_risk, india_bias)
    d2a_sector   = _sector_score(sector)
    d2b_demand   = _demand_type_score(demand_type)
    d3_tech      = _technical_structure_score(ema_signal, change_pct, zone)
    d4_momentum  = _momentum_score(bias, rsi)
    d5_volume    = _volume_score(vol_spike, change_pct, vol_ratio)
    d6_execution = _execution_score(ema_signal, risk_reward)

    total = d1_regime + d2a_sector + d2b_demand + d3_tech + d4_momentum + d5_volume + d6_execution

    # Hard blocks (Model-3 rules)
    if change_pct > 0.02:
        signal = "GAP-UP WAIT"   # Never buy gap-up > 2%
    elif total >= 80:
        signal = "STRONG BUY"
    elif total >= 65:
        signal = "BUY"
    elif total >= 50:
        signal = "WATCH"
    elif total >= 35:
        signal = "WEAK WATCH"
    else:
        signal = "AVOID"

    # Market regime hard block for longs
    if d1_regime == 0 and signal in ("STRONG BUY", "BUY"):
        signal = "BLOCKED (MARKET WEAK)"

    return {
        "ticker":       ticker,
        "direction":    "LONG",
        "total_score":  total,
        "signal":       signal,
        "demand_type":  demand_type or "none",
        "breakdown": {
            "market_regime":  d1_regime,   # max 20
            "sector_demand":  d2a_sector,  # max 15
            "demand_type":    d2b_demand,  # max 10
            "tech_structure": d3_tech,     # max 20
            "momentum":       d4_momentum, # max 15
            "volume":         d5_volume,   # max 10
            "execution":      d6_execution # max 10
        }
    }


def rank_stock_short(
    ticker: str,
    sector: str,
    ema_signal: str,
    change_pct: float,
    bias: str,
    vol_spike: bool,
    global_risk: str = "RISK OFF",
    india_bias: str  = "WEAK",
    rsi: Optional[float] = None,
    vol_ratio: Optional[float] = None,
) -> dict:
    """
    Model-4 bearish probability score for SHORT candidates.
    Only meaningful when market regime is weak/bearish.
    """
    d1_regime   = _regime_score_bearish(global_risk, india_bias)
    d2_sector   = _sector_score(sector)   # lower sector score = better short (high-beta)
    d2_inverted = max(0, 15 - d2_sector)  # invert: weak sectors = higher short score
    d3_struct   = _bearish_structure_score(ema_signal, change_pct)
    d4_momentum = _momentum_score_bearish(bias, rsi)
    d5_volume   = _volume_score(vol_spike, change_pct, vol_ratio)
    d5_inverted = max(0, 10 - d5_volume) if change_pct < 0 else 0  # distribution

    total = d1_regime + d2_inverted + d3_struct + d4_momentum + d5_inverted

    if total >= 75:
        signal = "STRONG SHORT"
    elif total >= 55:
        signal = "SHORT"
    else:
        signal = "AVOID SHORT"

    return {
        "ticker":      ticker,
        "direction":   "SHORT",
        "total_score": total,
        "signal":      signal,
        "breakdown": {
            "bearish_regime":    d1_regime,
            "weak_sector":       d2_inverted,
            "bearish_structure": d3_struct,
            "bearish_momentum":  d4_momentum,
            "distribution_vol":  d5_inverted,
        }
    }


# ─── Ranker — sort + filter watchlist ────────────────────────────────────────

def rank_watchlist(
    screener_results: list[dict],
    global_risk: str = "NEUTRAL",
    india_bias: str  = "RANGE",
    max_positions: int = 4,
) -> dict:
    """
    Take the raw screener results (from screener_builder.py) and apply
    the full Model-1→4 probability ranking. Returns ranked long + short lists.

    screener_results: list of dicts from screener_builder._score_stock()
    Each dict must have: ticker, sector, ema_signal, zone, change_pct,
                         vol_spike, probability_scores{}, final_score
    """
    is_bearish = (global_risk == "RISK OFF" and india_bias == "WEAK")

    long_ranked  = []
    short_ranked = []

    for s in screener_results:
        ticker     = s.get("ticker", "")
        sector     = s.get("sector", "Unknown")
        ema_signal = s.get("ema_signal", "INSUFFICIENT_DATA")
        zone       = s.get("zone", "None")
        change_pct = s.get("change_pct", 0.0)
        vol_spike  = s.get("vol_spike", False)
        bias       = s.get("bias", "NEUTRAL")  # from indicators.py if enriched
        rr         = s.get("risk_reward")

        # Vol ratio: if vol_ma20 present, compute; else None
        vol_ratio = None
        if s.get("volume") and s.get("vol_ma20"):
            try:
                vol_ratio = float(s["volume"]) / float(s["vol_ma20"])
            except Exception:
                pass

        long_score = rank_stock_long(
            ticker=ticker, sector=sector, ema_signal=ema_signal,
            zone=zone, change_pct=change_pct, bias=bias,
            vol_spike=vol_spike, global_risk=global_risk,
            india_bias=india_bias, risk_reward=rr,
        )
        long_ranked.append(long_score)

        if is_bearish:
            short_score = rank_stock_short(
                ticker=ticker, sector=sector, ema_signal=ema_signal,
                change_pct=change_pct, bias=bias, vol_spike=vol_spike,
                global_risk=global_risk, india_bias=india_bias,
            )
            short_ranked.append(short_score)

    # Sort descending by total_score
    long_ranked.sort(key=lambda x: x["total_score"], reverse=True)
    short_ranked.sort(key=lambda x: x["total_score"], reverse=True)

    # Select top candidates per Model-3 (max 4 positions)
    top_longs  = [r for r in long_ranked  if r["signal"] in ("STRONG BUY", "BUY")][:max_positions]
    top_shorts = [r for r in short_ranked if r["signal"] in ("STRONG SHORT", "SHORT")][:max_positions]

    return {
        "market_regime": {
            "global_risk": global_risk,
            "india_bias":  india_bias,
            "is_bearish":  is_bearish,
        },
        "top_long_candidates":  top_longs,
        "top_short_candidates": top_shorts,
        "full_long_ranked":     long_ranked,
        "full_short_ranked":    short_ranked,
        "metadata": {
            "total_stocks_evaluated": len(screener_results),
            "model": "Stock_model.md — Institutional Short-Term Framework v1.0",
        }
    }
