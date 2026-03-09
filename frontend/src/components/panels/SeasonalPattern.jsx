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

export function SeasonalPattern({ ticker }) {
  const { data, isLoading } = useQuery({
    queryKey: ["seasonal", ticker],
    queryFn: async () =>
      (await axios.get(`/api/stock/${ticker}/seasonal`)).data,
    staleTime: 60 * 60 * 1000,
  });

  if (isLoading)
    return (
      <div className="p-8 text-center text-gray-500">
        Loading Seasonal Pattern...
      </div>
    );
  if (!data || data.length === 0) return null;

  const currentMonthIndex = new Date().getMonth();
  // getMonth() gives 0 for Jan, 11 for Dec, which corresponds to our month array ordering if it starts with Jan

  const years = data[0]?.years || 10;

  return (
    <section className="bg-white border rounded p-4 shadow-sm mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-[16px] font-bold text-brand-primary">
          Seasonal Pattern Analysis
        </h2>
        <span className="text-[12px] text-gray-500">
          Based on {years} years of {ticker} data
        </span>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
          >
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white p-2 border shadow text-sm">
                      <p className="font-bold">
                        {d.month}: avg {d.avg_return > 0 ? "+" : ""}
                        {d.avg_return}%, rises {d.win_rate}% of years →{" "}
                        {d.signal}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="avg_return" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => {
                const isCurrent = index === currentMonthIndex;
                const fill = entry.avg_return >= 0 ? "#16a34a" : "#dc2626";
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={fill}
                    stroke={isCurrent ? "#000000" : "none"}
                    strokeWidth={isCurrent ? 2 : 0}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between px-2 -mt-4">
        {data.map((entry, idx) => (
          <div
            key={idx}
            className="text-[10px] text-gray-500 w-[8%] text-center"
          >
            {entry.win_rate}%
          </div>
        ))}
      </div>
    </section>
  );
}
