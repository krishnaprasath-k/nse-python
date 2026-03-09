import React, { useState } from "react";
import html2canvas from "html2canvas";

export function ShareButton({ data }) {
  const {
    ticker,
    decision,
    entry,
    target,
    stopLoss,
    rrRatio,
    globalRisk,
    indiaBias,
  } = data;
  const [copied, setCopied] = useState(false);

  const upside = entry > 0 ? (((target - entry) / entry) * 100).toFixed(1) : 0;

  const shareText = `📊 NSE Signal — ${ticker}
🎯 ${decision}
Entry:  ₹${entry}
Target: ₹${target} (+${upside}%)
SL:     ₹${stopLoss}
R:R:    ${rrRatio}x
🌍 Global: ${globalRisk} | 🇮🇳 India: ${indiaBias}
#NSE #${ticker.replace(".NS", "")} #Trading`;

  const encodedText = encodeURIComponent(shareText);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScreenshot = async () => {
    const el = document.getElementById("dashboard-root");
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 2 });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `nse-${ticker}-${new Date().toISOString().split("T")[0]}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 justify-center mt-4 border-t pt-4">
      <button
        onClick={handleCopy}
        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[12px] font-semibold rounded"
      >
        {copied ? "✅ Copied" : "📋 Copy"}
      </button>
      <a
        href={`https://wa.me/?text=${encodedText}`}
        target="_blank"
        rel="noreferrer"
        className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 text-[12px] font-semibold rounded"
      >
        📲 WhatsApp
      </a>
      <a
        href={`https://t.me/share/url?url=https://nse-python.vercel.app/&text=${encodedText}`}
        target="_blank"
        rel="noreferrer"
        className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-[12px] font-semibold rounded"
      >
        ✈️ Telegram
      </a>
      <button
        onClick={handleScreenshot}
        className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 text-[12px] font-semibold rounded"
      >
        📸 Screenshot
      </button>
    </div>
  );
}
