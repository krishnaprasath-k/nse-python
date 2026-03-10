import React from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Badge } from "../shared/Badge";

const API_BASE = "/api";

export function FinalRankingTable() {
  const { data: screens, isLoading } = useQuery({
    queryKey: ["screener"],
    queryFn: async () => (await axios.get(`${API_BASE}/screener`)).data,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading)
    return <div className="p-4 text-center">Loading Rankings...</div>;
  if (!Array.isArray(screens) || screens.length === 0) return null;

  // Sort by final_score descending
  const sorted = [...screens].sort(
    (a, b) => (b.final_score || 0) - (a.final_score || 0),
  );

  const getColor = (val) => {
    if (val === 2) return "bg-green-100 text-green-800";
    if (val === 1) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <section className="bg-white border rounded p-4 shadow-sm w-full mt-6">
      <h2 className="text-[16px] font-bold text-brand-primary mb-4">
        🏆 Final Probability Ranking
      </h2>
      <div className="overflow-x-auto text-[12px]">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b text-gray-500 font-semibold bg-gray-50">
              <th className="p-2">Rank</th>
              <th className="p-2">Ticker</th>
              <th className="p-2 text-center">Macro</th>
              <th className="p-2 text-center">Sector</th>
              <th className="p-2 text-center">Event</th>
              <th className="p-2 text-center">Seasonal</th>
              <th className="p-2 text-center">Statistical</th>
              <th className="p-2 text-center">Technical</th>
              <th className="p-2 text-center font-bold">Total</th>
              <th className="p-2 text-center">Signal</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const scores = s.probability_scores || {};
              return (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-bold">{i + 1}</td>
                  <td className="p-2 font-bold text-brand-primary">
                    {s.ticker}
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${getColor(scores.macro)}`}
                    >
                      {scores.macro ?? "-"}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${getColor(scores.sector)}`}
                    >
                      {scores.sector ?? "-"}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${getColor(scores.event)}`}
                    >
                      {scores.event ?? "-"}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${getColor(scores.seasonal)}`}
                    >
                      {scores.seasonal ?? "-"}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${getColor(scores.statistical)}`}
                    >
                      {scores.statistical ?? "-"}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${getColor(scores.technical)}`}
                    >
                      {scores.technical ?? "-"}
                    </span>
                  </td>
                  <td className="p-2 text-center font-bold text-[14px]">
                    {s.final_score ?? "-"}
                  </td>
                  <td className="p-2 text-center">
                    <Badge label={s.final_signal || "WATCH"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
