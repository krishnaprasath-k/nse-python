import React from "react";

const TABS = [
  { key: "global_macro",   icon: "⚙️",  label: "Global Macro",         subtitle: "Global_Macro sheet" },
  { key: "india_market",   icon: "🇮🇳",  label: "India Market",         subtitle: "India_Market sheet" },
  { key: "universe_score", icon: "📊",  label: "Stock Scoring",         subtitle: "Universe_Stocks · L2 formula" },
  { key: "momentum",       icon: "📈",  label: "Momentum",              subtitle: "INFY_10Y sheet" },
  { key: "technicals",     icon: "🕯️",  label: "Technical Indicators",  subtitle: "MONTHLY_DATA sheet" },
  { key: "action_plan",    icon: "🎬",  label: "Action Plan",           subtitle: "Trade sizing + signal logic", highlight: true },
  { key: "trade_sizing",   icon: "💰",  label: "Trade Sizing",          subtitle: "ATR multipliers" },
  { key: "trade_decision", icon: "🎯",  label: "Trade Decision",        subtitle: "Trade_Dashboard sheet" },
  { key: "ema_timing",     icon: "📅",  label: "EMA Timing",            subtitle: "EMA proximity scoring" },
  { key: "sector_rotation",icon: "🔄",  label: "Sector Rotation",       subtitle: "Sector rotation thresholds" },
  { key: "seasonal",       icon: "🌊",  label: "Seasonal Pattern",      subtitle: "Seasonal pattern config" },
  { key: "contracts",      icon: "🏗️",  label: "Contract Tracker",      subtitle: "Contract filtering" },
  { key: "news_feeds",     icon: "📰",  label: "News Feeds",            subtitle: "RSS sources + limits" },
];

export function ConfigSidebar({ activeTab, onTabChange, hasChanges }) {
  return (
    <div className="config-sidebar">
      <div className="config-sidebar-header">
        <h2 className="config-sidebar-title">
          ⚙️ Configuration
        </h2>
        {hasChanges && (
          <span className="config-changed-dot" title="Some parameters differ from defaults">
            ●
          </span>
        )}
      </div>
      <nav className="config-nav">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`config-nav-btn ${activeTab === tab.key ? "active" : ""} ${tab.highlight ? "highlight" : ""}`}
          >
            <span className="config-nav-icon">{tab.icon}</span>
            <div className="config-nav-text">
              <span className="config-nav-label">{tab.label}</span>
              <span className="config-nav-subtitle">{tab.subtitle}</span>
            </div>
          </button>
        ))}
      </nav>
    </div>
  );
}

export { TABS };
