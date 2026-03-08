import React, { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export function StockChart({ data }) {
  const chartContainerRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0 || !chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 250,
      layout: {
        background: { color: "transparent" },
        textColor: "#333",
      },
      grid: {
        vertLines: { color: "#f0f3fa" },
        horzLines: { color: "#f0f3fa" },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    // Sort logic just in case the OHLCV data is returned unordered, lightweight charts requires sorted by time.
    const sortedData = [...data]
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .map((item) => ({
        time: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));

    candlestickSeries.setData(sortedData);

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "", // set as an overlay
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const volumeData = sortedData.map((d, index) => {
      const original = data.find((x) => x.time === d.time);
      return {
        time: d.time,
        value: original ? original.volume : 0,
        color:
          original && original.close > original.open
            ? "rgba(38, 166, 154, 0.4)"
            : "rgba(239, 83, 80, 0.4)",
      };
    });

    volumeSeries.setData(volumeData);

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
}
