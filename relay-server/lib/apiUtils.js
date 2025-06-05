import retry from 'async-retry';
import pThrottle from 'p-throttle';
import { config } from './config.js';
import logger from './logger.js';

// Configurable throttle and retry settings
const RATE_LIMIT = config.API_RATE_LIMIT || 5; // max requests per interval
const RATE_INTERVAL = config.API_RATE_INTERVAL || 1000; // interval in ms
const MAX_RETRIES = config.API_MAX_RETRIES || 3;
const RETRY_MIN_TIMEOUT = config.API_RETRY_MIN_TIMEOUT || 500; // ms

/**
 * Wrap an async function with retry and throttle.
 * @param {Function} fn - The async function to wrap.
 * @param {Object} [opts] - Optional override for retry/throttle settings.
 * @returns {Function} - The wrapped function.
 */
export function withRetryAndThrottle(fn, opts = {}) {
  const throttle = pThrottle({
    limit: opts.rateLimit || RATE_LIMIT,
    interval: opts.rateInterval || RATE_INTERVAL
  });

  // Wrap the function with retry
  const retryingFn = async (...args) => {
    return retry(async (bail, attempt) => {
      try {
        const result = await fn(...args);
        return result;
      } catch (err) {
        logger.warn('API call failed, retrying...', {
          error: err.message,
          attempt
        });
        throw err;
      }
    }, {
      retries: opts.maxRetries || MAX_RETRIES,
      minTimeout: opts.retryMinTimeout || RETRY_MIN_TIMEOUT
    });
  };

  // Return the throttled, retrying function
  return throttle(retryingFn);
} 