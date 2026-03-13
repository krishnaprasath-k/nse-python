import gc
import time
import threading
import yfinance as yf
import pandas as pd
from cache.cache import get_cache, set_cache

BATCH_SIZE = 50
BATCH_DELAY = 2.0
ANNUAL_CACHE_KEY = "universe_annual_returns_{year}"
ANNUAL_CACHE_TTL = 86400

_build_lock = threading.Lock()
_build_state = {
    "status": "idle",   # idle | building | ready | error
    "progress": 0,
    "total": 0,
    "processed": 0,
    "started_at": None,
    "error": None,
}


def get_build_state() -> dict:
    with _build_lock:
        return dict(_build_state)


def _update_state(**kwargs):
    with _build_lock:
        _build_state.update(kwargs)


def build_universe_annual_returns(year: int):
    _update_state(status="building", progress=0, total=0, processed=0,
                  started_at=time.time(), error=None)
    try:
        from services.nse_symbols import get_all_nse_symbols
        symbols = get_all_nse_symbols()
        if not symbols:
            _update_state(status="error", error="Failed to fetch symbol list")
            return

        tickers = [s["ticker"] for s in symbols]
        ticker_meta = {s["ticker"]: s for s in symbols}
        _update_state(total=len(tickers))

        results = []
        batches = [tickers[i:i + BATCH_SIZE] for i in range(0, len(tickers), BATCH_SIZE)]
        start_dt = f"{year}-01-01"
        end_dt = f"{year + 1}-01-01"

        for batch_idx, batch in enumerate(batches):
            raw = None
            try:
                raw = yf.download(
                    batch,
                    start=start_dt,
                    end=end_dt,
                    progress=False,
                    auto_adjust=True,
                    threads=True,
                )
                for t in batch:
                    try:
                        if isinstance(raw.columns, pd.MultiIndex):
                            closes = raw["Close"][t].dropna()
                        else:
                            closes = raw["Close"].dropna() if len(batch) == 1 else pd.Series()

                        if closes.empty or len(closes) < 2:
                            continue

                        year_start = float(closes.iloc[0])
                        year_end = float(closes.iloc[-1])
                        if year_start == 0:
                            continue

                        annual_return = round((year_end - year_start) / year_start * 100, 2)
                        meta = ticker_meta.get(t, {})
                        results.append({
                            "ticker": t,
                            "name": meta.get("name", t),
                            "sector": meta.get("sector", "Unknown"),
                            "annual_return": annual_return,
                            "is_positive": annual_return >= 0,
                        })
                    except Exception:
                        pass

            except Exception as e:
                print(f"[universe_builder] Batch {batch_idx} error: {e}")
            finally:
                del raw
                gc.collect()

            processed = min((batch_idx + 1) * BATCH_SIZE, len(tickers))
            progress = int(processed / len(tickers) * 100)
            _update_state(processed=processed, progress=progress)

            time.sleep(BATCH_DELAY)

        results.sort(key=lambda x: x["annual_return"], reverse=True)
        payload = {"year": year, "stocks": results, "total": len(results)}
        set_cache(ANNUAL_CACHE_KEY.format(year=year), payload)
        _update_state(status="ready", progress=100)
        print(f"[universe_builder] Done — {len(results)} stocks for {year}")

    except Exception as e:
        print(f"[universe_builder] Fatal error: {e}")
        _update_state(status="error", error=str(e))


def trigger_build_if_needed(year: int) -> bool:
    """Starts the build in a background thread. Returns True if started."""
    state = get_build_state()
    cache_key = ANNUAL_CACHE_KEY.format(year=year)
    if get_cache(cache_key, ANNUAL_CACHE_TTL) is not None:
        return False  # Already cached
    if state["status"] == "building":
        return False  # Already running
    t = threading.Thread(target=build_universe_annual_returns, args=(year,), daemon=True)
    t.start()
    return True
