import json
import os
import copy
import glob
from fastapi import APIRouter, HTTPException
from datetime import datetime

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(BASE_DIR, "model_config")
CONFIG_PATH = os.path.join(CONFIG_DIR, "model_config.json")
DEFAULTS_PATH = os.path.join(CONFIG_DIR, "defaults.json")
HISTORY_PATH = os.path.join(CONFIG_DIR, "config_history.json")

os.makedirs(CONFIG_DIR, exist_ok=True)

# ── helpers ──────────────────────────────────────────────────────────

def load_config() -> dict:
    """Load the live model config. Falls back to defaults if missing."""
    try:
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return load_defaults()


def load_defaults() -> dict:
    with open(DEFAULTS_PATH, "r") as f:
        return json.load(f)


def save_config(data: dict):
    data["last_updated"] = datetime.utcnow().isoformat()
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)


def _append_history(config_snapshot: dict):
    """Keep the last 10 config snapshots for rollback."""
    try:
        with open(HISTORY_PATH, "r") as f:
            history = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        history = []

    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "config": copy.deepcopy(config_snapshot),
    }
    history.insert(0, entry)
    history = history[:10]  # keep only last 10

    with open(HISTORY_PATH, "w") as f:
        json.dump(history, f, indent=2, default=str)


def _clear_all_caches():
    """Wipe the file-based cache dir so next API hit recalculates."""
    cache_dir = os.path.join(BASE_DIR, ".cache")
    if os.path.isdir(cache_dir):
        for f in glob.glob(os.path.join(cache_dir, "*.json")):
            try:
                os.remove(f)
            except OSError:
                pass


# ── endpoints ────────────────────────────────────────────────────────

@router.get("/config")
def get_config():
    """Return the current live config."""
    config = load_config()
    defaults = load_defaults()
    
    # Build a diff map so the UI can highlight changed fields
    changed_fields = []
    for section, values in config.items():
        if section in ("version", "last_updated"):
            continue
        if section not in defaults:
            changed_fields.append(section)
            continue
        if isinstance(values, dict):
            for key, val in values.items():
                default_val = defaults.get(section, {}).get(key)
                if val != default_val:
                    changed_fields.append(f"{section}.{key}")
    
    return {
        "config": config,
        "defaults": defaults,
        "changed_fields": changed_fields,
        "has_changes": len(changed_fields) > 0,
    }


@router.put("/config")
def update_config(body: dict):
    """Deep-merge provided sections into the live config and persist."""
    try:
        current = load_config()
        
        # Save current state to history before overwriting
        _append_history(current)

        # Deep merge — only update provided keys
        for section, values in body.items():
            if section in ("version", "last_updated"):
                continue
            if section in current and isinstance(values, dict) and isinstance(current[section], dict):
                current[section].update(values)
            else:
                current[section] = values

        save_config(current)
        _clear_all_caches()

        return {"status": "saved", "config": current}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/reset")
def reset_config():
    """Reset the live config back to Excel-model defaults."""
    try:
        current = load_config()
        _append_history(current)

        defaults = load_defaults()
        save_config(defaults)
        _clear_all_caches()

        return {"status": "reset", "config": defaults}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config/history")
def get_config_history():
    """Return the last 10 saved config snapshots."""
    try:
        with open(HISTORY_PATH, "r") as f:
            history = json.load(f)
        return history
    except (FileNotFoundError, json.JSONDecodeError):
        return []


@router.post("/config/rollback/{index}")
def rollback_config(index: int):
    """Rollback to a specific history entry."""
    try:
        with open(HISTORY_PATH, "r") as f:
            history = json.load(f)
        
        if index < 0 or index >= len(history):
            raise HTTPException(status_code=400, detail="Invalid history index")
        
        # Save current before rolling back
        current = load_config()
        _append_history(current)
        
        target = history[index]["config"]
        save_config(target)
        _clear_all_caches()
        
        return {"status": "rolled_back", "config": target}
    except (FileNotFoundError, json.JSONDecodeError):
        raise HTTPException(status_code=404, detail="No history found")
