from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import threading

from routers import market, stock, screener, news, trade, seasonal, contracts, sector_rotation, config


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-warm NSE symbol list cache on startup (non-blocking)
    def _prewarm():
        try:
            from services.nse_symbols import get_all_nse_symbols
            syms = get_all_nse_symbols()
            print(f"[startup] Symbol list ready: {len(syms)} NSE EQ symbols")
        except Exception as e:
            print(f"[startup] Symbol pre-warm failed: {e}")
    threading.Thread(target=_prewarm, daemon=True).start()
    yield


app = FastAPI(title="NSE Trading Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router, prefix="/api")
app.include_router(stock.router, prefix="/api")
app.include_router(screener.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(trade.router, prefix="/api")
app.include_router(seasonal.router, prefix="/api")
app.include_router(contracts.router, prefix="/api")
app.include_router(sector_rotation.router, prefix="/api")
app.include_router(config.router, prefix="/api")

@app.get("/api/ping")
def ping():
    return {"status": "alive"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
