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
  LabelList,
} from "recharts";

export function CorrelationPanel({ ticker }) {
  const { data, isLoading } = useQuery({
    queryKey: ["correlation", ticker],
    queryFn: async () =>
      (await axios.get(`/api/stock/${ticker}/correlation`)).data,
    staleTime: 60 * 60 * 1000,
  });

  if (isLoading)
    return (
      <div className="p-8 text-center text-gray-500">
        Loading Correlation...
      </div>
    );
  if (!data || data.length === 0) return null;

  const chartData = data.map((d) => ({
    ...d,
    absCorr: Math.abs(d.correlation) * 100,
  }));

  return (
    <section className="bg-white border rounded p-4 shadow-sm mt-6">
      <h2 className="text-[16px] font-bold text-brand-primary mb-4">
        Correlation Analysis vs Key Instruments (1Y)
      </h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 20, bottom: 0 }}
          >
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              tick={{ fontSize: 12, fill: "#4b5563" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white p-2 border shadow text-sm">
                      <p className="font-bold">{d.name}</p>
                      <p>Correlation: {d.correlation}</p>
                      <p>Strength: {d.strength}</p>
                      <p>Note: {d.note}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="absCorr" radius={[0, 4, 4, 0]} barSize={20}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.correlation >= 0 ? "#16a34a" : "#dc2626"}
                />
              ))}
              <LabelList
                dataKey="correlation"
                position="right"
                fontSize={10}
                fill="#6b7280"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
