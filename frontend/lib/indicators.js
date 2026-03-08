export function calculateIndicators(ohlcv) {
  // ohlcv = [{ time, open, high, low, close, volume }, ...]
  return ohlcv.map((row, i, arr) => {
    const closes  = arr.slice(0, i + 1).map(r => r.close);
    const volumes = arr.slice(0, i + 1).map(r => r.volume);

    // Moving averages
    const ma20  = i >= 19  ? avg(closes.slice(-20))  : null;
    const ma50  = i >= 49  ? avg(closes.slice(-50))  : null;
    const ma200 = i >= 199 ? avg(closes.slice(-200)) : null;

    // ATR — True Range
    const prevClose = i > 0 ? arr[i - 1].close : row.close;
    const trueRange = Math.max(
      row.high - row.low,
      Math.abs(row.high - prevClose),
      Math.abs(row.low  - prevClose)
    );
    const atr14 = i >= 13
      ? avg(arr.slice(i - 13, i + 1).map((r, j, s) => {
          const pc = j > 0 ? s[j-1].close : r.close;
          return Math.max(r.high-r.low, Math.abs(r.high-pc), Math.abs(r.low-pc));
        }))
      : null;

    // Returns
    const ret1d  = i >= 1  ? (row.close - arr[i-1].close)  / arr[i-1].close  : null;
    const ret5d  = i >= 5  ? (row.close - arr[i-5].close)  / arr[i-5].close  : null;
    const ret20d = i >= 20 ? (row.close - arr[i-20].close) / arr[i-20].close : null;

    // Volume spike
    const volMa20   = i >= 19 ? avg(volumes.slice(-20)) : null;
    const volMax5   = i >= 4  ? Math.max(...volumes.slice(-5)) : null;
    const volSpike  = volMa20 && volMax5 ? volMax5 > 1.5 * volMa20 : false;

    // Momentum
    const momentumScore = (ret1d != null ? Math.sign(ret1d) : 0)
                        + (ret20d != null ? Math.sign(ret20d) : 0);
    const bias = momentumScore >= 2  ? 'STRONG BULLISH'
               : momentumScore <= -2 ? 'STRONG BEARISH'
               : 'NEUTRAL';

    return { ...row, ma20, ma50, ma200, atr14, ret1d, ret5d, ret20d,
             volMa20, volSpike, momentumScore, bias };
  });
}

export function computeGlobalRisk({ sp500Ret, tltToday, tltPrev, uupToday, uupPrev }) {
  const spSignal     = sp500Ret > 0 ? 1 : -1;
  const yieldSignal  = tltToday > tltPrev ? 1 : -1;  // TLT up = yields falling = EASING
  const dollarSignal = uupToday < uupPrev ? 1 : -1;  // Weak dollar = good for EM
  const score = spSignal + yieldSignal + dollarSignal;
  const label = score >= 2 ? 'RISK ON' : score <= -2 ? 'RISK OFF' : 'NEUTRAL';
  return { label, score, liquidity: yieldSignal === 1 ? 'EASING' : 'TIGHTENING' };
}

export function computeIndiaSignal({ niftyRet, fiiNetPositive, vix }) {
  const score = (niftyRet > 0 ? 1 : -1)
              + (fiiNetPositive ? 1 : -1)
              + (vix < 20 ? 1 : -1);
  const label = score >= 2 ? 'STRONG' : score <= -2 ? 'WEAK' : 'RANGE';
  return { label, score };
}

export function computeTradeSignal({ globalRisk, indiaBias, stockBias, lastClose, atr }) {
  let decision;
  if (stockBias === 'STRONG BULLISH' && (indiaBias === 'STRONG' || indiaBias === 'RANGE') && globalRisk !== 'RISK OFF') {
    decision = 'BUY TODAY';
  } else if (stockBias === 'STRONG BEARISH' && indiaBias === 'WEAK') {
    decision = 'SELL TODAY';
  } else {
    decision = 'WATCHLIST';
  }
  const stopLoss = +(lastClose - 1.5 * atr).toFixed(2);
  const target   = +(lastClose + 3.0 * atr).toFixed(2);
  const rr       = stopLoss !== lastClose ? +((target - lastClose) / (lastClose - stopLoss)).toFixed(2) : 0;
  return { decision, entry: lastClose, stopLoss, target, riskReward: rr };
}

function avg(arr) {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}
