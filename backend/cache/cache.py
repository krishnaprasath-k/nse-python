import json
import time
import os
import hashlib

CACHE_DIR = ".cache"
os.makedirs(CACHE_DIR, exist_ok=True)

def _key_to_path(key: str) -> str:
    safe = hashlib.md5(key.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"{safe}.json")

def get_cache(key: str, ttl_seconds: int = 300):
    path = _key_to_path(key)
    if os.path.exists(path):
        if time.time() - os.path.getmtime(path) < ttl_seconds:
            with open(path) as f:
                return json.load(f)
    return None

def set_cache(key: str, data):
    with open(_key_to_path(key), "w") as f:
        json.dump(data, f, default=str)
