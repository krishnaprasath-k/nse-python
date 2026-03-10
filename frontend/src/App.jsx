import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Badge } from "./components/shared/Badge";
import { StockScreener } from "./components/panels/StockScreener";
import { StockChart } from "./components/panels/StockChart";
import { CorporateEventsTimeline } from "./components/panels/CorporateEventsTimeline";
import { ShareButton } from "./components/shared/ShareButton";
import { CorrelationPanel } from "./components/panels/CorrelationPanel";
import { NewsImpactChips } from "./components/shared/NewsImpactChips";
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

function MetricCard({ title, data, reverseColor = false }) {
  if (!data) return null;
  const isPos = data.change_pct > 0;
  const color = reverseColor
    ? isPos
      ? "text-red-600"
      : "text-green-600"
    : isPos
      ? "text-green-600"
      : "text-red-600";

  return (
    <div className="bg-white border border-gray-200 rounded p-3 flex-1 min-w-[120px] shadow-sm">
      <div className="text-[12px] text-gray-500 font-semibold">{title}</div>
      <div className="text-[16px] font-bold text-brand-primary">
        {data.price?.toFixed(2) || "0.00"}
      </div>
      <div className={`text-[12px] font-semibold ${color}`}>
        {isPos ? "+" : ""}
        {(data.change_pct * 100).toFixed(2)}%
      </div>
    </div>
  );
}

