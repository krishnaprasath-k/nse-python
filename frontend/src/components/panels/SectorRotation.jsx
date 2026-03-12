import React from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export function SectorRotation() {
  const { data, isLoading } = useQuery({
    queryKey: ["sector-rotation"],
    queryFn: async () => (await axios.get("/api/sector-rotation")).data,
    staleTime: 15 * 60 * 1000,
  });

  if (isLoading)
    return <div className="p-4 text-center text-sm">Loading rotation...</div>;
  if (!data) return null;

  const {
    sectors,
    rising_sectors,
    falling_sectors,
    preferred_theme,
    rotation_summary,
  } = data;

  const getHeatColor = (ret) => {
    if (ret > 5) return "bg-green-700 text-white border-green-800";
    if (ret > 0) return "bg-green-100 text-green-900 border-green-300";
    if (ret > -5) return "bg-red-100 text-red-900 border-red-300";
    return "bg-red-700 text-white border-red-800";
  };

  return (
    <section className="bg-white border rounded p-4 shadow-sm w-full space-y-4">
      <h2 className="text-[16px] font-bold text-brand-primary">
        Sector Rotation — Money Flow
      </h2>
      <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs space-y-1">
        <div className="flex items-center gap-2 font-semibold text-green-700">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block shrink-0" />
          <span>RISING: {rising_sectors.map((s) => s.sector).join(" · ")}</span>
        </div>
        <div className="flex items-center gap-2 font-semibold text-red-700">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block shrink-0" />
          <span>FALLING: {falling_sectors.map((s) => s.sector).join(" · ")}</span>
        </div>
        <div className="font-bold text-brand-primary pt-0.5">
          Theme: {preferred_theme} rotation in play
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {sectors.map((s, i) => (
          <div
            key={i}
            className={`border rounded p-2 text-[11px] ${getHeatColor(s.ret_1m)}`}
          >
            <div className="font-bold text-[13px] mb-1">{s.sector}</div>
            <div className="flex justify-between">
              <span>1D:</span>
              <span>
                {s.ret_1d > 0 ? "+" : ""}
                {s.ret_1d}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>1W:</span>
              <span>
                {s.ret_1w > 0 ? "+" : ""}
                {s.ret_1w}%
              </span>
            </div>
            <div className="flex justify-between font-bold">
              <span>1M:</span>
              <span>
                {s.ret_1m > 0 ? "+" : ""}
                {s.ret_1m}%
              </span>
            </div>
            <div className="mt-1 pt-1 border-t border-black/10 text-[9px] font-extrabold uppercase tracking-wide text-center">
              {s.rotation_signal}
            </div>
          </div>
        ))}
      </div>

      <div className="h-48 mt-4">
        <h3 className="text-[12px] font-bold text-center text-gray-500 mb-2">
          1-Month Sector Performance
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sectors}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
          >
            <XAxis type="number" domain={[-15, 15]} tick={{ fontSize: 10 }} />
            <YAxis
              dataKey="sector"
              type="category"
              tick={{ fontSize: 10 }}
              width={80}
            />
            <Tooltip formatter={(value) => `${value}%`} />
            <Bar dataKey="ret_1m" barSize={12}>
              {sectors.map((s, idx) => (
                <Cell key={idx} fill={s.ret_1m > 0 ? "#16a34a" : "#dc2626"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
