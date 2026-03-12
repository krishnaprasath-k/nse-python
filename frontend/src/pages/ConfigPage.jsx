import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useConfig } from "../hooks/useConfig";
import { ConfigSidebar, TABS } from "../components/config/ConfigSidebar";
import { FormulaBox } from "../components/config/FormulaBox";
import { ParamField } from "../components/config/ParamField";
import { LivePreview } from "../components/config/LivePreview";
import { ChangeHistory } from "../components/config/ChangeHistory";

/* ─── Excel formula references per section ────────────────────────── */
const FORMULAS = {
  global_macro: {
    sheet: "Global_Macro!J2-K2",
    formula: `J2 = IF(B2>0,1,-1) + F2 + IF(UUP_today < UUP_prev, 1, -1)
K2 = IF(J2>=2,"RISK ON", IF(J2<=-2,"RISK OFF","NEUTRAL"))

SP500 return > 0  →  +1 × sp500_weight
TLT today > prev  →  +1 × yield_weight  (falling yield = bullish)
UUP today < prev  →  +1 × dxy_weight    (weak dollar = bullish)
                      ↑                       ↑
               risk_on_threshold         risk_off_threshold`,
  },
  india_market: {
    sheet: "India_Market!H2-I2",
    formula: `H2 = IF(Nifty%>0,1,-1) + IF(Advance/Decline>1,1,-1) + IF(VIX<20,1,-1)
I2 = IF(H2>=2,"STRONG", IF(H2<=-2,"WEAK","RANGE"))
               ↑ strong_threshold        ↑ weak_threshold`,
  },
  universe_score: {
    sheet: "Universe_Stocks!L2-M2",
    formula: `L2 = MIN(score_max, (zone∈["Demand","Breakout"]) + (results="Strong")
             + (sales="Strong") + (volume="High") + (NOT extended))
M2 = IF(L2 >= shortlist_threshold, "YES", "NO")`,
  },
  momentum: {
    sheet: "INFY_10Y!E-F",
    formula: `E = SIGN(1D_return) × weight_1d + SIGN(20D_return) × weight_20d
F = IF(E >= bullish_threshold, "STRONG BULLISH",
       IF(E <= bearish_threshold, "STRONG BEARISH", "NEUTRAL"))`,
  },
  technicals: {
    sheet: "MONTHLY_DATA!K-Q",
    formula: `K4 = AVERAGE(Close, dma_short)       → 20DMA
L4 = AVERAGE(Close, dma_long)        → 50DMA
M4 = ATR(atr_period)                 → ATR
N4 = Return(return_short_days)       → 5D return
O4 = Return(return_long_days)        → 20D return
P4 = AVERAGE(Volume, vol_avg_period) → 20D avg vol
Q4 = MAX(Vol[-vol_spike_lookback:]) > vol_spike_multiplier × P4 → SPIKE`,
  },
  trade_sizing: {
    sheet: "Action Plan",
    formula: `stop_loss = entry - (atr_sl_multiplier × ATR)
target    = entry + (atr_target_multiplier × ATR)
R:R ratio = (target - entry) / (entry - stop_loss)`,
  },
  trade_decision: {
    sheet: "Trade_Dashboard!D27",
    formula: `BUY TODAY  = bias="STRONG BULLISH" 
             AND india≠"WEAK"  (if buy_requires_india_not_weak)
             AND global≠"RISK OFF" (if buy_requires_global_not_off)
SELL TODAY = bias="STRONG BEARISH"
             AND india="WEAK" (if sell_requires_india_weak)
WATCHLIST  = everything else`,
  },
  ema_timing: {
    sheet: "Dashboard F1 / Universe_Stocks K1",
    formula: `EMA(period) proximity:
  within best_timing_pct%  → BEST TIMING (quality 5)
  within near_ema_pct%     → NEAR EMA (quality 3)
  within extended_pct%     → SLIGHTLY EXTENDED (quality 1)
  beyond extended_pct%     → EXTENDED (quality 0)`,
  },
  sector_rotation: {
    sheet: "Sector Rotation",
    formula: `momentum_score = sign(ret_1d) + sign(ret_1w) + sign(ret_1m) + sign(ret_3m)
signal = IF(score >= strong_inflow_score, "STRONG INFLOW",
            IF(score >= mild_inflow_score, "MILD INFLOW", ...))`,
  },
  seasonal: {
    sheet: "Seasonal Pattern",
    formula: `signal = IF(win_rate >= rising_win_rate, "RISING",
            IF(win_rate <= falling_win_rate, "FALLING", "MIXED"))
pre_result = IF(win_rate >= pre_result_buy_threshold AND avg > 1, "BUY BEFORE",
               IF(win_rate <= pre_result_avoid_threshold, "AVOID", "MIXED"))`,
  },
  action_plan: {
    sheet: "Action Plan → trade_sizing + trade_decision",
    formula: `── Position Sizing (ATR-based) ──────────────────────
stop_loss = entry_price  -  (atr_sl_multiplier  × ATR14)
target    = entry_price  +  (atr_target_multiplier × ATR14)
R:R ratio = (target - entry) / (entry - stop_loss)

Example: entry=₹1391, ATR=₹37
  SL  = 1391 − (1.5 × 37) = ₹1335.5
  Tgt = 1391 + (3.0 × 37) = ₹1502
  R:R = 111 / 55.5         = 2.0x

── Signal Logic (Trade_Dashboard!D27) ───────────────
BUY TODAY  = bias=STRONG BULLISH
             AND india≠WEAK  (toggle with buy_requires_india_not_weak)
             AND global≠RISK OFF (toggle with buy_requires_global_not_off)
SELL TODAY = bias=STRONG BEARISH
             AND india=WEAK (toggle with sell_requires_india_weak)
WATCHLIST  = everything else`,
  },
  contracts: {
    sheet: "Contract Tracker",
    formula: `Filter: contract_value >= min_value_cr (in Crores)
Cache TTL: cache_hours (hours)`,
  },
  news_feeds: {
    sheet: "news_feeds config + RSS_FEEDS list",
    formula: `18 RSS feeds across 9 categories:
  INDIA_MARKETS   → ET Markets, Business Standard, Moneycontrol, Livemint, FE, Zee Business
  INDIA_COMPANIES → Business Standard Companies, Livemint Companies
  INDIA_ECONOMY   → ET Economy, BS Economy Policy, Moneycontrol Economy
  INDIA_INDUSTRY  → ET Industry
  INDIA_BUSINESS  → Moneycontrol Business, NDTV Profit
  GLOBAL_MACRO    → Reuters Business
  COMMODITIES     → Investing.com Commodities
  FOREX           → Investing.com Forex
  GOVT_POLICY     → PIB Finance

Cache:  cache_minutes  × 60 seconds
AI:     Top ai_analysis_limit items get Groq analysis
Filter: disabled_sources = ["Reuters", ...]  → skips those feeds`,
  },
};

