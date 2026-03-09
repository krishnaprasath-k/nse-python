from fastapi import APIRouter
from services.yfinance_service import get_indices
from services.nse_service import nse_service
from services.indicators import compute_global_risk_signal, compute_india_signal
from datetime import datetime

router = APIRouter()

@router.get("/market")
def get_market_data():
    indices = get_indices()
    status = nse_service.get_market_status()
    fii_dii = nse_service.get_fii_dii()
    
    sp500 = indices.get("^GSPC", {"price": 0, "change_pct": 0, "prev": 0})
    uup = indices.get("UUP", {"price": 0, "change_pct": 0, "prev": 0})
    tlt = indices.get("TLT", {"price": 0, "change_pct": 0, "prev": 0})
    nifty = indices.get("^NSEI", {"price": 0, "change_pct": 0, "prev": 0})
    banknifty = indices.get("^NSEBANK", {"price": 0, "change_pct": 0, "prev": 0})
    india_vix = indices.get("^INDIAVIX", {"price": 0, "change_pct": 0, "prev": 0})
    nasdaq = indices.get("^IXIC", {"price": 0, "change_pct": 0})
    crude = indices.get("CL=F", {"price": 0, "change_pct": 0})

    fii_net = fii_dii.get("fii_net", 0)
    fii_net_positive = fii_net > 0

    global_risk_label, risk_score = compute_global_risk_signal(
        sp500_ret=sp500["change_pct"],
        tlt_today=tlt["price"],
        tlt_prev=tlt["prev"],
        uup_today=uup["price"],
        uup_prev=uup["prev"]
    )
    
    india_label, india_score = compute_india_signal(
        nifty_ret=nifty["change_pct"],
        fii_net_positive=fii_net_positive,
        vix=india_vix["price"]
    )
    
    return {
        "global_risk": global_risk_label,
        "risk_score": risk_score,
        "sp500": {"price": sp500["price"], "change_pct": sp500["change_pct"]},
        "nasdaq": {"price": nasdaq["price"], "change_pct": nasdaq["change_pct"]},
        "crude": {"price": crude["price"], "change_pct": crude["change_pct"]},
        "dxy": {"price": uup["price"], "change_pct": uup["change_pct"]},
        "tlt": {
            "price": tlt["price"],
            "yield_direction": "Falling Yield" if tlt["price"] > tlt["prev"] else "Rising Yield"
        },
        "liquidity": "EASING" if tlt["price"] > tlt["prev"] else "TIGHTENING",
        "nifty": {"price": nifty["price"], "change_pct": nifty["change_pct"]},
        "banknifty": {"price": banknifty["price"], "change_pct": banknifty["change_pct"]},
        "india_vix": india_vix["price"],
        "india_bias": india_label,
        "india_score": india_score,
        "fii_net": fii_net,
        "updated_at": datetime.utcnow().isoformat()
    }

@router.get("/market/status")
def get_market_status():
    status = nse_service.get_market_status()
    is_open = False
    try:
        is_open = status.get('marketState', [{}])[0].get('marketStatus', 'Closed').lower() == 'open'
    except:
        pass
    return {"is_open": is_open, "next_open": datetime.utcnow().isoformat()}
