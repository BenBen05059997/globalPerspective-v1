'use strict';

// Prices for the DeepSeek estimate (prices.json, operator-owned). Pure functions.

/** The price entry for a model on a day: the latest entry with validFrom <= day, else the earliest entry; null for an unknown model. */
function priceFor(prices, model, day) {
  const list = (prices.prices || []).filter((p) => p.model === model || (p.aliases || []).includes(model));
  if (!list.length) return null;
  list.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const inForce = list.filter((p) => p.validFrom <= day);
  return inForce.length ? inForce[inForce.length - 1] : list[0];
}

/** True when the UTC hour (ISO timestamp of the hour) is in DeepSeek's peak window. */
function isPeak(prices, hourIso) {
  const d = new Date(hourIso);
  const peak = prices.peak || {};
  return (peak.daysUtc || []).includes(d.getUTCDay()) && (peak.hoursUtc || []).includes(d.getUTCHours());
}

/**
 * USD for one usage group (tokens summed over one hour): cache-hit input at the hit price, the rest of the input at the
 * input price, output at the output price. null when the model has no price (it is listed as unpriced, never zero).
 * promptTokens includes the cache hits (DeepSeek reports prompt_tokens = hit + miss).
 */
function usageUsd(prices, { model, hourIso, promptTokens, completionTokens, cacheHitTokens }) {
  const p = priceFor(prices, model, hourIso.slice(0, 10));
  if (!p) return null;
  const rate = isPeak(prices, hourIso) ? p.peak : p.offPeak;
  const hit = Math.min(cacheHitTokens || 0, promptTokens || 0);
  return ((hit * rate.cacheHit) + (((promptTokens || 0) - hit) * rate.in) + ((completionTokens || 0) * rate.out)) / 1e6;
}

const round = (n, places = 4) => (n == null ? null : Math.round(n * 10 ** places) / 10 ** places);

module.exports = { priceFor, isPeak, usageUsd, round };
