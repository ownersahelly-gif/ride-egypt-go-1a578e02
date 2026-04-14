import { supabase } from '@/integrations/supabase/client';
import type { ParsedLink, OrderedStop } from './types';

/** Safely decode URL text without crashing on malformed input */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value.replace(/\+/g, ' ');
  }
}

function normalizeSegment(seg: string): string {
  return safeDecode(seg)
    .replace(/^[(/\s]+|[)/\s]+$/g, '')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .trim();
}

function parseCoordinateSegment(seg: string): { lat: number; lng: number } | null {
  const normalized = normalizeSegment(seg);
  const coordMatch = normalized.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (!coordMatch) return null;

  return {
    lat: parseFloat(coordMatch[1]),
    lng: parseFloat(coordMatch[2]),
  };
}

function extractDataCoordinates(url: string): { lat: number; lng: number }[] {
  const coords: { lat: number; lng: number }[] = [];
  const dataRegex = /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/g;
  let match: RegExpExecArray | null;

  while ((match = dataRegex.exec(url)) !== null) {
    coords.push({ lat: parseFloat(match[1]), lng: parseFloat(match[2]) });
  }

  return coords;
}

/** Use Google Geocoder to resolve a segment (place name or coordinates) */
function resolveSegment(seg: string): Promise<{ lat: number; lng: number; name: string }> {
  return new Promise((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();
    const coord = parseCoordinateSegment(seg);

    if (coord) {
      geocoder.geocode({ location: coord }, (results, status) => {
        const name = status === 'OK' && results?.[0]
          ? results[0].formatted_address
          : `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`;
        resolve({ lat: coord.lat, lng: coord.lng, name });
      });
      return;
    }

    const decoded = normalizeSegment(seg);
    geocoder.geocode({ address: decoded }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng(), name: results[0].formatted_address });
      } else {
        reject(new Error(`Could not find: ${decoded.substring(0, 60)}`));
      }
    });
  });
}

/** Resolve short Google Maps links (maps.app.goo.gl) via edge function */
async function resolveShortLink(url: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('resolve-redirect', {
    body: { url },
  });
  if (error || !data?.resolved) throw new Error('Failed to resolve short link');
  return data.resolved;
}

/** Check if a URL is a short Google Maps link */
function isShortLink(url: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url);
}

/** Parse a Google Maps directions URL and resolve origin/destination via Geocoder */
export async function parseGoogleMapsLink(url: string): Promise<{ origin: { lat: number; lng: number; name: string }; destination: { lat: number; lng: number; name: string } } | null> {
  let resolvedUrl = url;

  if (isShortLink(url)) {
    resolvedUrl = await resolveShortLink(url);
  }

  const dirMatch = resolvedUrl.match(/\/dir\/(.+?)(?:\/@|\/data=|$|\?)/);
  if (!dirMatch) return null;

  const segments = dirMatch[1]
    .split('/')
    .map(normalizeSegment)
    .filter(Boolean);

  const dataCoords = extractDataCoordinates(resolvedUrl);
  const firstPathCoord = segments[0] ? parseCoordinateSegment(segments[0]) : null;
  const lastPathCoord = segments.length > 0 ? parseCoordinateSegment(segments[segments.length - 1]) : null;

  let originRef: string | null = null;
  let destinationRef: string | null = null;

  if (dataCoords.length >= 2) {
    originRef = `${dataCoords[0].lat},${dataCoords[0].lng}`;
    destinationRef = `${dataCoords[dataCoords.length - 1].lat},${dataCoords[dataCoords.length - 1].lng}`;
  } else if (firstPathCoord && dataCoords.length >= 1) {
    originRef = `${firstPathCoord.lat},${firstPathCoord.lng}`;
    destinationRef = `${dataCoords[dataCoords.length - 1].lat},${dataCoords[dataCoords.length - 1].lng}`;
  } else if (firstPathCoord && lastPathCoord) {
    originRef = `${firstPathCoord.lat},${firstPathCoord.lng}`;
    destinationRef = `${lastPathCoord.lat},${lastPathCoord.lng}`;
  } else if (segments.length >= 2) {
    originRef = segments[0];
    destinationRef = segments[segments.length - 1];
  } else {
    return null;
  }

  const origin = await resolveSegment(originRef);
  const destination = await resolveSegment(destinationRef);

  return { origin, destination };
}

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Generate optimized stop order using nearest-neighbor with pickup-before-dropoff constraint */
export function generateOptimizedStops(links: ParsedLink[]): OrderedStop[] {
  const valid = links.filter(l => l.origin && l.destination);
  if (valid.length === 0) return [];

  const allStops: OrderedStop[] = [];
  valid.forEach((l, i) => {
    allStops.push({ lat: l.origin!.lat, lng: l.origin!.lng, name: l.origin!.name, linkIdx: i, type: 'P' });
    allStops.push({ lat: l.destination!.lat, lng: l.destination!.lng, name: l.destination!.name, linkIdx: i, type: 'D' });
  });

  const ordered: OrderedStop[] = [];
  const remaining = new Set(allStops.map((_, i) => i));
  const pickedUp = new Set<number>();

  const pickups = allStops.filter(s => s.type === 'P');
  const cLat = pickups.reduce((s, p) => s + p.lat, 0) / pickups.length;
  const cLng = pickups.reduce((s, p) => s + p.lng, 0) / pickups.length;
  const centroid = { lat: cLat, lng: cLng };

  let firstIdx = -1;
  let firstDist = Infinity;
  for (const i of remaining) {
    const s = allStops[i];
    if (s.type !== 'P') continue;
    const d = haversine(centroid, s);
    if (d < firstDist) { firstDist = d; firstIdx = i; }
  }

  remaining.delete(firstIdx);
  ordered.push(allStops[firstIdx]);
  pickedUp.add(allStops[firstIdx].linkIdx);

  while (remaining.size > 0) {
    const current = ordered[ordered.length - 1];
    let bestIdx = -1;
    let bestDist = Infinity;

    for (const i of remaining) {
      const s = allStops[i];
      if (s.type === 'D' && !pickedUp.has(s.linkIdx)) continue;
      const d = haversine(current, s);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }

    if (bestIdx === -1) break;
    remaining.delete(bestIdx);
    const stop = allStops[bestIdx];
    ordered.push(stop);
    if (stop.type === 'P') pickedUp.add(stop.linkIdx);
  }

  return ordered;
}

/** Build a Google Maps directions URL from ordered stops */
export function buildGoogleMapsLink(stops: OrderedStop[]): string {
  const points = stops.map(s => `${s.lat},${s.lng}`);
  return `https://www.google.com/maps/dir/${points.join('/')}`;
}
