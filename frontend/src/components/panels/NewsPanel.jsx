import React, { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { NewsImpactChips } from "../shared/NewsImpactChips";

const API_BASE = "/api";

const CATEGORY_BORDER = {
  INDIA_MARKETS: "border-t-blue-500",
  INDIA_ECONOMY: "border-t-green-500",
  INDIA_COMPANIES: "border-t-teal-500",
  GLOBAL_MACRO: "border-t-orange-500",
  COMMODITIES: "border-t-yellow-500",
  FOREX: "border-t-pink-500",
  GOVT_POLICY: "border-t-red-500",
  INDIA_INDUSTRY: "border-t-purple-500",
  INDIA_BUSINESS: "border-t-indigo-500",
};

const CATEGORY_BADGE = {
  INDIA_MARKETS: "bg-blue-50 text-blue-700 border-blue-200",
  INDIA_ECONOMY: "bg-green-50 text-green-700 border-green-200",
  INDIA_COMPANIES: "bg-teal-50 text-teal-700 border-teal-200",
  GLOBAL_MACRO: "bg-orange-50 text-orange-700 border-orange-200",
  COMMODITIES: "bg-yellow-50 text-yellow-700 border-yellow-200",
  FOREX: "bg-pink-50 text-pink-700 border-pink-200",
  GOVT_POLICY: "bg-red-50 text-red-700 border-red-200",
  INDIA_INDUSTRY: "bg-purple-50 text-purple-700 border-purple-200",
  INDIA_BUSINESS: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const SOURCE_DOT = {
  blue: "bg-blue-500", green: "bg-green-500", teal: "bg-teal-500",
  orange: "bg-orange-500", yellow: "bg-yellow-500", pink: "bg-pink-500",
  red: "bg-red-500", purple: "bg-purple-500", indigo: "bg-indigo-500",
  gray: "bg-gray-400",
};

function timeAgo(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  } catch { return ""; }
}

function CategoryChip({ label, category, selected, onClick }) {
  const badgeClass = selected
    ? CATEGORY_BADGE[category] || "bg-gray-100 text-gray-700 border-gray-200"
    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100";
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all ${badgeClass} ${selected ? "ring-1 ring-offset-0" : ""}`}
    >
      {label}
    </button>
  );
}

// ─── Horizontal News Card ─────────────────────────────────────────────────────
function NewsCard({ item, onStockClick }) {
  const borderClass = CATEGORY_BORDER[item.category] || "border-t-gray-300";
  const dotClass = SOURCE_DOT[item.category_color] || SOURCE_DOT.gray;

  return (
    <div
      className={`flex-none w-[280px] border border-t-4 ${borderClass} rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2`}
    >
      {/* Source + time */}
      <div className="flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`} />
          {item.source}
        </span>
        {item.published && (
          <span className="text-[10px] text-gray-400 font-medium">
            {timeAgo(item.published)}
          </span>
        )}
      </div>

      {/* Category badge */}
      <span
        className={`self-start text-[9px] font-bold px-2 py-0.5 rounded border ${CATEGORY_BADGE[item.category] || "bg-gray-50 text-gray-600 border-gray-200"}`}
      >
        {item.category_label}
      </span>

      {/* Title */}
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-brand-link hover:underline text-[12px] leading-snug line-clamp-3 flex-1"
      >
        {item.title}
      </a>

      {/* AI Note */}
      {item.ai_note && (
        <p className="text-[10px] text-gray-500 bg-blue-50/60 px-2 py-1 rounded border border-blue-100/50 line-clamp-2">
          <span className="font-bold text-blue-800 uppercase tracking-wider text-[9px]">AI</span>
          : {item.ai_note}
        </p>
      )}

      {/* Impact chips */}
      {item.impact && (
        <div className="mt-auto pt-1">
          <NewsImpactChips impact={item.impact} onStockClick={onStockClick} />
        </div>
      )}
    </div>
  );
}

