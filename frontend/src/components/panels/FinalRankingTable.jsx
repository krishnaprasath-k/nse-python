import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API_BASE = "/api";

/* ─── Signal styling ─────────────────────────────────────────── */
const BUY_SIGNAL_COLOR = {
  "STRONG BUY": "bg-emerald-600 text-white",
  BUY: "bg-green-500 text-white",
  WATCH: "bg-amber-400 text-white",
  "WEAK WATCH": "bg-gray-300 text-gray-700",
  AVOID: "bg-red-500 text-white",
  "GAP-UP WAIT": "bg-sky-400 text-white",
  "BLOCKED (MARKET WEAK)": "bg-orange-400 text-white",
};

const SELL_SIGNAL_COLOR = {
  "STRONG SHORT": "bg-red-700 text-white",
  SHORT: "bg-red-500 text-white",
  "AVOID SHORT": "bg-gray-300 text-gray-600",
  AVOID: "bg-red-400 text-white",
  WATCH: "bg-amber-400 text-white",
};

const REGIME_COLOR = {
  "RISK ON": "bg-emerald-100 text-emerald-800 border border-emerald-300",
  NEUTRAL: "bg-amber-50 text-amber-800 border border-amber-200",
  "RISK OFF": "bg-red-100 text-red-700 border border-red-300",
  STRONG: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  RANGE: "bg-amber-50 text-amber-800 border border-amber-200",
  WEAK: "bg-red-100 text-red-700 border border-red-300",
};

/* ─── Score bar ──────────────────────────────────────────────── */
function ScoreBar({ score, max = 100, color = "bg-blue-500" }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`${color} h-full rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold w-6 text-right">{score}</span>
    </div>
  );
}

/* ─── EMA badge ──────────────────────────────────────────────── */
const EMA_STYLE = {
  "BEST TIMING": "bg-emerald-100 text-emerald-800",
  "NEAR EMA": "bg-green-50 text-green-700",
  "SLIGHTLY EXTENDED": "bg-amber-50 text-amber-700",
  "BELOW EMA": "bg-sky-100 text-sky-800",
  EXTENDED: "bg-red-50 text-red-600",
};
function EmaBadge({ signal }) {
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${EMA_STYLE[signal] || "bg-gray-100 text-gray-500"}`}
    >
      {signal || "-"}
    </span>
  );
}

/* ─── Breakdown tooltip ──────────────────────────────────────── */
function BreakdownTooltip({ breakdown = {}, isSell = false }) {
  const keys = isSell
    ? [
        "bearish_regime",
        "weak_sector",
        "bearish_structure",
        "bearish_momentum",
        "distribution_vol",
      ]
    : [
        "market_regime",
        "sector_demand",
        "demand_type",
        "tech_structure",
        "momentum",
        "volume",
        "execution",
      ];
  const labels = isSell
    ? ["Regime", "Weak Sector", "Structure", "Momentum", "Dist. Vol"]
    : ["Regime", "Sector", "Demand", "Tech", "Momentum", "Volume", "Exec"];
  const maxes = isSell ? [20, 15, 20, 15, 10] : [20, 15, 10, 20, 15, 10, 10];

  return (
    <div className="absolute z-20 right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-48 text-[10px]">
      {keys.map((k, i) => (
        <div key={k} className="flex items-center gap-1.5 mb-1.5 last:mb-0">
          <span className="w-16 text-gray-500 shrink-0">{labels[i]}</span>
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${isSell ? "bg-red-400" : "bg-blue-400"}`}
              style={{
                width: `${Math.min(100, ((breakdown[k] ?? 0) / maxes[i]) * 100)}%`,
              }}
            />
          </div>
          <span className="font-bold w-4 text-right">{breakdown[k] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Single stock row ───────────────────────────────────────── */
function StockRow({ s, rank, isSell, signalMap }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const chgPct = s.change_pct ?? 0;
  const chgColor =
    chgPct > 0
      ? "text-emerald-600"
      : chgPct < 0
        ? "text-red-500"
        : "text-gray-400";
  const sigCls = signalMap[s.signal] || "bg-gray-200 text-gray-600";

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors group">
      <td className="px-2 py-2 text-gray-300 text-[10px] w-6">{rank}</td>
      <td className="px-2 py-2">
        <div className="font-bold text-[10px] font-mono text-indigo-700 leading-tight">
          {s.ticker?.replace(".NS", "") ?? "-"}
        </div>
        <div className="text-[9px] text-gray-400 max-w-[90px] truncate leading-tight">
          {s.name}
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="text-[9px] text-gray-500 truncate max-w-[80px]">
          {s.sector ?? "-"}
        </div>
        <EmaBadge signal={s.ema_signal} />
      </td>
      <td className="px-2 py-2 text-right">
        <div className="font-semibold text-[11px] text-gray-800">
          {s.price ? `₹${s.price.toFixed(0)}` : "-"}
        </div>
        <div className={`text-[9px] font-bold ${chgColor}`}>
          {chgPct > 0 ? "+" : ""}
          {(chgPct * 100).toFixed(2)}%
        </div>
      </td>
      <td className="px-2 py-2 w-28">
        <ScoreBar
          score={s.total_score ?? 0}
          max={100}
          color={isSell ? "bg-red-400" : "bg-indigo-500"}
        />
      </td>
      <td className="px-2 py-2 text-center">
        <span
          className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${sigCls}`}
        >
          {s.signal ?? "-"}
        </span>
      </td>
      <td className="px-2 py-2 text-center relative">
        {Object.keys(s.breakdown ?? {}).length > 0 && (
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-gray-400 hover:text-indigo-600 underline"
            onClick={() => setShowBreakdown((v) => !v)}
          >
            detail
          </button>
        )}
        {showBreakdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowBreakdown(false)}
            />
            <BreakdownTooltip breakdown={s.breakdown} isSell={isSell} />
          </>
        )}
      </td>
    </tr>
  );
}

