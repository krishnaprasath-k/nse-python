import React, { useState } from "react";

export function FormulaBox({ formula, sheetRef }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="formula-box">
      <button
        onClick={() => setOpen(!open)}
        className="formula-box-toggle"
      >
        <span>📋 Excel Formula ({sheetRef})</span>
        <span className="formula-box-chevron">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <pre className="formula-box-content">
          {formula}
        </pre>
      )}
    </div>
  );
}