// ─── Main NewsPanel ───────────────────────────────────────────────────────────
export function NewsPanel({ onStockClick }) {
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeSource, setActiveSource] = useState(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["news-categories"],
    queryFn: async () => (await axios.get(`${API_BASE}/news/categories`)).data,
    staleTime: 60 * 60 * 1000,
  });

  const { data: sources = [] } = useQuery({
    queryKey: ["news-sources"],
    queryFn: async () => (await axios.get(`${API_BASE}/news/sources`)).data,
    staleTime: 60 * 60 * 1000,
  });

  const { data: newsList, isLoading, isError, refetch } = useQuery({
    queryKey: ["news", activeCategory, activeSource],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: 50 });
      if (activeCategory) params.set("category", activeCategory);
      if (activeSource) params.set("source", activeSource);
      return (await axios.get(`${API_BASE}/news?${params}`)).data;
    },
    staleTime: 8 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const handleCategoryClick = useCallback((cat) => {
    setActiveCategory((prev) => (prev === cat ? null : cat));
    setActiveSource(null);
  }, []);

  // In-focus stocks derived from news
  const affectedStocks = useMemo(() => {
    if (!newsList || !Array.isArray(newsList)) return [];
    const stockMap = new Map();
    newsList.forEach((item) => {
      item.impact?.impacted_stocks?.forEach((s) => {
        if (!stockMap.has(s.ticker)) {
          stockMap.set(s.ticker, { ...s, count: 1 });
        } else {
          stockMap.get(s.ticker).count += 1;
        }
      });
    });
    return Array.from(stockMap.values()).sort((a, b) => b.count - a.count);
  }, [newsList]);

  return (
    <section className="bg-white border rounded p-4 shadow-sm flex flex-col gap-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-[15px] font-bold text-brand-primary">Live Market News</h2>
        <div className="flex items-center gap-2">
          {(activeCategory || activeSource) && (
            <button
              onClick={() => { setActiveCategory(null); setActiveSource(null); }}
              className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded font-medium"
            >
              ✕ Clear
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="text-[10px] px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded font-medium"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Source + Category filters in one row */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
        {sources.length > 0 && (
          <select
            value={activeSource || ""}
            onChange={(e) => setActiveSource(e.target.value || null)}
            className="flex-none text-[10px] px-2 py-1 border border-gray-200 rounded-lg bg-white text-gray-600 font-semibold cursor-pointer outline-none hover:border-gray-300"
          >
            <option value="">All Sources</option>
            {sources.map((s) => (
              <option key={s.source} value={s.source}>{s.source}</option>
            ))}
          </select>
        )}
        <CategoryChip label="All" category={null} selected={!activeCategory} onClick={() => handleCategoryClick(null)} />
        {categories.map((c) => (
          <CategoryChip
            key={c.category}
            label={c.label}
            category={c.category}
            selected={activeCategory === c.category}
            onClick={() => handleCategoryClick(c.category)}
          />
        ))}
      </div>

      {/* In Focus ticker bar */}
      {affectedStocks.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 px-2 bg-blue-50 border border-blue-100 rounded-md">
          <span className="flex-none text-[9px] font-bold text-blue-700 uppercase tracking-wider">In Focus</span>
          {affectedStocks.slice(0, 20).map((s) => (
            <span
              key={s.ticker}
              onClick={() => onStockClick && onStockClick(s.ticker + ".NS")}
              title={s.name || s.ticker}
              className={`flex-none text-[10px] font-bold cursor-pointer px-1.5 py-0.5 rounded border ${
                s.direction === "UP"
                  ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                  : "bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
              }`}
            >
              {s.direction === "UP" ? "↑" : "↓"} {s.ticker}
              {s.count > 1 && <span className="ml-0.5 opacity-60 font-normal text-[9px]">×{s.count}</span>}
            </span>
          ))}
        </div>
      )}

      {/* Horizontal scrolling news cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200">
        {isLoading && (
          <div className="w-full py-8 text-center text-sm text-gray-400 animate-pulse">
            Fetching news from {sources.length || 18} sources...
          </div>
        )}
        {isError && (
          <div className="w-full text-sm text-red-500 py-6 text-center">
            Failed to load news. Backend may be offline.
          </div>
        )}
        {!isLoading && Array.isArray(newsList) && newsList.length === 0 && (
          <div className="w-full py-6 text-center text-sm text-gray-400">
            No news found for this filter.
          </div>
        )}
        {Array.isArray(newsList) &&
          newsList.map((item) => (
            <NewsCard key={item.id || item.title} item={item} onStockClick={onStockClick} />
          ))}
      </div>
    </section>
  );
}
