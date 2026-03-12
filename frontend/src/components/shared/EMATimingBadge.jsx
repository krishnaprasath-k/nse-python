import React from "react";

export function EMATimingBadge({ signal }) {
  if (!signal) return null;

  const map = {
    "BEST TIMING": {
      bg: "bg-green-600",
      dot: "bg-green-200",
      label: "BEST TIMING",
      text: "text-white",
    },
    "NEAR EMA": {
      bg: "bg-green-100",
      dot: "bg-green-500",
      label: "NEAR EMA",
      text: "text-green-800",
    },
    "SLIGHTLY EXTENDED": {
      bg: "bg-amber-100",
      dot: "bg-amber-400",
      label: "EXTENDED",
      text: "text-amber-800",
    },
    EXTENDED: {
      bg: "bg-red-500",
      dot: "bg-red-200",
      label: "AVOID",
      text: "text-white",
    },
    "BELOW EMA": {
      bg: "bg-orange-100",
      dot: "bg-orange-400",
      label: "BELOW EMA",
      text: "text-orange-800",
    },
  };

  const badge = map[signal] || {
    bg: "bg-gray-100",
    dot: "bg-gray-400",
    label: signal,
    text: "text-gray-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded ${badge.bg} ${badge.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${badge.dot}`} />
      {badge.label}
    </span>
  );
}
