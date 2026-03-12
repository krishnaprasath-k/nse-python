import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_BASE = "/api";

export function useConfig() {
  const [config, setConfig] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [changedFields, setChangedFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/config`);
      setConfig(res.data.config);
      setDefaults(res.data.defaults);
      setChangedFields(res.data.changed_fields || []);
      setError(null);
    } catch (err) {
      setError("Failed to load config from backend. Is the server running?");
      console.error("Config fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/config/history`);
      setHistory(res.data || []);
    } catch (err) {
      // Non-critical — just log, don't break the page
      console.warn("Config history fetch failed:", err?.response?.status ?? err.message);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchHistory();
  }, [fetchConfig, fetchHistory]);

  const updateField = useCallback((section, key, value) => {
    setConfig((prev) => {
      if (!prev) return prev; // guard: do nothing if config not loaded yet
      return {
        ...prev,
        [section]: {
          ...(prev[section] || {}),
          [key]: value,
        },
      };
    });
  }, []);

  const resetFieldToDefault = useCallback(
    (section, key) => {
      if (!defaults || !config) return;
      const defaultVal = defaults[section]?.[key];
      if (defaultVal !== undefined) {
        updateField(section, key, defaultVal);
      }
    },
    [defaults, config, updateField]
  );

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const saveConfig = useCallback(async () => {
    if (!config) return;
    try {
      setSaving(true);
      const res = await axios.put(`${API_BASE}/config`, config);
      setConfig(res.data.config);
      showToast("success", "✅ Config saved — cache cleared, new values active immediately");
      fetchHistory();
      fetchConfig();
    } catch (err) {
      showToast("error", `❌ Failed to save config: ${err?.response?.data?.detail ?? err.message}`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [config, fetchConfig, fetchHistory, showToast]);

  const resetConfig = useCallback(async () => {
    try {
      setSaving(true);
      const res = await axios.post(`${API_BASE}/config/reset`);
      setConfig(res.data.config);
      setChangedFields([]);
      showToast("success", "✅ Config reset to Excel defaults");
      fetchHistory();
    } catch (err) {
      showToast("error", "❌ Failed to reset config");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [fetchHistory, showToast]);

  const rollback = useCallback(
    async (index) => {
      try {
        setSaving(true);
        const res = await axios.post(`${API_BASE}/config/rollback/${index}`);
        setConfig(res.data.config);
        showToast("success", "✅ Rolled back successfully");
        fetchHistory();
        fetchConfig();
      } catch (err) {
        showToast("error", "❌ Rollback failed");
        console.error(err);
      } finally {
        setSaving(false);
      }
    },
    [fetchConfig, fetchHistory, showToast]
  );

  const isFieldChanged = useCallback(
    (section, key) => {
      if (!defaults || !config) return false;
      const defVal = defaults[section]?.[key];
      const curVal = config[section]?.[key];
      return JSON.stringify(defVal) !== JSON.stringify(curVal);
    },
    [defaults, config]
  );

  const hasAnyChanges = useCallback(() => {
    if (!defaults || !config) return false;
    // Compare only the config sections (skip version/last_updated)
    for (const section of Object.keys(defaults)) {
      if (section === "version" || section === "last_updated") continue;
      if (JSON.stringify(config[section]) !== JSON.stringify(defaults[section])) {
        return true;
      }
    }
    return false;
  }, [defaults, config]);

  return {
    config,
    defaults,
    changedFields,
    loading,
    saving,
    error,
    toast,
    history,
    updateField,
    resetFieldToDefault,
    saveConfig,
    resetConfig,
    rollback,
    isFieldChanged,
    hasAnyChanges,
    refetch: fetchConfig,
  };
}
