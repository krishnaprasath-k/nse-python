from fastapi import APIRouter
import yfinance as yf
import pandas as pd
from datetime import datetime
from cache.cache import get_cache, set_cache
from services.yfinance_service import _flatten_yf_download

router = APIRouter()

@router.get("/seasonal/{ticker}")
def get_seasonal_analysis(ticker: str) -> dict:
    cache_key = f"seasonal_{ticker}"
    cached = get_cache(cache_key, 86400)
    if cached: return cached

    try:
        # ── Part 1: Monthly Win Rate (last 10 years) ──────────────────────────
        df = yf.download(ticker, period="10y", progress=False, auto_adjust=True, multi_level_index=False)
        df = _flatten_yf_download(df, ticker)
        if df is None or df.empty:
            # Fallback: use Ticker.history()
            df = yf.Ticker(ticker).history(period="10y")
            if df is None or df.empty:
                return {}
        
        df = df[["Close"]].copy()
        
        # Monthly returns
        monthly = df["Close"].resample("ME").agg(["first", "last"])
        monthly["return"]     = ((monthly["last"] - monthly["first"]) / monthly["first"]) * 100
        monthly["month_num"]  = monthly.index.month
        monthly["month_name"] = monthly.index.strftime("%b")
        monthly["year"]       = monthly.index.year
        monthly["positive"]   = monthly["return"] > 0
        
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
            signal   = "RISING"  if win_rate >= 60 else \
                       "FALLING" if win_rate <= 40 else "MIXED"
            
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
        
        # ── Part 2: Current Month Historical Detail ───────────────────────────
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
        
        # ── Part 3: Pre-Result Pattern ────────────────────────────────────────
        pre_result_data = []
        try:
            t = yf.Ticker(ticker)
            earnings = t.earnings_dates
            if earnings is not None:
                past_earnings = earnings[earnings.index < pd.Timestamp.now(tz='UTC')]
                
                for result_date in list(past_earnings.index)[:16]:  # last 16 quarters
                    # Get 10 trading days before result
                    start = result_date - pd.Timedelta(days=15)
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
            pre_result_signal   = "BUY BEFORE RESULT"   if pre_result_win_rate >= 65 and pre_result_avg > 1 else \
                                  "AVOID BEFORE RESULT"  if pre_result_win_rate <= 35 else \
                                  "MIXED - NO CLEAR EDGE"
        
        # ── Part 4: Weekly Pattern ────────────────────────────────────────────
        df_weekly = df.copy()
        df_weekly["dow"]     = df_weekly.index.dayofweek  # 0=Mon, 4=Fri
        df_weekly["dow_name"]= df_weekly.index.strftime("%A")
        df_weekly["daily_ret"]= df_weekly["Close"].pct_change() * 100
        
        day_names = ["Monday","Tuesday","Wednesday","Thursday","Friday"]
        weekly_pattern = []
        for i, day in enumerate(day_names):
            day_rows = df_weekly[df_weekly["dow"] == i]["daily_ret"].dropna()
            if len(day_rows) > 0:
                weekly_pattern.append({
                    "day":        day,
                    "avg_return": round(day_rows.mean(), 3),
                    "win_rate":   round((day_rows > 0).mean() * 100, 1),
                })
        
        res = {
            "ticker":              ticker,
            "monthly_pattern":     monthly_summary,
            "current_month":       current_month_name,
            "current_month_detail": year_by_year,
            "pre_result_pattern":  {
                "events":     pre_result_data[:12],
                "win_rate":   pre_result_win_rate,
                "avg_return": pre_result_avg,
                "signal":     pre_result_signal,
                "sample":     len(pre_result_data),
            },
            "weekly_pattern":      weekly_pattern,
            "data_years":          10,
        }
        set_cache(cache_key, res)
        return res
    except Exception as e:
        print(f"Error in seasonal: {e}")
        return {}
