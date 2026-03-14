import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import axios from "axios";
import { Badge } from "./components/shared/Badge";
import { NewsPanel } from "./components/panels/NewsPanel";
import { ContractTracker } from "./components/panels/ContractTracker";
import { SectorRotation } from "./components/panels/SectorRotation";
import { SeasonalModule } from "./components/panels/SeasonalModule";
import { FinalRankingTable } from "./components/panels/FinalRankingTable";

const API_BASE = "/api";

function isNSEOpen() {
  const now = new Date();
  const ist = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const day = ist.getDay();
  const mins = ist.getHours() * 60 + ist.getMinutes();

  if (day >= 1 && day <= 5) {
    if (mins >= 555 && mins <= 930) return "OPEN";
    if (mins >= 540 && mins < 555) return "PRE_OPEN";
  }
  return "CLOSED";
}

export default function App() {
  const [ticker] = useState("SBIN.NS");
  const marketStatus = isNSEOpen();

  // Keep Render server awake by pinging it every 14 minutes
  useEffect(() => {
    const keepAlive = setInterval(
      () => {
        fetch(`${API_BASE}/ping`).catch(() => {});
      },
      14 * 60 * 1000,
    );
    fetch(`${API_BASE}/ping`).catch(() => {});
    return () => clearInterval(keepAlive);
  }, []);

  const { data: market, isLoading: mktLoad } = useQuery({
    queryKey: ["market"],
    queryFn: async () => (await axios.get(`${API_BASE}/market`)).data,
    staleTime: 3 * 60 * 1000,
    refetchInterval: marketStatus === "OPEN" ? 3 * 60 * 1000 : false,
  });

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-brand-text p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-center pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-brand-primary">
                NSE Trading Dashboard
              </h1>
              <p className="text-sm text-gray-500">
                Nifty 500 — Decision Engine
              </p>
            </div>
            <Link
              to="/config"
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition-colors"
              title="Model Configuration"
            >
              Config
            </Link>
          </div>
          <div className="text-right">
            {marketStatus === "OPEN" && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-800 border border-green-300 text-xs font-bold rounded">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                MARKET OPEN
              </span>
            )}
            {marketStatus === "PRE_OPEN" && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold rounded">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                PRE-OPEN
              </span>
            )}
            {marketStatus === "CLOSED" && (
              <div className="flex flex-col items-end">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-700 border border-gray-300 text-xs font-bold rounded">
                  <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                  MARKET CLOSED
                </span>
                <span className="text-[10px] text-gray-400 mt-1">
                  Opens at 9:15 AM IST
                </span>
              </div>
            )}
          </div>
        </header>

        {mktLoad ? (
          <div className="p-8 text-center text-gray-500">
            Loading Market Data...
          </div>
        ) : (
          <>
            {/* Compact Market Bar */}
            <section className="bg-white border rounded p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
                {/* India */}
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-semibold">Nifty</span>
                  <span className="font-bold text-brand-primary">{market?.nifty?.price?.toFixed(2)}</span>
                  <span className={`font-semibold ${market?.nifty?.change_pct > 0 ? "text-green-600" : "text-red-600"}`}>
                    {market?.nifty?.change_pct > 0 ? "+" : ""}{(market?.nifty?.change_pct * 100)?.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-semibold">BankNifty</span>
                  <span className="font-bold text-brand-primary">{market?.banknifty?.price?.toFixed(2)}</span>
                  <span className={`font-semibold ${market?.banknifty?.change_pct > 0 ? "text-green-600" : "text-red-600"}`}>
                    {market?.banknifty?.change_pct > 0 ? "+" : ""}{(market?.banknifty?.change_pct * 100)?.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-semibold">VIX</span>
                  <span className={`font-bold ${market?.india_vix < 20 ? "text-green-600" : "text-red-600"}`}>
                    {market?.india_vix?.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-semibold">FII</span>
                  <span className={`font-bold ${market?.fii_net > 0 ? "text-green-600" : "text-red-600"}`}>
                    {market?.fii_net > 0 ? "+" : ""}{market?.fii_net}Cr
                  </span>
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-gray-300" />

                {/* Global */}
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-semibold">S&P500</span>
                  <span className="font-bold text-brand-primary">{market?.sp500?.price?.toFixed(0)}</span>
                  <span className={`font-semibold ${market?.sp500?.change_pct > 0 ? "text-green-600" : "text-red-600"}`}>
                    {market?.sp500?.change_pct > 0 ? "+" : ""}{(market?.sp500?.change_pct * 100)?.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-semibold">Crude</span>
                  <span className="font-bold text-brand-primary">{market?.crude?.price?.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-semibold">Yield</span>
                  <span className="font-bold text-brand-primary">{market?.tlt?.price?.toFixed(2)}</span>
                  <span className="text-[11px] text-gray-400">{market?.tlt?.yield_direction}</span>
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-gray-300" />

                {/* Signals */}
                <Badge label={market?.global_risk || "NEUTRAL"} />
                <Badge label={market?.india_bias || "RANGE"} />
              </div>
            </section>

            {/* Sector Rotation + Contract Tracker */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectorRotation />
              <ContractTracker />
            </div>

            {/* News Panel */}
            <NewsPanel />

            {/* Seasonal Decision Module */}
            <SeasonalModule ticker={ticker} />

            {/* Probability Ranking Table */}
            <FinalRankingTable />
          </>
        )}
      </div>
    </div>
  );
}