/* ─── Field definitions per section ───────────────────────────────── */
const FIELDS = {
  global_macro: [
    { key: "risk_on_threshold", label: "Risk ON Threshold", tooltip: "J2 >= this → RISK ON", type: "number", step: 1 },
    { key: "risk_off_threshold", label: "Risk OFF Threshold", tooltip: "J2 <= this → RISK OFF", type: "number", step: 1 },
    { key: "sp500_weight", label: "S&P 500 Weight", tooltip: "Multiplier for S&P signal", type: "number", step: 1 },
    { key: "yield_weight", label: "Yield (TLT) Weight", tooltip: "Multiplier for TLT/yield signal", type: "number", step: 1 },
    { key: "dxy_weight", label: "Dollar (UUP) Weight", tooltip: "Multiplier for dollar signal", type: "number", step: 1 },
  ],
  india_market: [
    { key: "strong_threshold", label: "Strong Threshold", tooltip: "H2 >= this → STRONG", type: "number", step: 1 },
    { key: "weak_threshold", label: "Weak Threshold", tooltip: "H2 <= this → WEAK", type: "number", step: 1 },
    { key: "vix_low_threshold", label: "VIX Low Threshold", tooltip: "VIX < this → bullish (+1)", type: "number", step: 1 },
    { key: "breadth_threshold", label: "Breadth Threshold", tooltip: "Advance/Decline > this → bullish", type: "number", step: 0.1 },
    { key: "nifty_weight", label: "Nifty Weight", tooltip: "Weight of Nifty signal", type: "number", step: 1 },
    { key: "breadth_weight", label: "Breadth Weight", tooltip: "Weight of Advance/Decline signal", type: "number", step: 1 },
    { key: "vix_weight", label: "VIX Weight", tooltip: "Weight of VIX signal", type: "number", step: 1 },
  ],
  universe_score: [
    { key: "score_max", label: "Score Max Cap", tooltip: "MIN cap in the formula", type: "number", step: 1 },
    { key: "shortlist_threshold", label: "Shortlist Threshold", tooltip: "Score >= this → shortlist YES", type: "number", step: 1 },
    { key: "zone_values", label: "Zone Values (+1)", tooltip: "Which zones give +1 point", type: "tags" },
    { key: "results_quality_value", label: "Results Quality Value", tooltip: "H column value that gives +1", type: "select", options: ["Strong", "Average", "Weak"] },
    { key: "sales_growth_value", label: "Sales Growth Value", tooltip: "I column value that gives +1", type: "select", options: ["Strong", "Average", "Weak"] },
    { key: "volume_accum_value", label: "Volume Accumulation Value", tooltip: "J column value that gives +1", type: "select", options: ["High", "Medium", "Low"] },
    { key: "extended_penalty_value", label: "Extended Penalty Value", tooltip: 'K="No" (not extended) gives +1', type: "select", options: ["No", "Yes"] },
  ],
  momentum: [
    { key: "bullish_threshold", label: "Bullish Threshold", tooltip: "Score >= this → STRONG BULLISH", type: "number", step: 1 },
    { key: "bearish_threshold", label: "Bearish Threshold", tooltip: "Score <= this → STRONG BEARISH", type: "number", step: 1 },
    { key: "weight_1d", label: "1-Day Return Weight", tooltip: "Weight of 1-day return signal", type: "number", step: 1 },
    { key: "weight_20d", label: "20-Day Return Weight", tooltip: "Weight of 20-day return signal", type: "number", step: 1 },
  ],
  technicals: [
    { key: "dma_short", label: "Short DMA Period", tooltip: "Rolling average for 20DMA", type: "number", step: 1 },
    { key: "dma_long", label: "Long DMA Period", tooltip: "Rolling average for 50DMA", type: "number", step: 1 },
    { key: "atr_period", label: "ATR Period", tooltip: "Average True Range period", type: "number", step: 1 },
    { key: "return_short_days", label: "Short Return Days", tooltip: "5D return lookback", type: "number", step: 1 },
    { key: "return_long_days", label: "Long Return Days", tooltip: "20D return lookback", type: "number", step: 1 },
    { key: "vol_avg_period", label: "Volume Avg Period", tooltip: "Volume moving average period", type: "number", step: 1 },
    { key: "vol_spike_lookback", label: "Vol Spike Lookback", tooltip: "MAX over last N days", type: "number", step: 1 },
    { key: "vol_spike_multiplier", label: "Vol Spike Multiplier", tooltip: "Spike threshold = this × avg volume", type: "number", step: 0.1 },
  ],
  trade_sizing: [
    { key: "atr_sl_multiplier", label: "ATR Stop Loss Multiplier", tooltip: "SL = entry - (this × ATR)", type: "number", step: 0.1 },
    { key: "atr_target_multiplier", label: "ATR Target Multiplier", tooltip: "Target = entry + (this × ATR)", type: "number", step: 0.1 },
    { key: "min_rr_ratio", label: "Min R:R Ratio", tooltip: "Minimum Risk:Reward to show BUY", type: "number", step: 0.1 },
  ],
  trade_decision: [
    { key: "buy_requires_india_not_weak", label: "BUY needs India ≠ WEAK", tooltip: "Toggle India market condition for buy", type: "boolean" },
    { key: "buy_requires_global_not_off", label: "BUY needs Global ≠ RISK OFF", tooltip: "Toggle global risk condition for buy", type: "boolean" },
    { key: "sell_requires_india_weak", label: "SELL needs India = WEAK", tooltip: "Toggle India market condition for sell", type: "boolean" },
    { key: "primary_bias_ticker", label: "Primary Bias Ticker", tooltip: "Excel used INFY as proxy — change to any", type: "text" },
  ],
  ema_timing: [
    { key: "period", label: "EMA Period", tooltip: "Which EMA to track", type: "number", step: 1 },
    { key: "best_timing_pct", label: "Best Timing %", tooltip: "Within this % = BEST TIMING", type: "number", step: 0.1 },
    { key: "near_ema_pct", label: "Near EMA %", tooltip: "Within this % = NEAR EMA", type: "number", step: 0.1 },
    { key: "extended_pct", label: "Extended %", tooltip: "Beyond this % = EXTENDED", type: "number", step: 0.1 },
  ],
  sector_rotation: [
    { key: "strong_inflow_score", label: "Strong Inflow Score", tooltip: "momentum >= this → STRONG INFLOW", type: "number", step: 1 },
    { key: "mild_inflow_score", label: "Mild Inflow Score", tooltip: "momentum >= this → MILD INFLOW", type: "number", step: 1 },
    { key: "lookback_days", label: "Lookback Days", tooltip: "1-month lookback in trading days", type: "number", step: 1 },
  ],
  seasonal: [
    { key: "years", label: "Historical Years", tooltip: "How many years of history", type: "number", step: 1 },
    { key: "rising_win_rate", label: "Rising Win Rate %", tooltip: "Win rate >= this → RISING signal", type: "number", step: 1 },
    { key: "falling_win_rate", label: "Falling Win Rate %", tooltip: "Win rate <= this → FALLING signal", type: "number", step: 1 },
    { key: "pre_result_days", label: "Pre-Result Days", tooltip: "Days before result to measure", type: "number", step: 1 },
    { key: "pre_result_buy_threshold", label: "Pre-Result Buy %", tooltip: "Win rate >= this → BUY BEFORE RESULT", type: "number", step: 1 },
    { key: "pre_result_avoid_threshold", label: "Pre-Result Avoid %", tooltip: "Win rate <= this → AVOID", type: "number", step: 1 },
  ],
  action_plan: [
    // ── Trade Sizing ──
    { key: "atr_sl_multiplier",    section: "trade_sizing",   label: "ATR Stop Loss Multiplier",    tooltip: "SL = entry − (this × ATR14)",              type: "number", step: 0.1 },
    { key: "atr_target_multiplier",section: "trade_sizing",   label: "ATR Target Multiplier",       tooltip: "Target = entry + (this × ATR14)",           type: "number", step: 0.1 },
    { key: "min_rr_ratio",         section: "trade_sizing",   label: "Min R:R Ratio",               tooltip: "Min R:R to show as a valid BUY signal",     type: "number", step: 0.1 },
    // ── Trade Decision ──
    { key: "buy_requires_india_not_weak",  section: "trade_decision", label: "BUY needs India ≠ WEAK",      tooltip: "Require India market STRONG/RANGE for BUY", type: "boolean" },
    { key: "buy_requires_global_not_off",  section: "trade_decision", label: "BUY needs Global ≠ RISK OFF",  tooltip: "Require global macro not in RISK OFF mode",  type: "boolean" },
    { key: "sell_requires_india_weak",     section: "trade_decision", label: "SELL needs India = WEAK",      tooltip: "Require India WEAK for a SELL signal",       type: "boolean" },
    { key: "primary_bias_ticker",         section: "trade_decision", label: "Primary Bias Ticker",          tooltip: "Excel used INFY as proxy — change as needed", type: "text" },
  ],
  contracts: [
    { key: "min_value_cr", label: "Min Contract Value (Cr)", tooltip: "Minimum crore value to show", type: "number", step: 10 },
    { key: "cache_hours", label: "Cache Hours", tooltip: "How often to re-scan news", type: "number", step: 1 },
  ],
  news_feeds: [
    { key: "max_items_per_feed", label: "Max Items per Feed",    tooltip: "Max entries fetched per RSS URL",        type: "number", step: 1 },
    { key: "total_limit",        label: "Total News Limit",      tooltip: "Max items returned across all feeds",     type: "number", step: 5 },
    { key: "ai_analysis_limit",  label: "AI Analysis Limit",     tooltip: "How many items get Groq AI analysis",    type: "number", step: 1 },
    { key: "cache_minutes",      label: "Cache Minutes",          tooltip: "How long to cache combined news response",type: "number", step: 1 },
  ],
};

