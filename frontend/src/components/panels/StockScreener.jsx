import React from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Badge } from "../shared/Badge";
import { EMATimingBadge } from "../shared/EMATimingBadge";

const API_BASE = "/api";

export function StockScreener() {
  const [filter, setFilter] = React.useState("All");

  const { data: screens, isLoading } = useQuery({
    queryKey: ["screener"],
    queryFn: async () => (await axios.get(`${API_BASE}/screener`)).data,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 min
  });

  const displayData = React.useMemo(() => {
    if (!Array.isArray(screens)) return [];
    if (filter === "Near 21 EMA ✅") {
      return screens.filter((s) => s.ema_signal === "BEST TIMING");
    }
    if (filter === "Demand Zone") {
      return screens.filter(
        (s) => s.zone === "Demand" || s.zone === "Breakout",
      );
    }
    if (filter === "High Score") {
      return screens.filter((s) => s.score >= 4);
    }
    return screens;
  }, [screens, filter]);

  const topEmaStocks = Array.isArray(screens)
    ? screens.filter((s) => s.ema_signal === "BEST TIMING").slice(0, 5)
    : [];

  return (
    <section className="bg-white border rounded p-4 shadow-sm w-full mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-[16px] font-bold text-brand-primary">
          Stock Universe Screener
        </h2>
        <div className="flex gap-2">
          {["All", "Near 21 EMA ✅", "Demand Zone", "High Score"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-bold rounded border ${filter === f ? "bg-brand-primary text-white border-brand-primary" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {topEmaStocks.length > 0 && filter === "All" && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
          <h3 className="text-xs font-bold text-green-800 mb-2">
            🎯 Best Entry Timing Right Now (Within 1% of 21 EMA)
          </h3>
          <div className="flex flex-wrap gap-2">
            {topEmaStocks.map((s) => (
              <span
                key={s.ticker}
                className="px-2 py-1 bg-white border border-green-300 text-green-800 text-[11px] font-bold rounded-full"
              >
                {s.ticker} ✅
              </span>
            ))}
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="py-4 text-center">Loading Screener...</div>
      ) : (
        <div className="overflow-x-auto text-[12px]">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b text-gray-500 font-semibold bg-gray-50">
                <th className="p-2">Ticker</th>
                <th className="p-2">Name</th>
                <th className="p-2">Sector</th>
                <th className="p-2">Price</th>
                <th className="p-2">% Change</th>
                <th className="p-2">Zone</th>
                <th className="p-2">21 EMA</th>
                <th className="p-2">Timing</th>
                <th className="p-2">Score</th>
                <th className="p-2">Shortlist</th>
              </tr>
            </thead>
            <tbody>
              {displayData.length > 0 ? (
                displayData.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-bold text-brand-primary">
                      {s.ticker}
                    </td>
                    <td className="p-2 text-gray-700">{s.name}</td>
                    <td className="p-2 text-gray-500">{s.sector}</td>
                    <td className="p-2 font-semibold">
                      ₹{s.price?.toFixed(2)}
                    </td>
                    <td
                      className={`p-2 font-bold ${s.change_pct > 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {(s.change_pct * 100)?.toFixed(2)}%
                    </td>
                    <td className="p-2">{s.zone}</td>
                    <td className="p-2 text-gray-600">
                      {s.ema21 ? `₹${s.ema21}` : "-"}
                    </td>
                    <td className="p-2">
                      <EMATimingBadge signal={s.ema_signal} />
                    </td>
                    <td className="p-2 font-bold text-brand-primary">
                      {s.score}/6
                    </td>
                    <td className="p-2">
                      {s.shortlist ? (
                        <Badge label="BUY TODAY" />
                      ) : (
                        <Badge label="WATCHLIST" />
                      )}
                    </td>
                  </tr>
                ))
              ) : screens ? (
                <tr>
                  <td colSpan="8" className="p-4 text-center text-red-500">
                    Failed to load screener data.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