export default function App() {
  const [ticker, setTicker] = useState("SBIN.NS");
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

  const { data: stock, isLoading: stkLoad } = useQuery({
    queryKey: ["stock", ticker],
    queryFn: async () => (await axios.get(`${API_BASE}/stock/${ticker}`)).data,
    staleTime: 5 * 60 * 1000,
    refetchInterval: marketStatus === "OPEN" ? 5 * 60 * 1000 : false,
  });

  const { data: trade, isLoading: trdLoad } = useQuery({
    queryKey: ["trade", ticker],
    queryFn: async () =>
      (await axios.get(`${API_BASE}/trade-signal/${ticker}`)).data,
    staleTime: 5 * 60 * 1000,
    refetchInterval: marketStatus === "OPEN" ? 5 * 60 * 1000 : false,
  });

  const { data: news } = useQuery({
    queryKey: ["news"],
    queryFn: async () => (await axios.get(`${API_BASE}/news`)).data,
    staleTime: 5 * 60 * 1000,
    refetchInterval: marketStatus === "OPEN" ? 5 * 60 * 1000 : false,
  });

  const { data: events } = useQuery({
    queryKey: ["events", ticker],
    queryFn: async () =>
      (await axios.get(`${API_BASE}/stock/${ticker}/events`)).data,
    staleTime: 60 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-brand-text p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-center pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-xl font-bold text-brand-primary">
              NSE Trading Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Real-time Professional Terminal
            </p>
          </div>
          <div className="text-right">
            {marketStatus === "OPEN" && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded">
                MARKET OPEN 🟢
              </span>
            )}
            {marketStatus === "PRE_OPEN" && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">
                PRE-OPEN ⏳
              </span>
            )}
            {marketStatus === "CLOSED" && (
              <div className="flex flex-col items-end">
                <span className="px-2 py-1 bg-gray-200 text-gray-800 text-xs font-bold rounded">
                  MARKET CLOSED 🔴
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
            <section>
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-[16px] font-bold text-brand-primary">
                  Global Macro
                </h2>
                <Badge label={market?.global_risk || "NEUTRAL"} />
              </div>
              <div className="flex flex-wrap gap-4">
                <MetricCard
                  title="Crude Oil (CL=F)"
                  data={market?.crude}
                  reverseColor
                />
                <MetricCard title="S&P 500 (^GSPC)" data={market?.sp500} />
                <MetricCard
                  title="US Dollar Index"
                  data={market?.dxy}
                  reverseColor
                />
                <MetricCard title="Nifty 50" data={market?.nifty} />
                <div className="bg-white border rounded p-3 flex-1 min-w-[120px] shadow-sm">
                  <div className="text-[12px] text-gray-500 font-semibold">
                    US 10Y Yield
                  </div>
                  <div className="text-[16px] font-bold text-brand-primary">
                    {market?.tlt?.price?.toFixed(2)}
                  </div>
                  <div
                    className={`text-[12px] font-semibold text-brand-accent`}
                  >
                    {market?.tlt?.yield_direction || "-"}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-[16px] font-bold text-brand-primary">
                  India Market Check
                </h2>
                <Badge label={market?.india_bias || "RANGE"} />
              </div>
              <div className="flex flex-wrap gap-4">
                <MetricCard title="Nifty 50" data={market?.nifty} />
                <MetricCard title="BankNifty" data={market?.banknifty} />
                <div className="bg-white border rounded p-3 flex-1 min-w-[120px] shadow-sm">
                  <div className="text-[12px] text-gray-500 font-semibold">
                    India VIX
                  </div>
                  <div className="text-[16px] font-bold text-brand-primary">
                    {market?.india_vix?.toFixed(2)}
                  </div>
                  <div
                    className={`text-[12px] font-semibold ${market?.india_vix < 20 ? "text-green-600" : "text-red-600"}`}
                  >
                    {market?.india_vix < 20 ? "Comfortable" : "High Risk"}
                  </div>
                </div>
                <div className="bg-white border rounded p-3 flex-1 min-w-[120px] shadow-sm">
                  <div className="text-[12px] text-gray-500 font-semibold">
                    FII Net Flow (Cr)
                  </div>
                  <div className="text-[16px] font-bold text-brand-primary">
                    {market?.fii_net || "0.00"}
                  </div>
                  <div
                    className={`text-[12px] font-semibold ${market?.fii_net > 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {market?.fii_net > 0 ? "Buying" : "Selling"}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <SectorRotation />
              <ContractTracker />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div className="lg:col-span-2 space-y-6">
                <section className="bg-white border rounded p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-[16px] font-bold text-brand-primary">
                      {stock?.name || ticker} Chart
                    </h2>
                    <select
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value)}
                      className="border rounded px-2 py-1 text-sm outline-none bg-brand-bg text-brand-text"
                    >
                      <option value="SBIN.NS">SBIN</option>
                      <option value="RELIANCE.NS">RELIANCE</option>
                      <option value="HDFCBANK.NS">HDFCBANK</option>
                      <option value="INFY.NS">INFY</option>
                    </select>
                  </div>
                  {stkLoad ? (
                    <div className="h-64 flex items-center justify-center">
                      Loading chart...
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="h-64 bg-[#f8fafc] border border-gray-200 rounded text-sm text-gray-400 font-semibold p-2 overflow-hidden relative">
                        {stock?.ohlcv?.length > 0 ? (
                          <StockChart data={stock.ohlcv} events={events} />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            No chart data
                          </div>
                        )}
                      </div>
                      <CorporateEventsTimeline events={events} />
                    </div>
                  )}
                </section>

                <section className="bg-white border rounded p-4 shadow-sm">
                  <h2 className="text-[16px] font-bold text-brand-primary mb-4">
                    Live Market News
                  </h2>
                  <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                    {Array.isArray(news) ? (
                      news.map((item, i) => (
                        <div key={i} className="border-b pb-3 relative">
                          <a
                            href={item.link}
                            target="_blank"
                            className="font-bold text-brand-link hover:underline text-[14px] block mb-1"
                          >
                            {item.title}
                          </a>
                          {item.ai_note && (
                            <p className="text-[12px] text-gray-500 bg-blue-50/50 p-2 rounded border border-blue-100/50 mb-2">
                              <span className="font-bold text-blue-800 tracking-wider text-[10px] uppercase">
                                AI Note
                              </span>
                              : {item.ai_note}
                            </p>
                          )}
                          <div className="mt-1">
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                              📈 Impact Analysis
                            </h4>
                            <NewsImpactChips
                              impact={item.impact}
                              onStockClick={setTicker}
                            />
                          </div>
                        </div>
                      ))
                    ) : news ? (
                      <div className="text-sm text-red-500">
                        Failed to load news.
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="bg-white border rounded shadow-sm border-t-4 border-t-brand-primary">
                  <div className="p-4 border-b">
                    <h2 className="text-[16px] font-bold text-brand-primary mb-1">
                      Action Plan: {ticker}
                    </h2>
                    <p className="text-[12px] text-gray-400">
                      Model 4 — Datewise Robust
                    </p>
                  </div>
                  <div className="p-4 text-center">
                    {trdLoad ? (
                      <div className="py-8">Computing Signal...</div>
                    ) : (
                      <>
                        <div className="mb-4 text-[12px] font-semibold text-gray-500 uppercase tracking-widest">
                          Aggregated Signal
                        </div>
                        <div className="mb-2">
                          <Badge label={trade?.decision || "WATCHLIST"} />
                        </div>
                        <div className="mt-8 text-left space-y-3 px-2">
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-500 text-[14px]">
                              Entry
                            </span>
                            <span className="font-bold">
                              ₹{trade?.entry || 0}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-500 text-[14px]">
                              Target (3x)
                            </span>
                            <span className="font-bold text-green-600">
                              ₹{trade?.target || 0}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-500 text-[14px]">
                              Stop Loss
                            </span>
                            <span className="font-bold text-red-600">
                              ₹{trade?.stop_loss || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 text-[14px]">
                              R:R Ratio
                            </span>
                            <span className="font-bold">
                              {trade?.risk_reward || 0}
                            </span>
                          </div>
                        </div>
                        <ShareButton
                          data={{
                            ticker,
                            decision: trade?.decision || "WATCHLIST",
                            entry: trade?.entry || 0,
                            target: trade?.target || 0,
                            stopLoss: trade?.stop_loss || 0,
                            rrRatio: trade?.risk_reward || 0,
                            globalRisk: market?.global_risk || "NEUTRAL",
                            indiaBias: market?.india_bias || "NEUTRAL",
                          }}
                        />
                      </>
                    )}
                  </div>
                </section>

                <section className="bg-white border rounded p-4 shadow-sm">
                  <h2 className="text-[16px] font-bold text-brand-primary mb-4">
                    Technical Indicators
                  </h2>
                  {stkLoad ? (
                    "..."
                  ) : (
                    <div className="space-y-3 text-[14px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">20-Day MA</span>
                        <span className="font-bold text-brand-primary">
                          {stock?.indicators?.ma20?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">50-Day MA</span>
                        <span className="font-bold text-brand-primary">
                          {stock?.indicators?.ma50?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">ATR(14)</span>
                        <span className="font-bold text-brand-primary">
                          {stock?.indicators?.atr14?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">5D Return</span>
                        <span
                          className={`font-bold ${stock?.indicators?.return_5d > 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {(stock?.indicators?.return_5d * 100)?.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">20D Return</span>
                        <span
                          className={`font-bold ${stock?.indicators?.return_20d > 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {(stock?.indicators?.return_20d * 100)?.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Vol Spike</span>
                        <span className="font-bold">
                          {stock?.indicators?.vol_spike ? (
                            <Badge label="SPIKE" />
                          ) : (
                            "Normal"
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Bias</span>
                        <span className="font-bold">
                          <Badge label={stock?.indicators?.bias || "NEUTRAL"} />
                        </span>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
            <StockScreener />
            <SeasonalModule ticker={ticker} />
            <FinalRankingTable />

            <div className="mt-6 pb-8">
              <CorrelationPanel ticker={ticker} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
