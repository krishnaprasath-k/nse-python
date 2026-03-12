import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { NewsImpactChips } from "../shared/NewsImpactChips";

const API_BASE = "/api";

// ─── Category color map ───────────────────────────────────────────────────────
const CATEGORY_BORDER = {
  INDIA_MARKETS:   "border-l-blue-500",
  INDIA_ECONOMY:   "border-l-green-500",
  INDIA_COMPANIES: "border-l-teal-500",
  GLOBAL_MACRO:    "border-l-orange-500",
  COMMODITIES:     "border-l-yellow-500",
  FOREX:           "border-l-pink-500",
  GOVT_POLICY:     "border-l-red-500",
  INDIA_INDUSTRY:  "border-l-purple-500",
  INDIA_BUSINESS:  "border-l-indigo-500",
};

const CATEGORY_BADGE = {
  INDIA_MARKETS:   "bg-blue-50 text-blue-700 border-blue-200",
  INDIA_ECONOMY:   "bg-green-50 text-green-700 border-green-200",
  INDIA_COMPANIES: "bg-teal-50 text-teal-700 border-teal-200",
  GLOBAL_MACRO:    "bg-orange-50 text-orange-700 border-orange-200",
  COMMODITIES:     "bg-yellow-50 text-yellow-700 border-yellow-200",
  FOREX:           "bg-pink-50 text-pink-700 border-pink-200",
  GOVT_POLICY:     "bg-red-50 text-red-700 border-red-200",
  INDIA_INDUSTRY:  "bg-purple-50 text-purple-700 border-purple-200",
  INDIA_BUSINESS:  "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const SOURCE_DOT = {
  blue: "bg-blue-500", green: "bg-green-500", teal: "bg-teal-500",
  orange: "bg-orange-500", yellow: "bg-yellow-500", pink: "bg-pink-500",
  red: "bg-red-500", purple: "bg-purple-500", indigo: "bg-indigo-500",
  gray: "bg-gray-400",
};

// ─── Relative timestamp ───────────────────────────────────────────────────────
function timeAgo(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  } catch {
    return "";
  }
}

// ─── Source badge ─────────────────────────────────────────────────────────────
function SourceBadge({ source, category, color }) {
  const dotClass = SOURCE_DOT[color] || SOURCE_DOT.gray;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 mr-2">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {source}
    </span>
  );
}

// ─── Category chip ────────────────────────────────────────────────────────────
function CategoryChip({ label, category, selected, onClick }) {
  const badgeClass = selected
    ? (CATEGORY_BADGE[category] || "bg-gray-100 text-gray-700 border-gray-200")
    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100";
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-all ${badgeClass} ${selected ? "ring-1 ring-offset-0" : ""}`}
    >
      {label}
    </button>
  );
}

// ─── Source dropdown ──────────────────────────────────────────────────────────
function SourceDropdown({ sources, selectedSource, onChange }) {
  return (
    <select
      value={selectedSource || ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-600 font-semibold cursor-pointer outline-none hover:border-gray-300"
    >
      <option value="">All Sources</option>
      {sources.map((s) => (
        <option key={s.source} value={s.source}>
          {s.source}
        </option>
      ))}
    </select>
  );
}

// ─── Main NewsPanel ───────────────────────────────────────────────────────────
export function NewsPanel({ onStockClick }) {
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeSource, setActiveSource] = useState(null);

  // Fetch categories for filter chips
  const { data: categories = [] } = useQuery({
    queryKey: ["news-categories"],
    queryFn: async () => (await axios.get(`${API_BASE}/news/categories`)).data,
    staleTime: 60 * 60 * 1000, // 1h — categories don't change
  });

  // Fetch source list for dropdown
  const { data: sources = [] } = useQuery({
    queryKey: ["news-sources"],
    queryFn: async () => (await axios.get(`${API_BASE}/news/sources`)).data,
    staleTime: 60 * 60 * 1000,
  });

  // Fetch news (re-fetches when filters change)
  const { data: newsList, isLoading, isError, refetch } = useQuery({
    queryKey: ["news", activeCategory, activeSource],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: 50 });
      if (activeCategory) params.set("category", activeCategory);
      if (activeSource)   params.set("source", activeSource);
      return (await axios.get(`${API_BASE}/news?${params}`)).data;
    },
    staleTime: 8 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000, // auto-refresh every 10 min
  });

  const handleCategoryClick = useCallback((cat) => {
    setActiveCategory((prev) => (prev === cat ? null : cat));
    setActiveSource(null);
  }, []);

  return (
    <section className="bg-white border rounded p-4 shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-[16px] font-bold text-brand-primary">
          📰 Live Market News
        </h2>
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

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
          <CategoryChip
            label="All"
            category={null}
            selected={!activeCategory}
            onClick={() => handleCategoryClick(null)}
          />
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
      )}

      {/* Source dropdown */}
      {sources.length > 0 && (
        <div className="mb-3">
          <SourceDropdown
            sources={sources}
            selectedSource={activeSource}
            onChange={setActiveSource}
          />
        </div>
      )}

      {/* News list */}
      <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
        {isLoading && (
          <div className="py-6 text-center text-sm text-gray-400 animate-pulse">
            Fetching news from {sources.length || 18} sources...
          </div>
        )}
        {isError && (
          <div className="text-sm text-red-500 py-4 text-center">
            Failed to load news. Backend may be offline.
          </div>
        )}
        {!isLoading && Array.isArray(newsList) && newsList.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-400">
            No news found for this filter.
          </div>
        )}
        {Array.isArray(newsList) && newsList.map((item) => {
          const borderClass = CATEGORY_BORDER[item.category] || "border-l-gray-300";
          return (
            <div
              key={item.id || item.title}
              className={`border-b pb-3 pl-3 border-l-4 ${borderClass} relative`}
            >
              {/* Source + category chips */}
              <div className="flex items-center flex-wrap gap-1 mb-1">
                <SourceBadge
                  source={item.source}
                  category={item.category}
                  color={item.category_color}
                />
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${CATEGORY_BADGE[item.category] || "bg-gray-50 text-gray-600 border-gray-200"}`}
                >
                  {item.category_label}
                </span>
                {item.published && (
                  <span className="ml-auto text-[10px] text-gray-400 font-medium">
                    {timeAgo(item.published)}
                  </span>
                )}
              </div>

              {/* Title */}
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-brand-link hover:underline text-[13px] block mb-1 leading-snug"
              >
                {item.title}
              </a>

              {/* Summary */}
              {item.summary && (
                <p className="text-[11px] text-gray-500 line-clamp-2 mb-1">
                  {item.summary}
                </p>
              )}

              {/* AI Note */}
              {item.ai_note && (
                <p className="text-[11px] text-gray-500 bg-blue-50/50 p-1.5 rounded border border-blue-100/50 mb-1">
                  <span className="font-bold text-blue-800 tracking-wider text-[10px] uppercase">
                    AI Note
                  </span>
                  : {item.ai_note}
                </p>
              )}

              {/* Impact Chips */}
              {item.impact && (
                <div className="mt-1">
                  <NewsImpactChips
                    impact={item.impact}
                    onStockClick={onStockClick}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
