import math
from fastapi import APIRouter, Query
import yfinance as yf
import pandas as pd
from datetime import datetime
from cache.cache import get_cache, set_cache
from services.yfinance_service import _flatten_yf_download, _safe_float
from services.universe_builder import (
    get_build_state, trigger_build_if_needed,
    ANNUAL_CACHE_KEY, ANNUAL_CACHE_TTL,
)

router = APIRouter()


@router.get("/seasonal/market/current-month-top")
def get_current_month_top() -> dict:
    cache_key = "seasonal_current_month_top"
    cached = get_cache(cache_key, 86400)
    if cached: return cached

    try:
        from services.nse_symbols import get_all_nse_symbols
        # Get top 200 to have a good mix
        symbols = get_all_nse_symbols()[:200]
        tickers = [s["ticker"] for s in symbols]
        meta = {s["ticker"]: {"name": s["name"], "sector": s["sector"]} for s in symbols}

        df = yf.download(tickers, period="10y", auto_adjust=True, progress=False, threads=True)
        # Avoid multi-level index issues if possible
        if isinstance(df.columns, pd.MultiIndex) and 'Close' in df.columns.levels[0]:
            closes = df['Close']
        else:
            closes = df

        current_month = datetime.now().month
        current_month_name = datetime.now().strftime("%B")

        results = []
        for t in tickers:
            try:
                if t not in closes.columns:
                    continue
                c = closes[t].dropna()
                if c.empty: continue

                monthly_close = c.resample("ME").last()
                monthly_return = monthly_close.pct_change() * 100
                monthly_return = monthly_return.dropna()

                cm_returns = monthly_return[monthly_return.index.month == current_month]
                if len(cm_returns) < 5:
                    continue  # need at least 5 years of data

                win_rate = round(float((cm_returns > 0).mean()) * 100, 1)
                avg_return = round(float(cm_returns.mean()), 2)

                results.append({
                    "ticker": t,
                    "name": meta[t]["name"].replace("Limited", "").replace("LTD", "").strip(),
                    "win_rate": win_rate,
                    "avg_return": avg_return,
                    "years": len(cm_returns)
                })
            except Exception as e:
                pass
        
        results.sort(key=lambda x: (x["win_rate"], x["avg_return"]), reverse=True)
        
        # Partition into top performers and worst performers
        top_performers = [r for r in results if r["win_rate"] >= 70][:20]
        worst_performers = sorted([r for r in results if r["win_rate"] <= 30], key=lambda x: (x["win_rate"], x["avg_return"]))[:20]

        res = {
            "current_month": current_month_name,
            "top_performers": top_performers,
            "worst_performers": worst_performers,
            "total_analyzed": len(results)
        }
        set_cache(cache_key, res)
        return res
    except Exception as e:
        print(e)
        return {}


@router.get("/seasonal/market/previous-year/status")
def get_universe_build_status() -> dict:
    return get_build_state()


@router.get("/seasonal/market/previous-year")
def get_previous_year_performance(
    year: int = Query(2025),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    sort: str = Query("return"),    # return | name | sector
    order: str = Query("desc"),     # asc | desc
    filter: str = Query("all"),     # all | positive | negative
    sector: str = Query(""),
    search: str = Query(""),
) -> dict:
    cache_key = ANNUAL_CACHE_KEY.format(year=year)
    full_data = get_cache(cache_key, ANNUAL_CACHE_TTL)
    state = get_build_state()

    if full_data is None:
        # Trigger build if not already running
        trigger_build_if_needed(year)
        current_state = get_build_state()
        return {
            "year": year,
            "status": current_state["status"] if current_state["status"] == "building" else "building",
            "progress": current_state["progress"],
            "total": 0,
            "page": page,
            "limit": limit,
            "total_pages": 0,
            "stocks": [],
            "summary": {},
        }

    # Data ready — apply filters
    stocks = list(full_data["stocks"])

    if filter == "positive":
        stocks = [s for s in stocks if s["is_positive"]]
    elif filter == "negative":
        stocks = [s for s in stocks if not s["is_positive"]]

    if sector:
        stocks = [s for s in stocks if s.get("sector", "").lower() == sector.lower()]

    if search:
        q = search.lower()
        stocks = [s for s in stocks if q in s["name"].lower() or q in s["ticker"].lower()]

    # Sort
    reverse = (order == "desc")
    if sort == "return":
        stocks.sort(key=lambda x: x["annual_return"], reverse=reverse)
    elif sort == "name":
        stocks.sort(key=lambda x: x["name"].lower(), reverse=reverse)
    elif sort == "sector":
        stocks.sort(key=lambda x: x.get("sector", "").lower(), reverse=reverse)

    # Paginate
    total = len(stocks)
    total_pages = max(1, math.ceil(total / limit))
    page = min(page, total_pages)
    offset = (page - 1) * limit
    page_stocks = stocks[offset: offset + limit]

    # Summary over all filtered stocks
    positives = sum(1 for s in stocks if s["is_positive"])
    avg_return = round(sum(s["annual_return"] for s in stocks) / total, 2) if total else 0

    return {
        "year": year,
        "status": "ready",
        "progress": 100,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "stocks": page_stocks,
        "summary": {
            "positive_count": positives,
            "negative_count": total - positives,
            "avg_return": avg_return,
        },
    }


