import React from "react";

export function NewsImpactChips({ impact, onStockClick }) {
  if (!impact || !impact.impacted_stocks || impact.impacted_stocks.length === 0)
    return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap gap-2">
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded ${impact.market_sentiment === "BULLISH" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
        >
          {impact.market_sentiment}
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
          {impact.news_category}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 mt-1">
        {impact.impacted_stocks.map((s, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 text-xs font-bold rounded-full border cursor-pointer ${s.direction === "UP" ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200" : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"}`}
            onClick={() => onStockClick && onStockClick(s.ticker + ".NS")}
          >
            {s.direction === "UP" ? "↑" : "↓"} {s.ticker}{" "}
            {s.direction === "UP" ? "+" : ""}
            {s.expected_move_pct}%
          </span>
        ))}
      </div>
      {impact.impacted_sectors && impact.impacted_sectors.length > 0 && (
        <div className="text-[10px] text-gray-500 mt-1">
          {impact.impacted_sectors
            .map((s) => `${s.sector} ${s.direction === "UP" ? "↑" : "↓"}`)
            .join(" | ")}
        </div>
      )}
    </div>
  );
}
