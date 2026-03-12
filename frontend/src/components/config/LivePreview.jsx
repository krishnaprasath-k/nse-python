import React from "react";

const PREVIEW_CONFIG = {
  global_macro: (cfg) => {
    const gm = cfg.global_macro || {};
    const scenarios = [
      { label: "S&P +0.5%, TLT ↑, UUP ↓ (all bullish)", sp: 0.5, tlt_up: true, uup_down: true },
      { label: "S&P -1%, TLT ↓, UUP ↑ (all bearish)", sp: -1, tlt_up: false, uup_down: false },
      { label: "S&P +0.3%, TLT ↓, UUP ↓ (mixed)", sp: 0.3, tlt_up: false, uup_down: true },
    ];
    return scenarios.map((s) => {
      const sp_sig = (s.sp > 0 ? 1 : -1) * (gm.sp500_weight || 1);
      const yld_sig = (s.tlt_up ? 1 : -1) * (gm.yield_weight || 1);
      const dxy_sig = (s.uup_down ? 1 : -1) * (gm.dxy_weight || 1);
      const score = sp_sig + yld_sig + dxy_sig;
      const signal = score >= (gm.risk_on_threshold || 2) ? "RISK ON ✅" : score <= (gm.risk_off_threshold || -2) ? "RISK OFF 🔴" : "NEUTRAL ⚪";
      return { ...s, score, signal, breakdown: `(${sp_sig}) + (${yld_sig}) + (${dxy_sig}) = ${score}` };
    });
  },
  india_market: (cfg) => {
    const im = cfg.india_market || {};
    const scenarios = [
      { label: "Nifty +0.5%, Breadth 1.2, VIX 18", nifty: 0.5, fii: true, vix: 18 },
      { label: "Nifty -1.2%, Breadth 0.8, VIX 23", nifty: -1.2, fii: false, vix: 23 },
    ];
    return scenarios.map((s) => {
      const n = (s.nifty > 0 ? 1 : -1) * (im.nifty_weight || 1);
      const b = (s.fii ? 1 : -1) * (im.breadth_weight || 1);
      const v = (s.vix < (im.vix_low_threshold || 20) ? 1 : -1) * (im.vix_weight || 1);
      const score = n + b + v;
      const signal = score >= (im.strong_threshold || 2) ? "STRONG ✅" : score <= (im.weak_threshold || -2) ? "WEAK 🔴" : "RANGE ⚪";
      return { ...s, score, signal, breakdown: `(${n}) + (${b}) + (${v}) = ${score}` };
    });
  },
  trade_sizing: (cfg) => {
    const ts = cfg.trade_sizing || {};
    const entry = 500;
    const atr = 12;
    const sl = entry - (ts.atr_sl_multiplier || 1.5) * atr;
    const tgt = entry + (ts.atr_target_multiplier || 3.0) * atr;
    const rr = ((tgt - entry) / (entry - sl)).toFixed(2);
    return [
      {
        label: `Entry ₹${entry}, ATR ${atr}`,
        score: null,
        signal: `SL: ₹${sl.toFixed(2)} | Target: ₹${tgt.toFixed(2)} | R:R = ${rr}`,
        breakdown: `SL = ${entry} - (${ts.atr_sl_multiplier || 1.5} × ${atr}), Tgt = ${entry} + (${ts.atr_target_multiplier || 3.0} × ${atr})`,
      },
    ];
  },
  ema_timing: (cfg) => {
    const em = cfg.ema_timing || {};
    const testCases = [0.5, 2.0, 4.5, 7.0];
    return testCases.map((pct) => {
      let signal;
      if (pct <= (em.best_timing_pct || 1.0)) signal = "BEST TIMING ✅";
      else if (pct <= (em.near_ema_pct || 3.0)) signal = "NEAR EMA 🟡";
      else if (pct <= (em.extended_pct || 5.0)) signal = "SLIGHTLY EXTENDED ⚠️";
      else signal = "EXTENDED 🔴";
      return { label: `Price ${pct}% from EMA(${em.period || 21})`, score: null, signal, breakdown: "" };
    });
  },
};

export function LivePreview({ section, config }) {
  const generator = PREVIEW_CONFIG[section];
  if (!generator || !config) return null;

  const scenarios = generator(config);

  return (
    <div className="live-preview">
      <h4 className="live-preview-title">📊 Live Preview</h4>
      <div className="live-preview-scenarios">
        {scenarios.map((s, i) => (
          <div key={i} className="live-preview-row">
            <div className="live-preview-label">{s.label}</div>
            {s.breakdown && (
              <div className="live-preview-breakdown">Score = {s.breakdown}</div>
            )}
            <div className="live-preview-signal">→ {s.signal}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