/* ─── News Feeds Tab Component ─────────────────────────────────────── */
const ALL_FEED_SOURCES = [
  { source: "Economic Times",   category: "INDIA_MARKETS / INDUSTRY / ECONOMY", color: "#3b82f6" },
  { source: "Business Standard",category: "INDIA_MARKETS / ECONOMY / COMPANIES", color: "#6366f1" },
  { source: "Moneycontrol",     category: "INDIA_MARKETS / BUSINESS / ECONOMY",  color: "#8b5cf6" },
  { source: "Livemint",         category: "INDIA_MARKETS / COMPANIES",           color: "#14b8a6" },
  { source: "Financial Express",category: "INDIA_MARKETS",                        color: "#0ea5e9" },
  { source: "NDTV Profit",      category: "INDIA_BUSINESS",                       color: "#6366f1" },
  { source: "Zee Business",     category: "INDIA_MARKETS",                        color: "#f59e0b" },
  { source: "Reuters",          category: "GLOBAL_MACRO",                         color: "#f97316" },
  { source: "Investing.com",    category: "COMMODITIES / FOREX",                  color: "#ec4899" },
  { source: "PIB Finance",      category: "GOVT_POLICY",                          color: "#ef4444" },
];

function NewsFeedsTab({ config, updateField }) {
  const [testResults, setTestResults] = React.useState({});
  const [testing,     setTesting]     = React.useState({});

  const disabled = Array.isArray(config?.news_feeds?.disabled_sources)
    ? config.news_feeds.disabled_sources
    : [];

  const toggleSource = (source) => {
    const next = disabled.includes(source)
      ? disabled.filter((s) => s !== source)
      : [...disabled, source];
    updateField("news_feeds", "disabled_sources", next);
  };

  const testFeed = async (source) => {
    setTesting((p) => ({ ...p, [source]: true }));
    try {
      const res = await fetch(`/api/news/feed-test/${encodeURIComponent(source)}`);
      const data = await res.json();
      setTestResults((p) => ({ ...p, [source]: data }));
    } catch {
      setTestResults((p) => ({ ...p, [source]: { status: "error", count: 0 } }));
    }
    setTesting((p) => ({ ...p, [source]: false }));
  };

  const limits = config?.news_feeds || {};
  const limitFields = FIELDS.news_feeds || [];

  return (
    <div className="ap-layout">
      {/* Numeric limits */}
      <div className="ap-group">
        <div className="ap-group-header">
          <span className="ap-group-icon">⚙️</span>
          <div>
            <div className="ap-group-title">Fetch Limits</div>
            <div className="ap-group-sub">Control how much data is fetched and cached</div>
          </div>
        </div>
        <div className="config-fields ap-fields">
          {limitFields.map((field) => (
            <ParamField
              key={field.key}
              label={field.label}
              tooltip={field.tooltip}
              value={limits[field.key]}
              defaultValue={field.key === "max_items_per_feed" ? 10 : field.key === "total_limit" ? 50 : field.key === "ai_analysis_limit" ? 10 : 10}
              type={field.type}
              step={field.step}
              onChange={(val) => updateField("news_feeds", field.key, val)}
              onReset={() => {}}
              isChanged={false}
            />
          ))}
        </div>
      </div>

      {/* Feed toggle table */}
      <div className="ap-group">
        <div className="ap-group-header">
          <span className="ap-group-icon">📡</span>
          <div>
            <div className="ap-group-title">RSS Sources</div>
            <div className="ap-group-sub">Toggle feeds on/off without touching code. Changes take effect after Save.</div>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2d3142" }}>
                {["Source", "Category", "Status", "Test"].map((h) => (
                  <th key={h} style={{ padding: "8px 16px", textAlign: "left", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_FEED_SOURCES.map((feed) => {
                const isOn = !disabled.includes(feed.source);
                const result = testResults[feed.source];
                const testing_ = testing[feed.source];
                return (
                  <tr key={feed.source} style={{ borderBottom: "1px solid #1e2433" }}>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: feed.color, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{feed.source}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 16px", color: "#64748b", fontSize: 11 }}>{feed.category}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <label className="param-field-toggle" style={{ gap: 8 }}>
                        <input type="checkbox" checked={isOn} onChange={() => toggleSource(feed.source)} />
                        <span className="param-field-toggle-track">
                          <span className="param-field-toggle-thumb" />
                        </span>
                        <span style={{ fontSize: 11, color: isOn ? "#22c55e" : "#64748b", fontWeight: 600 }}>{isOn ? "ON" : "OFF"}</span>
                      </label>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={() => testFeed(feed.source)}
                          disabled={testing_}
                          style={{ padding: "4px 10px", background: "#1e2433", border: "1px solid #334155", borderRadius: 4, color: "#94a3b8", fontSize: 11, cursor: "pointer" }}
                        >
                          {testing_ ? "..." : "Test"}
                        </button>
                        {result && (
                          <span style={{ fontSize: 11, color: result.status === "ok" ? "#22c55e" : "#ef4444" }}>
                            {result.status === "ok" ? `✓ ${result.count} items` : "✗ Error"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Action Plan Composite Component ─────────────────────────────── */
function ActionPlanCard({ config }) {
  const ts = config?.trade_sizing || {};
  const td = config?.trade_decision || {};
  const ENTRY = 1391.10;
  const ATR   = 37.20;
  const sl    = ENTRY - (ts.atr_sl_multiplier  || 1.5) * ATR;
  const tgt   = ENTRY + (ts.atr_target_multiplier || 3.0) * ATR;
  const rr    = ((tgt - ENTRY) / Math.max(ENTRY - sl, 0.01)).toFixed(2);

  const conditions = [
    td.buy_requires_india_not_weak   && "India ≠ WEAK",
    td.buy_requires_global_not_off   && "Global ≠ RISK OFF",
  ].filter(Boolean);

  return (
    <div className="ap-card">
      <div className="ap-card-header">
        <span className="ap-card-title">🎬 Action Plan Preview</span>
        <span className="ap-card-subtitle">Model 4 — Datewise Robust</span>
      </div>
      <div className="ap-card-signal">
        <div className="ap-signal-label">AGGREGATED SIGNAL</div>
        <div className="ap-signal-badge">WATCHLIST</div>
      </div>
      <div className="ap-card-rows">
        <div className="ap-row">
          <span className="ap-row-label">Entry (sample)</span>
          <span className="ap-row-value">₹{ENTRY.toFixed(2)}</span>
        </div>
        <div className="ap-row">
          <span className="ap-row-label">Target ({ts.atr_target_multiplier || 3.0}× ATR)</span>
          <span className="ap-row-value ap-green">₹{tgt.toFixed(2)}</span>
        </div>
        <div className="ap-row">
          <span className="ap-row-label">Stop Loss ({ts.atr_sl_multiplier || 1.5}× ATR)</span>
          <span className="ap-row-value ap-red">₹{sl.toFixed(2)}</span>
        </div>
        <div className="ap-row">
          <span className="ap-row-label">R:R Ratio</span>
          <span className="ap-row-value ap-bold">{rr}</span>
        </div>
        <div className="ap-row">
          <span className="ap-row-label">ATR Used</span>
          <span className="ap-row-value ap-muted">₹{ATR}</span>
        </div>
      </div>
      {conditions.length > 0 && (
        <div className="ap-conditions">
          <div className="ap-conditions-label">BUY requires:</div>
          {conditions.map((c, i) => (
            <span key={i} className="ap-conditions-chip">✓ {c}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionPlanFields({ fields, config, defaults, updateField, resetFieldToDefault, isFieldChanged }) {
  const sizingFields   = fields.filter(f => f.section === "trade_sizing");
  const decisionFields = fields.filter(f => f.section === "trade_decision");

  const renderField = (field) => (
    <ParamField
      key={field.key}
      label={field.label}
      tooltip={field.tooltip}
      value={config?.[field.section]?.[field.key]}
      defaultValue={defaults?.[field.section]?.[field.key]}
      type={field.type}
      step={field.step}
      options={field.options}
      onChange={(val) => updateField(field.section, field.key, val)}
      onReset={() => resetFieldToDefault(field.section, field.key)}
      isChanged={isFieldChanged(field.section, field.key)}
    />
  );

  return (
    <div className="ap-layout">
      {/* Live card preview */}
      <ActionPlanCard config={config} />

      {/* Sizing group */}
      <div className="ap-group">
        <div className="ap-group-header">
          <span className="ap-group-icon">💰</span>
          <div>
            <div className="ap-group-title">Position Sizing</div>
            <div className="ap-group-sub">ATR-based stop loss &amp; target multipliers</div>
          </div>
        </div>
        <div className="config-fields ap-fields">
          {sizingFields.map(renderField)}
        </div>
      </div>

      {/* Decision group */}
      <div className="ap-group">
        <div className="ap-group-header">
          <span className="ap-group-icon">🎯</span>
          <div>
            <div className="ap-group-title">Signal Conditions</div>
            <div className="ap-group-sub">When to trigger BUY / SELL / WATCHLIST</div>
          </div>
        </div>
        <div className="config-fields ap-fields">
          {decisionFields.map(renderField)}
        </div>
      </div>
    </div>
  );
}

export default function ConfigPage() {
  const {
    config,
    defaults,
    loading,
    saving,
    error,
    toast,
    history,
    updateField,
    resetFieldToDefault,
    saveConfig,
    resetConfig,
    rollback,
    isFieldChanged,
    hasAnyChanges,
    refetch,
  } = useConfig();

  const [activeTab, setActiveTab] = useState("global_macro");
  const [showHistory, setShowHistory] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (loading) {
    return (
      <div className="config-page-loading">
        <div className="config-page-spinner" />
        Loading configuration...
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="config-page-loading" style={{ flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 36 }}>⚠️</div>
        <div style={{ color: "#f87171", fontWeight: 600 }}>Backend Unavailable</div>
        <div style={{ color: "#64748b", fontSize: 13, maxWidth: 420, textAlign: "center" }}>
          {error || "Could not load config."}<br />
          Make sure the Python backend is running on port 8000.
        </div>
        <button
          onClick={refetch}
          style={{
            marginTop: 8, padding: "10px 24px", background: "#3b82f6",
            border: "none", borderRadius: 8, color: "white",
            fontSize: 13, fontWeight: 600, cursor: "pointer"
          }}
        >
          🔄 Retry
        </button>
        <Link to="/" style={{ color: "#3b82f6", fontSize: 13, marginTop: 4 }}>← Back to Dashboard</Link>
      </div>
    );
  }

  const tabInfo = TABS.find((t) => t.key === activeTab);
  const fields = FIELDS[activeTab] || [];
  const formulaInfo = FORMULAS[activeTab];

  return (
    <div className="config-page">
      {/* Toast */}
      {toast && (
        <div className={`config-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="config-header">
        <div className="config-header-left">
          <Link to="/" className="config-back-link">← Dashboard</Link>
          <h1 className="config-page-title">Model Configuration</h1>
          <p className="config-page-subtitle">
            Edit scoring formulas, thresholds and weights — all parameters from the Excel model
          </p>
        </div>
        <div className="config-header-right">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="config-history-toggle"
          >
            🕓 History
          </button>
        </div>
      </header>

      <div className="config-layout">
        {/* Sidebar */}
        <ConfigSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasChanges={hasAnyChanges()}
        />

        {/* Main Content */}
        <main className="config-main">
          {/* Section Header */}
          <div className="config-section-header">
            <div>
              <h2 className="config-section-title">
                {tabInfo?.icon} {tabInfo?.label}
              </h2>
              <p className="config-section-subtitle">
                {tabInfo?.subtitle}
              </p>
            </div>
          </div>

          {/* Formula Reference */}
          {formulaInfo && (
            <FormulaBox
              formula={formulaInfo.formula}
              sheetRef={formulaInfo.sheet}
            />
          )}

          {/* Parameter Fields */}
          {activeTab === "action_plan" ? (
            <ActionPlanFields
              fields={fields}
              config={config}
              defaults={defaults}
              updateField={updateField}
              resetFieldToDefault={resetFieldToDefault}
              isFieldChanged={isFieldChanged}
            />
          ) : activeTab === "news_feeds" ? (
            <NewsFeedsTab config={config} updateField={updateField} />
          ) : (
            <div className="config-fields">
              {fields.map((field) => (
                <ParamField
                  key={field.key}
                  label={field.label}
                  tooltip={field.tooltip}
                  value={config?.[activeTab]?.[field.key]}
                  defaultValue={defaults?.[activeTab]?.[field.key]}
                  type={field.type}
                  step={field.step}
                  options={field.options}
                  onChange={(val) => updateField(activeTab, field.key, val)}
                  onReset={() => resetFieldToDefault(activeTab, field.key)}
                  isChanged={isFieldChanged(activeTab, field.key)}
                />
              ))}
            </div>
          )}

          {/* Live Preview */}
          <LivePreview section={activeTab} config={config} />
        </main>

        {/* History Sidebar */}
        {showHistory && (
          <aside className="config-history-panel">
            <ChangeHistory history={history} onRollback={rollback} />
          </aside>
        )}
      </div>

      {/* Bottom Action Bar */}
      <footer className="config-action-bar">
        <button
          onClick={() => setShowResetConfirm(true)}
          className="config-reset-btn"
          disabled={saving}
        >
          ↺ Reset All to Excel Defaults
        </button>
        <button
          onClick={saveConfig}
          className="config-save-btn"
          disabled={saving}
        >
          {saving ? "Saving..." : "💾 Save Changes"}
        </button>
      </footer>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="config-modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="config-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="config-modal-title">⚠️ Reset Configuration</h3>
            <p className="config-modal-text">
              Reset all parameters to original Excel model values? This cannot be undone
              (but the current version will be saved in history).
            </p>
            <div className="config-modal-actions">
              <button onClick={() => setShowResetConfirm(false)} className="config-modal-cancel">
                Cancel
              </button>
              <button
                onClick={() => {
                  resetConfig();
                  setShowResetConfirm(false);
                }}
                className="config-modal-confirm"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
