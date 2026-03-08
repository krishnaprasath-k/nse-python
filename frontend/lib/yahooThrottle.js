/**
 * Throttled Yahoo Finance wrapper.
 * - Queues all Yahoo Finance API calls and processes them sequentially
 * - Adds a configurable delay between requests to avoid bursting
 * - Retries on 429 errors with exponential backoff
 */
import yahooFinance from 'yahoo-finance2';

const DELAY_BETWEEN_REQUESTS_MS = 1200; // 1.2s between each Yahoo API call
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 5000; // 5s initial backoff on 429

// Simple queue to serialize all Yahoo Finance requests
let queue = Promise.resolve();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes a Yahoo Finance call with retry logic for 429 errors.
 */
async function withRetry(fn, label = 'yahoo') {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.code === 429 || err?.message?.includes('429') || err?.message?.includes('Too Many Requests');
      if (is429 && attempt < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt); // 5s, 10s, 20s
        console.warn(`[THROTTLE] 429 on "${label}" — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
}

/**
 * Enqueue a Yahoo Finance call to run sequentially with delay.
 */
function enqueue(fn, label) {
  const task = queue.then(async () => {
    const result = await withRetry(fn, label);
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
    return result;
  });
  // Update the queue chain, but swallow errors so future tasks still run
  queue = task.catch(() => {});
  return task;
}

/**
 * Throttled yahoo-finance2 `.quote()` wrapper.
 * Supports single ticker (string) or array of tickers.
 */
export function throttledQuote(ticker) {
  const label = `quote(${Array.isArray(ticker) ? ticker.length + ' tickers' : ticker})`;
  return enqueue(() => yahooFinance.quote(ticker, {}, { validateResult: false }), label);
}

/**
 * Throttled yahoo-finance2 `.historical()` wrapper.
 */
export function throttledHistorical(ticker, options) {
  const label = `historical(${ticker})`;
  return enqueue(() => yahooFinance.historical(ticker, options, { validateResult: false }), label);
}

export default {
  quote: throttledQuote,
  historical: throttledHistorical,
};
