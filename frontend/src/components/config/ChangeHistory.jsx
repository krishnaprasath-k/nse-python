import React from "react";

export function ChangeHistory({ history, onRollback }) {
  if (!history || history.length === 0) {
    return (
      <div className="change-history">
        <h4 className="change-history-title">🕓 Change History</h4>
        <p className="change-history-empty">No changes yet.</p>
      </div>
    );
  }

  return (
    <div className="change-history">
      <h4 className="change-history-title">🕓 Change History</h4>
      <div className="change-history-list">
        {history.map((entry, i) => {
          const date = new Date(entry.timestamp);
          const timeStr = date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div key={i} className="change-history-entry">
              <div className="change-history-time">{timeStr}</div>
              <div className="change-history-version">
                v{entry.config?.version || "1.0"}
              </div>
              <button
                onClick={() => onRollback(i)}
                className="change-history-rollback"
                title="Rollback to this version"
              >
                ↺ Restore
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
