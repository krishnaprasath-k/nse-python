import React from "react";

export function EMATimingBadge({ signal }) {
  if (!signal) return null;

  const map = {
    "BEST TIMING": {
      color: "bg-green-500",
      label: "✅ BEST TIMING",
      text: "text-white",
    },
    "NEAR EMA": {
      color: "bg-green-200",
      label: "🟢 NEAR EMA",
      text: "text-green-800",
    },
    "SLIGHTLY EXTENDED": {
      color: "bg-yellow-200",
      label: "🟡 EXTENDED",
      text: "text-yellow-800",
    },
    EXTENDED: { color: "bg-red-500", label: "🔴 AVOID", text: "text-white" },
    "BELOW EMA": {
      color: "bg-orange-200",
      label: "🟠 BELOW EMA",
      text: "text-orange-800",
    },
  };

  const badge = map[signal] || {
    color: "bg-gray-200",
    label: signal,
    text: "text-gray-800",
  };

  return (
    <span
      className={`px-2 py-1 text-[10px] font-bold rounded ${badge.color} ${badge.text}`}
    >
      {badge.label}
    </span>
  );
}
