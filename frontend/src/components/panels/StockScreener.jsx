import React from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Badge } from "../shared/Badge";

const API_BASE = "/api";

export function StockScreener() {
  const { data: screens, isLoading } = useQuery({
    queryKey: ["screener"],
    queryFn: async () => (await axios.get(`${API_BASE}/screener`)).data,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 min
  });

  return (
    <section className="bg-white border rounded p-4 shadow-sm w-full mt-6">
      <h2 className="text-[16px] font-bold text-brand-primary mb-4">
        Stock Universe Screener
      </h2>
      {isLoading ? (
        <div className="py-4 text-center">Loading Screener...</div>
      ) : (
        <div className="overflow-x-auto text-[12px]">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b text-gray-500 font-semibold bg-gray-50">
                <th className="p-2">Ticker</th>
                <th className="p-2">Name</th>
                <th className="p-2">Sector</th>
                <th className="p-2">Price</th>
                <th className="p-2">% Change</th>
                <th className="p-2">Zone</th>
                <th className="p-2">Score</th>
                <th className="p-2">Shortlist</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(screens) ? (
                screens.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-bold text-brand-primary">
                      {s.ticker}
                    </td>
                    <td className="p-2 text-gray-700">{s.name}</td>
                    <td className="p-2 text-gray-500">{s.sector}</td>
                    <td className="p-2 font-semibold">
                      ₹{s.price?.toFixed(2)}
                    </td>
                    <td
                      className={`p-2 font-bold ${s.change_pct > 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {(s.change_pct * 100)?.toFixed(2)}%
                    </td>
                    <td className="p-2">{s.zone}</td>
                    <td className="p-2 font-bold text-brand-primary">
                      {s.score}/5
                    </td>
                    <td className="p-2">
                      {s.shortlist ? (
                        <Badge label="BUY TODAY" />
                      ) : (
                        <Badge label="WATCHLIST" />
                      )}
                    </td>
                  </tr>
                ))
              ) : screens ? (
                <tr>
                  <td colSpan="8" className="p-4 text-center text-red-500">
                    Failed to load screener data.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
