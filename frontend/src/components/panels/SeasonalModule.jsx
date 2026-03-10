import React from "react";
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

export function SeasonalModule({ ticker }) {
  const { data, isLoading } = useQuery({
    queryKey: ["seasonal", ticker],
    queryFn: async () => (await axios.get(`/api/seasonal/${ticker}`)).data,
    staleTime: 60 * 60 * 1000,
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

  return (
    <section className="col-span-1 lg:col-span-2 bg-white border rounded p-4 shadow-sm mt-6">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h2 className="text-[16px] font-bold text-brand-primary">
          📅 Seasonal Impact Analysis — Last 10 Years
        </h2>
        {currentMonthData && (
          <span
            className={`text-[12px] font-bold px-2 py-1 rounded-full ${currentMonthData.signal === "RISING" ? "bg-green-100 text-green-800" : currentMonthData.signal === "FALLING" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
          >
            {currentMonthData.month.toUpperCase()} → {currentMonthData.signal}{" "}
            {currentMonthData.signal === "RISING"
              ? "🟢"
              : currentMonthData.signal === "FALLING"
                ? "🔴"
                : "🟡"}
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
                    let fill = "#fbbf24"; // MIXED
                    if (entry.avg_return > 0 && entry.win_rate >= 60)
                      fill = "#16a34a"; // RISING
                    if (entry.avg_return < 0 && entry.win_rate <= 40)
                      fill = "#dc2626"; // FALLING
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
                  <tr
                    key={i}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-1 font-bold">{y.year}</td>
                    <td
                      className={`py-1 font-bold ${y.return > 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {y.return > 0 ? "+" : ""}
                      {y.return}%
                    </td>
                    <td
                      className={`py-1 font-bold ${y.result === "UP" ? "text-green-600" : "text-red-600"}`}
                    >
                      {y.result === "UP" ? "▲" : "▼"}
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
                  <span className="opacity-80 font-normal">
                    {day.win_rate}% win
                  </span>
                  <span>
                    {day.avg_return > 0 ? "+" : ""}
                    {day.avg_return}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
