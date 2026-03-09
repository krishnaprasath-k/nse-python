from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from routers import market, stock, screener, news, trade

app = FastAPI(title="NSE Trading Dashboard API")

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

@app.get("/api/ping")
def ping():
    return {"status": "alive"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
