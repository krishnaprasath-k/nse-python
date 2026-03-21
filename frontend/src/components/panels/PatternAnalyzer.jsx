import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API_BASE = "/api";

const PATTERN_LABEL = {
  BEAR_FLAG:    "Bear Flag",
  DIST_CHANNEL: "Dist. Channel",
  EMA_CROSS:    "EMA Cross",
};

const PATTERN_COLOR = {
  BEAR_FLAG:    "bg-red-100 text-red-800 border border-red-200",
  DIST_CHANNEL: "bg-orange-100 text-orange-800 border border-orange-200",
  EMA_CROSS:    "bg-purple-100 text-purple-800 border border-purple-200",
};

const STAGE_COLOR = {
  Stage1_Fresh:   "bg-rose-50 text-rose-700",
  Stage2_Retest:  "bg-amber-50 text-amber-700",
  Stage3_Channel: "bg-gray-100 text-gray-600",
};

const CONF_COLOR = {
  High:   "bg-red-500 text-white",
  Medium: "bg-amber-400 text-white",
  Low:    "bg-gray-300 text-gray-700",
};

function PatternBadge({ pattern }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PATTERN_COLOR[pattern] || "bg-gray-100 text-gray-600"}`}>
      {PATTERN_LABEL[pattern] || pattern}
    </span>
  );
}

function StageBadge({ stage }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${STAGE_COLOR[stage] || "bg-gray-100 text-gray-500"}`}>
      {stage?.replace("_", " ") || "-"}
    </span>
  );
}

export function PatternAnalyzer() {
  const [patternFilter, setPatternFilter] = useState("");
  const [confFilter, setConfFilter] = useState("");

  const params = new URLSearchParams({ limit: 50 });
  if (patternFilter) params.set("pattern", patternFilter);
  if (confFilter)    params.set("confidence", confFilter);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["patterns", patternFilter, confFilter],
    queryFn: async () => (await axios.get(`${API_BASE}/patterns/signals?${params}`)).data,
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) => query.state.data?.status === "building" ? 5000 : false,
  });

  const isBuilding = !data || data.status === "building";
  const summary    = data?.summary ?? {};

  const handleRescan = async () => {
    await axios.post(`${API_BASE}/patterns/scan`);
    setTimeout(() => refetch(), 1000);
  };

  return (
    <section className="bg-white border rounded-xl p-4 shadow-sm w-full mt-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-bold text-brand-primary">Pattern Analyzer</h2>
          {data?.status === "ready" && (
            <div className="flex gap-2 text-[10px]">
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold border border-red-200">
                {summary.bear_flag ?? 0} Bear Flag
              </span>
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold border border-orange-200">
                {summary.dist_channel ?? 0} Dist. Channel
              </span>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold border border-purple-200">
                {summary.ema_cross ?? 0} EMA Cross
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-1 text-[11px] bg-white"
            value={patternFilter}
            onChange={(e) => setPatternFilter(e.target.value)}
          >
            <option value="">All Patterns</option>
            <option value="BEAR_FLAG">Bear Flag</option>
            <option value="DIST_CHANNEL">Dist. Channel</option>
            <option value="EMA_CROSS">EMA Cross</option>
          </select>
          <select
            className="border rounded px-2 py-1 text-[11px] bg-white"
            value={confFilter}
            onChange={(e) => setConfFilter(e.target.value)}
          >
            <option value="">All Confidence</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <button
            onClick={handleRescan}
            className="border rounded px-3 py-1 text-[11px] bg-gray-50 hover:bg-gray-100 font-semibold"
          >
            ↺ Rescan
          </button>
        </div>
      </div>

      {/* Building progress */}
      {isBuilding && (
        <div className="mb-4">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
            <span>Scanning top stocks for chart patterns…</span>
            <span>{data?.progress ?? 0}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${data?.progress ?? 0}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Fetching 6-month OHLCV and running pattern detection on top {80} stocks.
          </p>
        </div>
      )}

      {/* Table */}
      {!isBuilding && (
        data?.signals?.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-gray-400">
            No patterns detected in current scan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b text-[10px] text-gray-400 font-semibold bg-gray-50">
                  <th className="px-2 py-2 w-6">#</th>
                  <th className="px-2 py-2">Symbol</th>
                  <th className="px-2 py-2">Pattern</th>
                  <th className="px-2 py-2">Stage</th>
                  <th className="px-2 py-2 text-center">Conf.</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-2 py-2 text-right">Drop%</th>
                  <th className="px-2 py-2 text-right">Vol ×</th>
                  <th className="px-2 py-2">Entry Zone</th>
                  <th className="px-2 py-2">Stop Loss</th>
                  <th className="px-2 py-2">Target</th>
                </tr>
              </thead>
              <tbody>
                {data.signals.map((s, i) => (
                  <tr key={`${s.symbol}-${s.pattern}-${i}`}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-2 text-gray-300 text-[10px]">{i + 1}</td>
                    <td className="px-2 py-2 font-bold text-[10px] font-mono text-indigo-700">
                      {s.symbol?.replace(".NS", "") ?? "-"}
                    </td>
                    <td className="px-2 py-2">
                      <PatternBadge pattern={s.pattern} />
                    </td>
                    <td className="px-2 py-2">
                      <StageBadge stage={s.stage} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${CONF_COLOR[s.confidence] || "bg-gray-200 text-gray-600"}`}>
                        {s.confidence}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-gray-800">
                      ₹{s.current_price?.toFixed(0) ?? "-"}
                    </td>
                    <td className="px-2 py-2 text-right text-red-600 font-bold">
                      -{s.drop_from_top?.toFixed(1) ?? "0"}%
                    </td>
                    <td className="px-2 py-2 text-right text-gray-600">
                      {s.volume_ratio?.toFixed(2) ?? "-"}x
                    </td>
                    <td className="px-2 py-2 text-gray-600 text-[10px]">{s.entry_zone ?? "-"}</td>
                    <td className="px-2 py-2 text-red-500 text-[10px] font-semibold">{s.stop_loss ?? "-"}</td>
                    <td className="px-2 py-2 text-green-600 text-[10px] font-semibold">{s.target ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Legend */}
      {!isBuilding && (
        <div className="mt-3 flex flex-wrap gap-4 text-[9px] text-gray-400 border-t pt-3">
          <span>Bear Flag — prior run-up → consolidation → breakdown below flag low</span>
          <span>Dist. Channel — distribution spike top → lower highs/lows below EMAs</span>
          <span>EMA Cross — first close below EMA-51 after sustained uptrend</span>
        </div>
      )}
    </section>
  );
}
