import React, { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Badge } from "../shared/Badge";
import { EMATimingBadge } from "../shared/EMATimingBadge";

const API_BASE = "/api";
const LIMIT = 50;

const SIGNAL_STYLE = {
  "STRONG BUY": "bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold",
  BUY: "bg-green-50 text-green-800 border border-green-200 font-bold",
  WATCH: "bg-amber-50 text-amber-800 border border-amber-200",
  AVOID: "bg-red-50 text-red-700 border border-red-200",
};

export function StockScreener() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("score");
  const [order, setOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimer = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ["screener", page, filter, sort, order, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: LIMIT, filter, sort, order, search });
      return (await axios.get(`${API_BASE}/screener?${params}`)).data;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) => query.state.data?.status === "building" ? 5000 : false,
  });

  const handleSearch = (e) => {
    const v = e.target.value;
    setSearchInput(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(v); setPage(1); }, 400);
  };

  const setFilterReset = (v) => { setFilter(v); setPage(1); };
  const setSortReset = (v) => { setSort(v); setPage(1); };
  const toggleOrder = () => { setOrder(o => o === "desc" ? "asc" : "desc"); setPage(1); };

  const renderPages = () => {
    if (!data || data.total_pages <= 1) return null;
    const total = data.total_pages;
    const cur = data.page;
    const start = Math.max(1, cur - 2);
    const end = Math.min(total, start + 4);
    const pages = [];
    for (let p = start; p <= end; p++) pages.push(p);
    return pages.map(p => (
      <button
        key={p}
        onClick={() => setPage(p)}
        className={`px-2 py-1 border rounded text-[11px] ${p === cur ? "bg-blue-500 text-white border-blue-500" : "bg-white hover:bg-gray-50"}`}
      >
        {p}
      </button>
    ));
  };

  return (
    <section className="bg-white border rounded p-4 shadow-sm w-full mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-[16px] font-bold text-brand-primary">
          Stock Universe Screener
          {data?.status === "ready" && (
            <span className="ml-2 text-gray-400 font-normal text-[11px]">
              ({data.total?.toLocaleString()} stocks)
            </span>
          )}
        </h2>
        {data?.status === "ready" && data.summary && (
          <div className="flex gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 px-2 py-0.5 rounded font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              {data.summary.buy_count} buy
            </span>
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              {data.summary.watch_count} watch
            </span>
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 px-2 py-0.5 rounded font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              {data.summary.best_timing_count} near EMA
            </span>
          </div>
        )}
      </div>

      {/* Building state */}
      {(!data || data.status === "building") && (
        <div className="mb-4">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
            <span>Scoring all NSE stocks in batches...</span>
            <span>{data?.progress ?? 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded transition-all duration-500"
              style={{ width: `${data?.progress ?? 0}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Downloading 3-month price data for Nifty 500 stocks. Takes 1–2 minutes on first load.
          </p>
        </div>
      )}

      {/* Controls — shown when ready or loading page */}
      {(data?.status === "ready" || isLoading) && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <input
            className="border rounded px-2 py-1 text-[11px] w-44"
            placeholder="Search name or ticker..."
            value={searchInput}
            onChange={handleSearch}
          />
          <select
            className="border rounded px-2 py-1 text-[11px]"
            value={filter}
            onChange={e => setFilterReset(e.target.value)}
          >
            <option value="all">All stocks</option>
            <option value="buy">Buy signals</option>
            <option value="best_timing">Near EMA</option>
            <option value="watch">Watch</option>
            <option value="avoid">Avoid</option>
          </select>
          <select
            className="border rounded px-2 py-1 text-[11px]"
            value={sort}
            onChange={e => setSortReset(e.target.value)}
          >
            <option value="score">Sort: Score</option>
            <option value="return">Sort: Change%</option>
            <option value="ema">Sort: EMA Signal</option>
            <option value="name">Sort: Name</option>
          </select>
          <button
            className="border rounded px-2 py-1 text-[11px] bg-gray-50 hover:bg-gray-100 font-bold"
            onClick={toggleOrder}
          >
            {order === "desc" ? "↓ DESC" : "↑ ASC"}
          </button>
        </div>
      )}

      {/* Table */}
      {isLoading && data?.status !== "building" ? (
        <div className="py-6 text-center text-sm text-gray-400">Loading...</div>
      ) : data?.status === "ready" && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] text-left border-collapse">
              <thead>
                <tr className="border-b text-gray-500 font-semibold bg-gray-50">
                  <th className="p-2 w-8">#</th>
                  <th className="p-2">Ticker</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Sector</th>
                  <th className="p-2 text-right">Price</th>
                  <th className="p-2 text-right">Change%</th>
                  <th className="p-2">Zone</th>
                  <th className="p-2">EMA Timing</th>
                  <th className="p-2 text-center">Score</th>
                  <th className="p-2 text-center">Signal</th>
                </tr>
              </thead>
              <tbody>
                {data.stocks.map((s, i) => (
                  <tr key={s.ticker} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-2 text-gray-400">{(data.page - 1) * LIMIT + i + 1}</td>
                    <td className="p-2 font-bold text-brand-primary font-mono text-[10px]">
                      {s.ticker.replace(".NS", "")}
                    </td>
                    <td className="p-2 text-gray-700 max-w-[160px] truncate">{s.name}</td>
                    <td className="p-2 text-gray-500">{s.sector}</td>
                    <td className="p-2 font-semibold text-right">₹{s.price?.toFixed(2)}</td>
                    <td className={`p-2 font-bold text-right ${s.change_pct > 0 ? "text-green-600" : "text-red-600"}`}>
                      {s.change_pct > 0 ? "+" : ""}{(s.change_pct * 100).toFixed(2)}%
                    </td>
                    <td className="p-2 text-gray-600">{s.zone}</td>
                    <td className="p-2">
                      <EMATimingBadge signal={s.ema_signal} />
                    </td>
                    <td className="p-2 text-center font-bold">{s.score}/6</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${SIGNAL_STYLE[s.final_signal] || "bg-gray-100 text-gray-600"}`}>
                        {s.final_signal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.total_pages > 1 && (
            <div className="flex justify-between items-center mt-3 text-[11px] text-gray-600">
              <span>
                Page {data.page} of {data.total_pages} · {data.total.toLocaleString()} results
              </span>
              <div className="flex gap-1">
                <button
                  disabled={data.page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
                >
                  Prev
                </button>
                {renderPages()}
                <button
                  disabled={data.page >= data.total_pages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
