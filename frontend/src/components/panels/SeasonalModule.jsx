import React, { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const LIMIT = 50;

export function SeasonalModule({ ticker }) {
  const { data, isLoading } = useQuery({
    queryKey: ["seasonal", ticker],
    queryFn: async () => (await axios.get(`/api/seasonal/${ticker}`)).data,
    staleTime: 60 * 60 * 1000,
  });

  // Universe performance state
  const [univPage, setUnivPage] = useState(1);
  const [univFilter, setUnivFilter] = useState("all");
  const [univSort, setUnivSort] = useState("return");
  const [univOrder, setUnivOrder] = useState("desc");
  const [univSearch, setUnivSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimer = useRef(null);

  const { data: prevYear } = useQuery({
    queryKey: ["seasonal_prev_year", univPage, univFilter, univSearch, univSort, univOrder],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: univPage,
        limit: LIMIT,
        filter: univFilter,
        search: univSearch,
        sort: univSort,
        order: univOrder,
      });
      return (await axios.get(`/api/seasonal/market/previous-year?${params}`)).data;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const d = query.state.data;
      return d?.status === "building" ? 5000 : false;
    },
  });

  if (isLoading)
    return (
      <div className="p-4 text-center text-sm w-full">
        Loading seasonal data...
      </div>
    );
  if (!data || !data.monthly_pattern) return null;

  const {
    monthly_pattern,
    current_month,
    current_month_detail,
    pre_result_pattern,
    weekly_pattern,
  } = data;

  const currentMonthData = monthly_pattern.find((m) => m.is_current);

  const getDayColor = (avg) => {
    if (avg > 0) return "bg-green-100 text-green-800 border-green-300";
    if (avg < 0) return "bg-red-100 text-red-800 border-red-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setUnivSearch(val);
      setUnivPage(1);
    }, 400);
  };

  // Pagination helpers
  const renderPageButtons = () => {
    if (!prevYear || prevYear.total_pages <= 1) return null;
    const total = prevYear.total_pages;
    const cur = prevYear.page;
    const start = Math.max(1, cur - 2);
    const end = Math.min(total, start + 4);
    const pages = [];
    for (let p = start; p <= end; p++) pages.push(p);
    return pages.map((p) => (
      <button
        key={p}
        onClick={() => setUnivPage(p)}
        className={`px-2 py-1 border rounded text-[11px] ${
          p === cur ? "bg-blue-500 text-white border-blue-500" : "bg-white hover:bg-gray-50"
        }`}
      >
        {p}
      </button>
    ));
  };

  return (
    <section className="col-span-1 lg:col-span-2 bg-white border rounded p-4 shadow-sm mt-6">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h2 className="text-[16px] font-bold text-brand-primary">
          Seasonal Impact Analysis — Last 10 Years
        </h2>
        {currentMonthData && (
          <span
            className={`inline-flex items-center gap-1.5 text-[12px] font-bold px-2 py-1 rounded border ${
              currentMonthData.signal === "RISING"
                ? "bg-green-50 text-green-800 border-green-300"
                : currentMonthData.signal === "FALLING"
                  ? "bg-red-50 text-red-800 border-red-300"
                  : "bg-amber-50 text-amber-800 border-amber-300"
            }`}
          >
            <span className={`w-2 h-2 rounded-full inline-block ${
              currentMonthData.signal === "RISING" ? "bg-green-500" :
              currentMonthData.signal === "FALLING" ? "bg-red-500" : "bg-amber-400"
            }`} />
            {currentMonthData.month.toUpperCase()} — {currentMonthData.signal}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthly_pattern}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val, name) =>
                    name === "avg_return"
                      ? [`${val}%`, "Avg Return"]
                      : [val, name]
                  }
                />
                <Bar dataKey="avg_return">
                  {monthly_pattern.map((entry, index) => {
                    let fill = "#fbbf24";
                    if (entry.avg_return > 0 && entry.win_rate >= 60) fill = "#16a34a";
                    if (entry.avg_return < 0 && entry.win_rate <= 40) fill = "#dc2626";
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={fill}
                        stroke={entry.is_current ? "#2563eb" : "none"}
                        strokeWidth={entry.is_current ? 3 : 0}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-between flex-wrap gap-2 text-[10px] text-center">
            {monthly_pattern.map((m, i) => (
              <div key={i} className="flex flex-col items-center min-w-[30px]">
                <span className="font-bold text-gray-500">{m.win_rate}%</span>
                {m.is_current && (
                  <span className="text-blue-600 font-bold bg-blue-50 px-1 mt-1 rounded">
                    ← CURRENT
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 border rounded p-3">
            <h3 className="text-[14px] font-bold text-brand-primary mb-2">
              Pre-Result Pattern (10 days before earnings)
            </h3>
            <div className="flex gap-4 items-center">
              <div className="text-center bg-gray-50 p-2 rounded flex-1">
                <div className="text-[20px] font-extrabold">
                  {pre_result_pattern?.win_rate}%
                </div>
                <div className="text-[11px] text-gray-500 uppercase tracking-widest font-bold mt-1">
                  Win Rate
                </div>
              </div>
              <div className="text-center bg-gray-50 p-2 rounded flex-1">
                <div
                  className={`text-[20px] font-extrabold ${pre_result_pattern?.avg_return > 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {pre_result_pattern?.avg_return > 0 ? "+" : ""}
                  {pre_result_pattern?.avg_return}%
                </div>
                <div className="text-[11px] text-gray-500 uppercase tracking-widest font-bold mt-1">
                  Avg Return
                </div>
              </div>
              <div className="flex-1 text-center">
                <span
                  className={`text-[12px] font-bold px-3 py-1.5 rounded-full ${
                    pre_result_pattern?.signal.includes("BUY")
                      ? "bg-green-100 text-green-800"
                      : pre_result_pattern?.signal.includes("AVOID")
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {pre_result_pattern?.signal}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded p-3 bg-gray-50">
            <h3 className="text-[13px] font-bold text-brand-primary mb-2 border-b pb-1">
              {current_month} Performance — Year by Year ({ticker})
            </h3>
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="py-1">Year</th>
                  <th className="py-1">Return %</th>
                  <th className="py-1">Result</th>
                </tr>
              </thead>
              <tbody>
                {current_month_detail?.slice(0, 10).map((y, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="py-1 font-bold">{y.year}</td>
                    <td className={`py-1 font-bold ${y.return > 0 ? "text-green-600" : "text-red-600"}`}>
                      {y.return > 0 ? "+" : ""}{y.return}%
                    </td>
                    <td className="py-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${y.result === "UP" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                        {y.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border rounded p-3">
            <h3 className="text-[13px] font-bold text-brand-primary mb-2">
              Weekly Pattern Edge
            </h3>
            <div className="flex flex-col gap-1.5">
              {weekly_pattern?.map((day, i) => (
                <div
                  key={i}
                  className={`flex justify-between p-1 px-2 rounded border text-[11px] font-bold ${getDayColor(day.avg_return)}`}
                >
                  <span>{day.day}</span>
                  <span className="opacity-80 font-normal">{day.win_rate}% win</span>
                  <span>
                    {day.avg_return > 0 ? "+" : ""}{day.avg_return}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Universe Performance ── */}
      <div className="mt-6 border-t pt-4">
        {/* Building state */}
        {(!prevYear || prevYear.status === "building") && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[14px] font-bold text-brand-primary">
                Universe Performance — Building...
              </h3>
              <span className="text-[11px] text-gray-500">
                {prevYear?.progress ?? 0}% complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded h-2 mb-2">
              <div
                className="bg-blue-500 h-2 rounded transition-all duration-500"
                style={{ width: `${prevYear?.progress ?? 0}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Downloading price data for all ~1800 NSE stocks in batches. This runs once per day and takes 2–3 minutes.
            </p>
          </div>
        )}

        {/* Ready state */}
        {prevYear?.status === "ready" && (
          <div>
            {/* Header + summary */}
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <h3 className="text-[14px] font-bold text-brand-primary">
                NSE Universe Performance — {prevYear.year}
                <span className="ml-2 text-gray-400 font-normal text-[11px]">
                  ({prevYear.total.toLocaleString()} stocks)
                </span>
              </h3>
              <div className="flex gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 px-2 py-0.5 rounded font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  {prevYear.summary.positive_count} up
                </span>
                <span className="inline-flex items-center gap-1 bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 rounded font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                  {prevYear.summary.negative_count} down
                </span>
                <span className="bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded font-bold">
                  avg {prevYear.summary.avg_return}%
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2 mb-3 flex-wrap">
              <input
                className="border rounded px-2 py-1 text-[11px] w-44"
                placeholder="Search name or ticker..."
                value={searchInput}
                onChange={handleSearchChange}
              />
              <select
                className="border rounded px-2 py-1 text-[11px]"
                value={univFilter}
                onChange={(e) => { setUnivFilter(e.target.value); setUnivPage(1); }}
              >
                <option value="all">All stocks</option>
                <option value="positive">Gainers only</option>
                <option value="negative">Losers only</option>
              </select>
              <select
                className="border rounded px-2 py-1 text-[11px]"
                value={univSort}
                onChange={(e) => { setUnivSort(e.target.value); setUnivPage(1); }}
              >
                <option value="return">Sort: Return</option>
                <option value="name">Sort: Name</option>
                <option value="sector">Sort: Sector</option>
              </select>
              <button
                className="border rounded px-2 py-1 text-[11px] bg-gray-50 hover:bg-gray-100 font-bold"
                onClick={() => { setUnivOrder((o) => (o === "desc" ? "asc" : "desc")); setUnivPage(1); }}
              >
                {univOrder === "desc" ? "↓ DESC" : "↑ ASC"}
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="text-gray-500 border-b text-left bg-gray-50">
                    <th className="py-1.5 px-2 w-8">#</th>
                    <th className="py-1.5 px-2">Stock</th>
                    <th className="py-1.5 px-2">Ticker</th>
                    <th className="py-1.5 px-2">Sector</th>
                    <th className="py-1.5 px-2 text-right">Return %</th>
                  </tr>
                </thead>
                <tbody>
                  {prevYear.stocks.map((s, i) => (
                    <tr key={s.ticker} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-1 px-2 text-gray-400">
                        {(prevYear.page - 1) * LIMIT + i + 1}
                      </td>
                      <td className="py-1 px-2 font-bold">{s.name}</td>
                      <td className="py-1 px-2 text-gray-500 font-mono text-[10px]">
                        {s.ticker.replace(".NS", "")}
                      </td>
                      <td className="py-1 px-2 text-gray-500">{s.sector}</td>
                      <td
                        className={`py-1 px-2 font-bold text-right ${
                          s.is_positive ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {s.is_positive ? "+" : ""}{s.annual_return}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {prevYear.total_pages > 1 && (
              <div className="flex justify-between items-center mt-3 text-[11px] text-gray-600">
                <span>
                  Page {prevYear.page} of {prevYear.total_pages} &nbsp;·&nbsp; {prevYear.total.toLocaleString()} results
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={prevYear.page <= 1}
                    onClick={() => setUnivPage((p) => p - 1)}
                    className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
                  >
                    ← Prev
                  </button>
                  {renderPageButtons()}
                  <button
                    disabled={prevYear.page >= prevYear.total_pages}
                    onClick={() => setUnivPage((p) => p + 1)}
                    className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
