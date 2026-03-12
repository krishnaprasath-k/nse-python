import React from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export function ContractTracker() {
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => (await axios.get("/api/contracts")).data,
    staleTime: 2 * 60 * 60 * 1000,
  });

  return (
    <section className="bg-white border rounded p-4 shadow-sm w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-[16px] font-bold text-brand-primary">
          Big Contract Wins (≥ ₹100 Cr)
        </h2>
      </div>
      {isLoading ? (
        <div className="py-4 text-center text-sm text-gray-500">
          Scanning for contracts...
        </div>
      ) : !contracts || contracts.length === 0 ? (
        <div className="py-4 text-center text-sm text-gray-500 bg-gray-50 border rounded">
          No major contracts in last 24 hours
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((c, i) => {
            const isUp = c.expected_impact === "UP";
            return (
              <div
                key={i}
                className={`border border-gray-200 rounded p-3 flex flex-col gap-2 relative shadow-sm border-l-4 ${isUp ? "border-l-green-500" : "border-l-red-500"}`}
              >
                <div className="flex justify-between items-center">
                  <div className="font-bold text-brand-primary text-[14px]">
                    {c.ticker}
                  </div>
                  <div className="font-bold text-[16px]">
                    {c.contract_value_display} {c.direction === "UP" ? "↑" : ""}
                  </div>
                </div>
                <div className="text-[12px] text-gray-600 flex justify-between">
                  <span className="font-semibold">
                    {c.company_name} | {c.contract_type}
                  </span>
                  <span>Client: {c.client}</span>
                </div>
                <div className="flex flex-col gap-1 bg-gray-50 p-2 rounded text-[12px]">
                  <span className="italic">"{c.reason}"</span>
                  <span
                    className={`font-bold mt-1 px-2 py-1 rounded w-fit ${isUp ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                  >
                    Expected: {isUp ? "+" : "-"}
                    {c.expected_move_pct}% in 1-5 days
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <a
                    href={c.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-brand-link hover:underline"
                  >
                    View News ↗
                  </a>
                  <button className="text-[10px] px-2 py-1 border rounded font-bold hover:bg-gray-100">
                    Add to Watchlist
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
