import React, { useState } from "react";

export function ParamField({
  label,
  tooltip,
  value,
  defaultValue,
  type = "number",
  step = 1,
  options = [],
  onChange,
  onReset,
  isChanged,
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const renderInput = () => {
    switch (type) {
      case "number":
        return (
          <div className="param-field-number-group">
            <input
              type="range"
              min={typeof step === "number" && step < 1 ? -10 : -100}
              max={typeof step === "number" && step < 1 ? 10 : 100}
              step={step}
              value={value ?? 0}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              className="param-field-slider"
            />
            <input
              type="number"
              step={step}
              value={value ?? 0}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
              className="param-field-input"
            />
          </div>
        );

      case "boolean":
        return (
          <label className="param-field-toggle">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="param-field-toggle-track">
              <span className="param-field-toggle-thumb" />
            </span>
            <span className="param-field-toggle-label">
              {value ? "ON" : "OFF"}
            </span>
          </label>
        );

      case "select":
        return (
          <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="param-field-select"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "tags":
        return (
          <TagInput
            tags={Array.isArray(value) ? value : []}
            onChange={onChange}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="param-field-input"
          />
        );
    }
  };

  return (
    <div className={`param-field ${isChanged ? "param-field-changed" : ""}`}>
      <div className="param-field-header">
        <div className="param-field-label-row">
          <label className="param-field-label">{label}</label>
          {tooltip && (
            <span
              className="param-field-info"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              ℹ️
              {showTooltip && (
                <div className="param-field-tooltip">{tooltip}</div>
              )}
            </span>
          )}
        </div>
        <div className="param-field-meta">
          <span className="param-field-default">
            Default: {JSON.stringify(defaultValue)}
          </span>
          {isChanged && (
            <button
              onClick={onReset}
              className="param-field-reset"
              title="Reset to default"
            >
              ↺
            </button>
          )}
        </div>
      </div>
      {renderInput()}
    </div>
  );
}

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInput("");
    }
  };

  const removeTag = (tag) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="tag-input-container">
      <div className="tag-input-tags">
        {tags.map((tag) => (
          <span key={tag} className="tag-input-chip">
            {tag}
            <button onClick={() => removeTag(tag)} className="tag-input-remove">
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="tag-input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
          placeholder="Add value..."
          className="param-field-input tag-input-field"
        />
        <button onClick={addTag} className="tag-input-add">+</button>
      </div>
    </div>
  );
}