/* ─── One side panel (Buy or Sell) ──────────────────────────── */
function SidePanel({
  title,
  icon,
  stocks = [],
  isSell = false,
  headerClass,
  isLoading,
}) {
  const signalMap = isSell ? SELL_SIGNAL_COLOR : BUY_SIGNAL_COLOR;

  return (
    <div className="flex-1 min-w-0 border rounded-xl overflow-hidden shadow-sm">
      {/* header */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${headerClass}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-bold text-[14px]">{title}</span>
          {!isLoading && (
            <span className="text-[10px] font-normal opacity-80">
              ({stocks.length} stocks)
            </span>
          )}
        </div>
        <span className="text-[9px] font-semibold opacity-70 uppercase tracking-wide">
          {isSell ? "Model-4 Short" : "Model-3 Long"}
        </span>
      </div>

      {/* table */}
      <div className="overflow-x-auto overflow-y-auto max-h-[460px]">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Loading...
          </div>
        ) : stocks.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-gray-400">
            No {isSell ? "sell" : "buy"} candidates found
          </div>
        ) : (
          <table className="min-w-full text-[11px] text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b text-[10px] text-gray-400 font-semibold bg-gray-50">
                <th className="px-2 py-2 w-6">#</th>
                <th className="px-2 py-2">Ticker</th>
                <th className="px-2 py-2">Sector / EMA</th>
                <th className="px-2 py-2 text-right">Price</th>
                <th className="px-2 py-2">Score /100</th>
                <th className="px-2 py-2 text-center">Signal</th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {stocks.map((s, i) => (
                <StockRow
                  key={s.ticker ?? i}
                  s={s}
                  rank={i + 1}
                  isSell={isSell}
                  signalMap={signalMap}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─── Market regime badge ────────────────────────────────────── */
function RegimeBadge({ label }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold ${REGIME_COLOR[label] || "bg-gray-100 text-gray-600"}`}
    >
      {label}
    </span>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export function FinalRankingTable() {
  const [top, setTop] = useState(15);
  const [viewMode, setViewMode] = useState("split"); // split | buy | sell

  const { data, isLoading } = useQuery({
    queryKey: ["screener_ranked", top],
    queryFn: async () => {
      const params = new URLSearchParams({ top });
      return (await axios.get(`${API_BASE}/screener/ranked?${params}`)).data;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) =>
      query.state.data?.status === "building" ? 5000 : false,
  });

  const isBuilding = !data || data.status === "building";
  const market = data?.market ?? {};

  const buyStocks = data?.buy ?? [];
  const sellStocks = data?.sell ?? [];

  return (
    <section className="bg-white border rounded-xl p-4 shadow-sm w-full mt-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-bold text-brand-primary">
            Probability Ranking
          </h2>
          {market.global_risk && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400">Global:</span>
              <RegimeBadge label={market.global_risk} />
              <span className="text-[10px] text-gray-400">India:</span>
              <RegimeBadge label={market.india_bias} />
              {market.is_bearish && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold border border-red-200">
                  ⚠ Model-4 ACTIVE
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border rounded overflow-hidden text-[11px]">
            {[
              ["split", "⇌ Split"],
              ["buy", "📈 Buy"],
              ["sell", "📉 Sell"],
            ].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 transition-colors ${viewMode === v ? "bg-indigo-600 text-white font-bold" : "bg-white hover:bg-gray-50 text-gray-600"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Top N */}
          <select
            className="border rounded px-2 py-1.5 text-[11px] bg-white"
            value={top}
            onChange={(e) => setTop(Number(e.target.value))}
          >
            {[10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Building progress ── */}
      {isBuilding && (
        <div className="mb-4">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
            <span>Scoring all NSE stocks…</span>
            <span>{data?.progress ?? 0}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${data?.progress ?? 0}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Downloading 3-month price data for Nifty 500 stocks. Takes 1–2 min
            on first load.
          </p>
        </div>
      )}

      {/* ── Side-by-side panels ── */}
      {!isBuilding && (
        <div
          className={`flex gap-4 ${viewMode === "split" ? "flex-col md:flex-row" : "flex-col"}`}
        >
          {(viewMode === "split" || viewMode === "buy") && (
            <SidePanel
              title="Buy Candidates"
              icon="📈"
              stocks={buyStocks}
              isSell={false}
              headerClass="bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100 text-emerald-900"
              isLoading={isLoading}
            />
          )}
          {(viewMode === "split" || viewMode === "sell") && (
            <SidePanel
              title={
                market.is_bearish
                  ? "Short Candidates (Model-4)"
                  : "Weak Stocks (Avoid / Short Watch)"
              }
              icon="📉"
              stocks={sellStocks}
              isSell={true}
              headerClass="bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100 text-red-900"
              isLoading={isLoading}
            />
          )}
        </div>
      )}

      {/* ── Legend ── */}
      {!isBuilding && (
        <div className="mt-3 flex flex-wrap gap-3 text-[9px] text-gray-400 border-t pt-3">
          <span>
            Score /100 = Market Regime(20) + Demand(25) + Technical(20) +
            Momentum(15) + Volume(10) + Execution(10)
          </span>
          <span className="ml-auto">
            Hover a row → click "detail" for score breakdown
          </span>
        </div>
      )}
    </section>
  );
}
