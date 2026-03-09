import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

export function StockChart({ data, events = [] }) {
  const chartContainerRef = useRef();
  const [chartInstance, setChartInstance] = useState(null);

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
    setChartInstance(chart);

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const sortedData = [...data]
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .map((item) => ({
        time: item.time.split(" ")[0],
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        vol_spike: item.vol_spike,
      }));

    candlestickSeries.setData(sortedData);

    if (events && events.length > 0) {
      const markers = [];
      const dataTimes = new Set(sortedData.map((d) => d.time));

      events.forEach((evt) => {
        // Only show marker if date is in data (lightweight charts throws error otherwise)
        if (!dataTimes.has(evt.date)) return;

        let color = "#71717a";
        if (evt.type === "RESULT") color = "#3b82f6";
        if (evt.type === "DIVIDEND") color = "#a855f7";
        if (evt.type === "SPLIT") color = "#ec4899";
        if (evt.type === "BONUS") color = "#14b8a6";

        markers.push({
          time: evt.date,
          position: "aboveBar",
          color: color,
          shape: "arrowDown",
          text: evt.type,
        });
      });
      markers.sort((a, b) => new Date(a.time) - new Date(b.time));
      try {
        candlestickSeries.setMarkers(markers);
      } catch (e) {
        console.warn("Could not set markers:", e);
      }
    }

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "", // set as an overlay
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const volumeData = sortedData.map((d) => {
      const isSpike = d.vol_spike;
      return {
        time: d.time,
        value: d.volume,
        color: isSpike
          ? "rgba(249, 115, 22, 0.8)"
          : d.close > d.open
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
      setChartInstance(null);
    };
  }, [data, events]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
}
