import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API_BASE = "/api";
const LIMIT = 50;

const SCORE_COLOR = (val) => {
  if (val === 2) return "bg-green-100 text-green-800 border border-green-200";
  if (val === 1) return "bg-amber-50 text-amber-800 border border-amber-200";
  return "bg-red-50 text-red-700 border border-red-200";
};

const SIGNAL_COLOR = {
  "STRONG BUY": "bg-emerald-600 text-white",
  BUY: "bg-green-500 text-white",
  WATCH: "bg-amber-400 text-white",
  AVOID: "bg-red-500 text-white",
};

export function FinalRankingTable() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const timerRef = React.useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ["screener_rank", page, filter, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page,
        limit: LIMIT,
        sort: "score",
        order: "desc",
        filter,
        search,
      });
      return (await axios.get(`${API_BASE}/screener?${params}`)).data;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) => query.state.data?.status === "building" ? 5000 : false,
  });

  const handleSearch = (e) => {
    const v = e.target.value;
    setSearchInput(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setSearch(v); setPage(1); }, 400);
  };

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
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-[16px] font-bold text-brand-primary">
          Final Probability Ranking
          {data?.status === "ready" && (
            <span className="ml-2 text-gray-400 font-normal text-[11px]">
              ({data.total?.toLocaleString()} stocks)
            </span>
          )}
        </h2>
        {data?.status === "ready" && (
          <div className="flex gap-2">
            <input
              className="border rounded px-2 py-1 text-[11px] w-40"
              placeholder="Search..."
              value={searchInput}
              onChange={handleSearch}
            />
            <select
              className="border rounded px-2 py-1 text-[11px]"
              value={filter}
              onChange={e => { setFilter(e.target.value); setPage(1); }}
            >
              <option value="all">All</option>
              <option value="buy">Buy signals</option>
              <option value="watch">Watch</option>
              <option value="avoid">Avoid</option>
            </select>
          </div>
        )}
      </div>

      {/* Building state */}
      {(!data || data.status === "building") && (
        <div className="mb-4">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
            <span>Calculating scores for all NSE stocks...</span>
            <span>{data?.progress ?? 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded transition-all duration-500"
              style={{ width: `${data?.progress ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {isLoading && data?.status !== "building" && (
        <div className="py-4 text-center text-sm text-gray-400">Loading rankings...</div>
      )}

      {data?.status === "ready" && (
        <>
          <div className="overflow-x-auto text-[11px]">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-gray-500 font-semibold bg-gray-50">
                  <th className="p-2 w-8">#</th>
                  <th className="p-2">Ticker</th>
                  <th className="p-2">Name</th>
                  <th className="p-2 text-center">Macro</th>
                  <th className="p-2 text-center">Sector</th>
                  <th className="p-2 text-center">Event</th>
                  <th className="p-2 text-center">Seasonal</th>
                  <th className="p-2 text-center">Statistical</th>
                  <th className="p-2 text-center">Technical</th>
                  <th className="p-2 text-center font-bold">Total</th>
                  <th className="p-2 text-center">Signal</th>
                </tr>
              </thead>
              <tbody>
                {data.stocks.map((s, i) => {
                  const sc = s.probability_scores || {};
                  return (
                    <tr key={s.ticker} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 text-gray-400">{(data.page - 1) * LIMIT + i + 1}</td>
                      <td className="p-2 font-bold text-brand-primary font-mono text-[10px]">
                        {s.ticker.replace(".NS", "")}
                      </td>
                      <td className="p-2 text-gray-700 max-w-[140px] truncate">{s.name}</td>
                      {["macro", "sector", "event", "seasonal", "statistical", "technical"].map(k => (
                        <td key={k} className="p-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SCORE_COLOR(sc[k])}`}>
                            {sc[k] ?? "-"}
                          </span>
                        </td>
                      ))}
                      <td className="p-2 text-center font-bold text-[13px]">{s.final_score}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${SIGNAL_COLOR[s.final_signal] || "bg-gray-200 text-gray-700"}`}>
                          {s.final_signal}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.total_pages > 1 && (
            <div className="flex justify-between items-center mt-3 text-[11px] text-gray-600">
              <span>Page {data.page} of {data.total_pages} · {data.total.toLocaleString()} results</span>
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
