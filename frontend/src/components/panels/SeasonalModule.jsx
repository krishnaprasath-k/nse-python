import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import React from "react";

export function SeasonalModule({ compact = false }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["seasonal", "market-top"],
    queryFn: async () =>
      (await axios.get(`/api/seasonal/market/current-month-top`)).data,
    staleTime: 60 * 60 * 1000,
  });

  if (isLoading)
    return (
      <div className="p-4 text-center text-sm bg-white border rounded shadow-sm h-full">
        <div className="animate-pulse text-gray-400">
          Loading {new Date().toLocaleString("default", { month: "long" })} performers...
        </div>
      </div>
    );

  if (isError || !data || !data.current_month) return null;

  const { current_month, top_performers, worst_performers, total_analyzed } = data;

  // ── Compact sidebar mode (used alongside NewsPanel) ─────────────────────────
  if (compact) {
    return (
      <section className="bg-white border rounded p-4 shadow-sm flex flex-col gap-4 h-full">
        <div className="border-b pb-2">
          <h2 className="text-[14px] font-bold text-brand-primary">
            {current_month} Performers
          </h2>
          <p className="text-[10px] text-gray-400 mt-0.5">
            10yr win-rate analysis · {total_analyzed} stocks
          </p>
        </div>

        {/* Top performers */}
        <div>
          <h3 className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200 mb-2">
            ↑ Historically Bullish (≥70% Win Rate)
          </h3>
          <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
            {top_performers?.length > 0 ? (
              top_performers.map((stock) => (
                <div
                  key={stock.ticker}
                  className="flex justify-between items-center px-2 py-1.5 border rounded hover:bg-green-50/40 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-[11px] text-brand-primary leading-tight">
                      {stock.ticker.replace(".NS", "")}
                    </div>
                    <div className="text-[9px] text-gray-400 truncate max-w-[100px]">
                      {stock.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-bold text-green-600">
                      {stock.win_rate}%
                    </div>
                    <div className="text-[9px] text-gray-500">
                      avg {stock.avg_return > 0 ? "+" : ""}{stock.avg_return}%
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-[11px] text-gray-400 text-center py-2">
                No top performers found
              </div>
            )}
          </div>
        </div>

        {/* Worst performers */}
        <div>
          <h3 className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 mb-2">
            ↓ Historically Bearish (≤30% Win Rate)
          </h3>
          <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
            {worst_performers?.length > 0 ? (
              worst_performers.map((stock) => (
                <div
                  key={stock.ticker}
                  className="flex justify-between items-center px-2 py-1.5 border rounded hover:bg-red-50/40 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-[11px] text-brand-primary leading-tight">
                      {stock.ticker.replace(".NS", "")}
                    </div>
                    <div className="text-[9px] text-gray-400 truncate max-w-[100px]">
                      {stock.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-bold text-red-600">
                      {stock.win_rate}%
                    </div>
                    <div className="text-[9px] text-gray-500">
                      avg {stock.avg_return}%
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-[11px] text-gray-400 text-center py-2">
                No weak performers found
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── Full-width mode (legacy standalone) ────────────────────────────────────
  return (
    <section className="col-span-1 lg:col-span-2 bg-white border rounded p-4 shadow-sm">
      <div className="flex justify-between items-center mb-4 border-b pb-3">
        <div>
          <h2 className="text-[16px] font-bold text-brand-primary">
            {current_month} Historical Performance (Last 10 Years)
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Top NIFTY 200 stocks that historically performed well or poorly during {current_month}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h3 className="text-[13px] font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded border border-green-200">
            Highly Positive in {current_month} (≥ 70% Win Rate)
          </h3>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {top_performers?.length > 0 ? (
              top_performers.map((stock) => (
                <div key={stock.ticker} className="flex justify-between items-center p-2 border rounded hover:bg-gray-50">
                  <div className="flex flex-col">
                    <span className="font-bold text-[13px] text-brand-primary">
                      {stock.name || stock.ticker.replace(".NS", "")}
                    </span>
                    <span className="text-[10px] text-gray-500">{stock.ticker.replace(".NS", "")}</span>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className="text-[12px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                      {stock.win_rate}% Win Rate
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5">
                      Avg Return: <span className={stock.avg_return > 0 ? "text-green-600 font-semibold" : ""}>+{stock.avg_return}%</span>
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-400 text-sm p-2 text-center">No highly positive stocks found.</div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-[13px] font-bold text-red-700 bg-red-50 px-3 py-1.5 rounded border border-red-200">
            Highly Negative in {current_month} (≤ 30% Win Rate)
          </h3>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {worst_performers?.length > 0 ? (
              worst_performers.map((stock) => (
                <div key={stock.ticker} className="flex justify-between items-center p-2 border rounded hover:bg-gray-50">
                  <div className="flex flex-col">
                    <span className="font-bold text-[13px] text-brand-primary">
                      {stock.name || stock.ticker.replace(".NS", "")}
                    </span>
                    <span className="text-[10px] text-gray-500">{stock.ticker.replace(".NS", "")}</span>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className="text-[12px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                      {stock.win_rate}% Win Rate
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5">
                      Avg Return: <span className={stock.avg_return < 0 ? "text-red-600 font-semibold" : ""}>{stock.avg_return}%</span>
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-400 text-sm p-2 text-center">No highly negative stocks found.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