@router.get("/seasonal/{ticker}")
def get_seasonal_analysis(ticker: str) -> dict:
    cache_key = f"seasonal_{ticker}"
    cached = get_cache(cache_key, 86400)
    if cached: return cached

    try:
        # Load config
        from routers.config import load_config
        cfg = load_config()
        s_cfg = cfg.get("seasonal", {})
        data_years = s_cfg.get("years", 10)
        rising_wr = s_cfg.get("rising_win_rate", 60)
        falling_wr = s_cfg.get("falling_win_rate", 40)
        pre_buy_th = s_cfg.get("pre_result_buy_threshold", 65)
        pre_avoid_th = s_cfg.get("pre_result_avoid_threshold", 35)
        pre_result_days = s_cfg.get("pre_result_days", 10)

        # ── Fetch Data ───────────────────────────────────────────
        df = yf.download(ticker, period=f"{data_years}y", progress=False, auto_adjust=True, multi_level_index=False)
        df = _flatten_yf_download(df, ticker)
        if df is None or df.empty:
            df = yf.Ticker(ticker).history(period="10y", auto_adjust=True)
            if df is None or df.empty:
                return {}

        df = df[["Close"]].copy()

        # ── Part 1: Monthly Win Rate (month-end to month-end) ────
        monthly_close = df["Close"].resample("ME").last()
        monthly_return = monthly_close.pct_change() * 100
        monthly_return = monthly_return.dropna()

        # Build monthly DataFrame for analysis
        monthly = pd.DataFrame({
            "return": monthly_return,
            "month_num": monthly_return.index.month,
            "month_name": monthly_return.index.strftime("%b"),
            "year": monthly_return.index.year,
            "positive": monthly_return > 0,
        })

        month_order = ["Jan","Feb","Mar","Apr","May","Jun",
                       "Jul","Aug","Sep","Oct","Nov","Dec"]

        monthly_summary = []
        for m_num, m_name in enumerate(month_order, 1):
            rows = monthly[monthly["month_num"] == m_num]
            if len(rows) == 0:
                continue
            avg_ret  = round(rows["return"].mean(), 2)
            win_rate = round(rows["positive"].mean() * 100, 1)
            best     = round(rows["return"].max(), 2)
            worst    = round(rows["return"].min(), 2)
            signal   = "RISING"  if win_rate >= rising_wr else \
                       "FALLING" if win_rate <= falling_wr else "MIXED"

            monthly_summary.append({
                "month":      m_name,
                "month_num":  m_num,
                "avg_return": avg_ret,
                "win_rate":   win_rate,
                "best_year":  best,
                "worst_year": worst,
                "years_data": len(rows),
                "signal":     signal,
                "is_current": m_num == datetime.now().month,
            })

        # ── Part 2: Current Month Historical Detail ──────────────
        current_month = datetime.now().month
        current_month_name = datetime.now().strftime("%B")
        current_month_rows = monthly[monthly["month_num"] == current_month]

        year_by_year = []
        for _, row in current_month_rows.iterrows():
            year_by_year.append({
                "year":    int(row["year"]),
                "return":  round(row["return"], 2),
                "result":  "UP" if row["return"] > 0 else "DOWN",
            })
        year_by_year.sort(key=lambda x: x["year"], reverse=True)

        # ── Part 3: Day-by-Day Trading Pattern ───────────────────
        df["daily_return"] = df["Close"].pct_change() * 100
        df["month"] = df.index.month
        df["year"] = df.index.year
        df["year_month"] = df.index.to_period("M")

        # Number each trading day within its month (1-based)
        df["trading_day"] = df.groupby("year_month").cumcount() + 1

        max_trading_day = min(int(df["trading_day"].max()), 23)

        # Current month specific daily pattern
        cm_df = df[df["month"] == current_month]
        current_month_daily = []
        for day_num in range(1, max_trading_day + 1):
            day_rows = cm_df[cm_df["trading_day"] == day_num]["daily_return"].dropna()
            if len(day_rows) < 3:
                continue
            current_month_daily.append({
                "trading_day": day_num,
                "avg_return": round(float(day_rows.mean()), 4),
                "win_rate": round(float((day_rows > 0).mean()) * 100, 1),
                "sample_size": len(day_rows),
            })

        # ── Part 4: Decision Verdict ─────────────────────────────
        cm_summary = [m for m in monthly_summary if m["is_current"]]
        if cm_summary:
            cm_data = cm_summary[0]
            cm_wr = cm_data["win_rate"]
            cm_avg = cm_data["avg_return"]
            years_positive = sum(1 for y in year_by_year if y["result"] == "UP")
            years_total = len(year_by_year)

            if cm_wr >= rising_wr and cm_avg > 0:
                verdict = "HISTORICALLY BULLISH"
            elif cm_wr <= falling_wr and cm_avg < 0:
                verdict = "HISTORICALLY BEARISH"
            else:
                verdict = "NO CLEAR EDGE"

            confidence = f"{years_positive} out of {years_total} years, {current_month_name} was positive"

            # Find best period within month
            best_period = ""
            if current_month_daily:
                # Group into first half / second half
                first_half = [d for d in current_month_daily if d["trading_day"] <= 10]
                second_half = [d for d in current_month_daily if d["trading_day"] > 10]
                first_avg_wr = sum(d["win_rate"] for d in first_half) / len(first_half) if first_half else 50
                second_avg_wr = sum(d["win_rate"] for d in second_half) / len(second_half) if second_half else 50

                if first_avg_wr > second_avg_wr + 5:
                    best_period = "First half of month tends to be stronger"
                elif second_avg_wr > first_avg_wr + 5:
                    best_period = "Second half of month tends to be stronger"
                else:
                    best_period = "No significant intra-month bias"
        else:
            verdict = "INSUFFICIENT DATA"
            confidence = "Not enough data for current month"
            best_period = ""

        # ── Part 5: Pre-Result Pattern ───────────────────────────
        pre_result_data = []
        try:
            t = yf.Ticker(ticker)
            earnings = t.earnings_dates
            if earnings is not None:
                past_earnings = earnings[earnings.index < pd.Timestamp.now(tz='UTC')]

                for result_date in list(past_earnings.index)[:16]:  # last 16 quarters
                    start = result_date - pd.Timedelta(days=pre_result_days)
                    end   = result_date

                    window = df.loc[
                        (df.index >= start) & (df.index <= end)
                    ]["Close"]

                    if len(window) >= 5:
                        entry_price = float(window.iloc[0])
                        exit_price  = float(window.iloc[-1])
                        pre_ret     = round(((exit_price - entry_price) / entry_price) * 100, 2)

                        pre_result_data.append({
                            "date":       str(result_date.date()),
                            "pre_return": pre_ret,
                            "direction":  "UP" if pre_ret > 0 else "DOWN",
                            "quarter":    f"Q{((result_date.month - 1) // 3) + 1} {result_date.year}",
                        })
        except Exception as e:
            print(f"Pre-result error: {e}")

        pre_result_win_rate = 0
        pre_result_avg      = 0
        pre_result_signal   = "INSUFFICIENT DATA"
        if pre_result_data:
            ups = sum(1 for x in pre_result_data if x["direction"] == "UP")
            pre_result_win_rate = round((ups / len(pre_result_data)) * 100, 1)
            pre_result_avg      = round(sum(x["pre_return"] for x in pre_result_data) / len(pre_result_data), 2)
            pre_result_signal   = "BUY BEFORE RESULT"   if pre_result_win_rate >= pre_buy_th and pre_result_avg > 1 else \
                                  "AVOID BEFORE RESULT"  if pre_result_win_rate <= pre_avoid_th else \
                                  "MIXED - NO CLEAR EDGE"

        # ── Part 6: Weekly Pattern ───────────────────────────────
        df_weekly = df.copy()
        df_weekly["dow"]     = df_weekly.index.dayofweek  # 0=Mon, 4=Fri
        df_weekly["dow_name"]= df_weekly.index.strftime("%A")

        day_names = ["Monday","Tuesday","Wednesday","Thursday","Friday"]
        weekly_pattern = []
        for i, day in enumerate(day_names):
            day_rows = df_weekly[df_weekly["dow"] == i]["daily_return"].dropna()
            if len(day_rows) > 0:
                weekly_pattern.append({
                    "day":        day,
                    "avg_return": round(float(day_rows.mean()), 3),
                    "win_rate":   round(float((day_rows > 0).mean()) * 100, 1),
                })

        res = {
            "ticker":              ticker,
            "monthly_pattern":     monthly_summary,
            "current_month":       current_month_name,
            "current_month_detail": year_by_year,
            "current_month_daily": current_month_daily,
            "verdict": {
                "signal":     verdict,
                "confidence": confidence,
                "best_period": best_period,
            },
            "pre_result_pattern":  {
                "events":     pre_result_data[:12],
                "win_rate":   pre_result_win_rate,
                "avg_return": pre_result_avg,
                "signal":     pre_result_signal,
                "sample":     len(pre_result_data),
            },
            "weekly_pattern":      weekly_pattern,
            "data_years":          data_years,
        }
        set_cache(cache_key, res)
        return res
    except Exception as e:
        print(f"Error in seasonal: {e}")
        return {}
