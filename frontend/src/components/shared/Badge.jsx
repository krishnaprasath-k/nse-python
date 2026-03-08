import React from "react";

const BADGE_STYLES = {
  "RISK ON": "bg-green-100 text-green-800 border-green-300",
  "RISK OFF": "bg-red-100 text-red-800 border-red-300",
  NEUTRAL: "bg-yellow-100 text-yellow-800 border-yellow-300",
  STRONG: "bg-emerald-500 text-white",
  WEAK: "bg-red-500 text-white",
  RANGE: "bg-orange-400 text-white",
  "STRONG BULLISH": "bg-emerald-600 text-white",
  "STRONG BEARISH": "bg-rose-600 text-white",
  "BUY TODAY": "bg-green-600 text-white text-base font-bold",
  "SELL TODAY": "bg-red-600 text-white text-base font-bold",
  WATCHLIST: "bg-gray-500 text-white",
  SPIKE: "bg-orange-500 text-white text-xs",
  RESULT: "bg-blue-500 text-white",
  DIVIDEND: "bg-purple-500 text-white",
  BONUS: "bg-teal-500 text-white",
  SPLIT: "bg-pink-500 text-white",
  EASING: "bg-green-100 text-green-700",
  TIGHTENING: "bg-red-100 text-red-700",
  GROWTH: "bg-blue-100 text-blue-700",
  DEFENSIVE: "bg-orange-100 text-orange-700",
};

export function Badge({ label }) {
  const style = BADGE_STYLES[label] || "bg-gray-200 text-gray-700";
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-[12px] font-semibold border ${style}`}
    >
      {label}
    </span>
  );
}
