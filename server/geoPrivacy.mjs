/**
 * World Pulse privacy-first geographic primitives (#6).
 *
 * This module intentionally contains no IP parsing, per-person coordinates,
 * GPS, city or postal-code handling. It is NOT connected to production.
 *
 * Source: Vercel geo headers are estimates derived from the request IP.
 * Only a trusted Vercel Function should pass these values. Do NOT accept
 * this metadata in client JSON or honor incoming Cloudflare cf-* headers.
 */

export const UNKNOWN_COUNTRY = 'ZZ';
export const SUPPRESSED_COUNTRIES = 'OTHER';
export const MIN_PUBLISHED_COUNTRY_GROUP = 5;

/**
 * The caller must explicitly attest to a trusted infrastructure source.
 * A proxy can cause Vercel to geolocate the proxy, so country provenance
 * alone never proves a visitor's actual location.
 */
export function approximateCountryFromHeaders(headers, { trustedEdge = false, proxyInFront = false } = {}) {
  if (!trustedEdge || proxyInFront) return {
    countryCode: UNKNOWN_COUNTRY,
    source: 'unverified',
    granularity: 'unknown'
  };
  const value = headers?.['x-vercel-ip-country'];
  const country = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(country) || country === UNKNOWN_COUNTRY) return {
    countryCode: UNKNOWN_COUNTRY,
    source: 'vercel-ip-estimate',
    granularity: 'unknown'
  };
  // No city, exact lat/lon, region or postal code is returned, even if sent.
  return { countryCode: country, source: 'vercel-ip-estimate', granularity: 'country' };
}

function validTag(tag) {
  return typeof tag === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tag);
}

/**
 * Aggregate an ALREADY distinct-counted set of active sessions by tag/country.
 * One row must represent an aggregate, NOT a visitor record.
 *
 * All country buckets with fewer than k active sessions are pooled in OTHER.
 * ZZ is independent and represents data with NO reliable geography.
 * This never returns individual identifiers or locations.
 *
 * No k-anonymity proof is claimed: differences across successive snapshots
 * may still enable inference. A public API must also coarsen timestamps,
 * rate-limit requests and enforce spatial/general privacy at DB level.
 */
export function suppressSmallCountryGroups(rows, minGroup = MIN_PUBLISHED_COUNTRY_GROUP) {
  if (!Number.isSafeInteger(minGroup) || minGroup < MIN_PUBLISHED_COUNTRY_GROUP || minGroup > 10000) {
    throw new RangeError('Country privacy threshold cannot be lowered');
  }
  if (!Array.isArray(rows)) throw new RangeError('Invalid aggregate rows');
  const tags = new Map();
  for (const row of rows) {
    const { tagId, countryCode, activeParticipants } = row ?? {};
    if (!validTag(tagId) || !Number.isSafeInteger(activeParticipants) || activeParticipants < 0 ||
      typeof countryCode !== 'string' ||
      !(/^[A-Z]{2}$/.test(countryCode) || countryCode === SUPPRESSED_COUNTRIES)) {
      throw new RangeError('Input must be pre-aggregated country counts');
    }
    if (countryCode === SUPPRESSED_COUNTRIES) throw new RangeError('Reserved geography bucket');
    let counts = tags.get(tagId);
    if (!counts) { counts = new Map(); tags.set(tagId,counts); }
    const next = (counts.get(countryCode) ?? 0) + activeParticipants;
    if (!Number.isSafeInteger(next)) throw new RangeError('Participant count overflow');
    counts.set(countryCode,next);
  }
  const output = [];
  for (const [tagId, countries] of tags) {
    const buckets = [];
    let suppressed = 0, totalActiveParticipants = 0;
    for (const [countryCode, activeParticipants] of countries) {
      totalActiveParticipants += activeParticipants;
      if (!Number.isSafeInteger(totalActiveParticipants)) throw new RangeError('Participant count overflow');
      if (activeParticipants === 0) continue;
      if (countryCode === UNKNOWN_COUNTRY) {
        // "Unknown" is a factual absence of geo, never a fake country.
        buckets.push({ countryCode, activeParticipants });
      } else if (activeParticipants < minGroup) {
        suppressed += activeParticipants;
      } else {
        buckets.push({ countryCode, activeParticipants });
      }
    }
    if (suppressed) buckets.push({ countryCode: SUPPRESSED_COUNTRIES, activeParticipants: suppressed });
    buckets.sort((a,b)=>b.activeParticipants-a.activeParticipants || a.countryCode.localeCompare(b.countryCode));
    output.push({
      tagId,
      totalActiveParticipants,
      regions: buckets,
      geography: 'country_or_suppressed',
      approximate: true
    });
  }
  return output.sort((a,b)=>a.tagId.localeCompare(b.tagId));
}
