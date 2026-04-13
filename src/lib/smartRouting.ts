/**
 * Smart Shuttle Routing Logic for Cairo
 * Groups users by destination, snaps pickups to main road corridors,
 * and generates efficient stop sequences following real driving logic.
 */

// ─── Geo helpers ──────────────────────────────────────────
const toRad = (d: number) => d * Math.PI / 180;

export const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Distance from point P to the line segment AB (in km). Returns the nearest point on segment too. */
function pointToSegment(pLat: number, pLng: number, aLat: number, aLng: number, bLat: number, bLng: number) {
  const dx = bLat - aLat, dy = bLng - aLng;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((pLat - aLat) * dx + (pLng - aLng) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nearLat = aLat + t * dx;
  const nearLng = aLng + t * dy;
  return { dist: haversine(pLat, pLng, nearLat, nearLng), lat: nearLat, lng: nearLng, t };
}

// ─── Cairo Major Corridors ───────────────────────────────
// Each corridor is an ordered array of waypoints along a major road.
// The routing engine will pick the best corridor for each destination group.

interface Waypoint { lat: number; lng: number; name: string }
interface Corridor { name: string; waypoints: Waypoint[] }

const CAIRO_CORRIDORS: Corridor[] = [
  {
    name: 'Ring Road East (Madinaty → 6 Oct)',
    waypoints: [
      { lat: 30.1070, lng: 31.6370, name: 'Madinaty Gate' },
      { lat: 30.1240, lng: 31.6100, name: 'El Shorouk' },
      { lat: 30.1380, lng: 31.5500, name: 'Obour City' },
      { lat: 30.1250, lng: 31.4400, name: 'Ring Road / Ismailia' },
      { lat: 30.1100, lng: 31.3400, name: 'Ring Road / Autostrad' },
      { lat: 30.0760, lng: 31.2500, name: 'Ring Road / Warraq' },
      { lat: 30.0600, lng: 31.1900, name: 'Ring Road / Mehwar' },
      { lat: 30.0710, lng: 31.0200, name: '26th July Corridor' },
      { lat: 30.0700, lng: 31.0170, name: 'Smart Village' },
    ],
  },
  {
    name: 'Ring Road South (New Cairo → 6 Oct)',
    waypoints: [
      { lat: 30.0300, lng: 31.4700, name: 'New Cairo / AUC' },
      { lat: 30.0100, lng: 31.4100, name: 'Ring Road / Katameya' },
      { lat: 30.0000, lng: 31.3200, name: 'Ring Road / Maadi' },
      { lat: 29.9800, lng: 31.2500, name: 'Ring Road / Giza' },
      { lat: 30.0100, lng: 31.1800, name: 'Ring Road / Faisal' },
      { lat: 30.0600, lng: 31.1900, name: 'Ring Road / Mehwar' },
      { lat: 30.0710, lng: 31.0200, name: '26th July Corridor' },
      { lat: 30.0700, lng: 31.0170, name: 'Smart Village' },
    ],
  },
  {
    name: 'Nasr City → Downtown → Giza',
    waypoints: [
      { lat: 30.0550, lng: 31.3600, name: 'Nasr City' },
      { lat: 30.0450, lng: 31.3200, name: 'Heliopolis' },
      { lat: 30.0500, lng: 31.2600, name: 'Ramses / Downtown' },
      { lat: 30.0400, lng: 31.2100, name: 'Mohandessin' },
      { lat: 30.0250, lng: 31.2000, name: 'Dokki / Giza' },
      { lat: 30.0130, lng: 31.1600, name: 'Haram' },
    ],
  },
  {
    name: 'New Cairo → Nasr City → Downtown',
    waypoints: [
      { lat: 30.0300, lng: 31.4700, name: 'New Cairo / AUC' },
      { lat: 30.0450, lng: 31.4200, name: 'Ring Road / Suez Rd' },
      { lat: 30.0550, lng: 31.3600, name: 'Nasr City' },
      { lat: 30.0500, lng: 31.3100, name: 'Abbasseya' },
      { lat: 30.0500, lng: 31.2600, name: 'Ramses / Downtown' },
    ],
  },
  {
    name: 'Madinaty → Shorouk → New Cairo',
    waypoints: [
      { lat: 30.1070, lng: 31.6370, name: 'Madinaty Gate' },
      { lat: 30.1240, lng: 31.6100, name: 'El Shorouk' },
      { lat: 30.0900, lng: 31.5400, name: 'Badr City' },
      { lat: 30.0500, lng: 31.5000, name: 'Rehab City' },
      { lat: 30.0300, lng: 31.4700, name: 'New Cairo / AUC' },
    ],
  },
  {
    name: '10th of Ramadan → Obour → Ring Road',
    waypoints: [
      { lat: 30.2900, lng: 31.7800, name: '10th of Ramadan' },
      { lat: 30.2200, lng: 31.7100, name: '10th of Ramadan Gate' },
      { lat: 30.1700, lng: 31.6000, name: 'El Shorouk North' },
      { lat: 30.1380, lng: 31.5500, name: 'Obour City' },
      { lat: 30.1250, lng: 31.4400, name: 'Ring Road / Ismailia' },
    ],
  },
  {
    name: '6th October Internal',
    waypoints: [
      { lat: 30.0710, lng: 31.0200, name: '26th July Corridor' },
      { lat: 30.0200, lng: 30.9800, name: '6th October City' },
      { lat: 29.9900, lng: 30.9500, name: 'Sheikh Zayed' },
      { lat: 29.9700, lng: 30.9200, name: 'Beverly Hills / Zayed' },
    ],
  },
];

// ─── Types ─────────────────────────────────────────────
export interface RouteRequest {
  id: string;
  user_id: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  preferred_time?: string | null;
  preferred_days?: number[] | null;
  status: string;
  created_at: string;
}

export interface SmartGroup {
  requests: RouteRequest[];
  originLabel: string;
  destLabel: string;
  corridor: Corridor | null;
}

export interface GeneratedStop {
  lat: number;
  lng: number;
  name: string;
  userCount: number;
  userIds: string[];
  stopType: 'pickup' | 'dropoff' | 'both';
}

export interface GeneratedRoute {
  origin: { lat: number; lng: number; name: string };
  destination: { lat: number; lng: number; name: string };
  stops: GeneratedStop[];
  pickupStops: GeneratedStop[];
  dropoffStops: GeneratedStop[];
  totalDistance: number;
  corridor: Corridor | null;
}

// ─── Grouping: destination-first ──────────────────────
const DEST_THRESHOLD_KM = 8; // group destinations within 8km
const ORIGIN_CLUSTER_KM = 3.5;
const ORIGIN_PROGRESS_GAP = 0.14;
const PICKUP_CLUSTER_KM = 0.1;
const DROPOFF_CLUSTER_KM = 0.1;
const MAX_WALK_TO_STOP_KM = 0.1;
const MIN_CORRIDOR_COVERAGE = 0.6;

export function smartGroupRequests(requests: RouteRequest[]): SmartGroup[] {
  // Dedupe: keep latest request per user
  const latestByUser: Record<string, RouteRequest> = {};
  requests.forEach(rr => {
    if (!latestByUser[rr.user_id] || new Date(rr.created_at) > new Date(latestByUser[rr.user_id].created_at)) {
      latestByUser[rr.user_id] = rr;
    }
  });
  const unique = Object.values(latestByUser);

  // Cluster by destination first
  const destGroups = clusterRequestsByDestination(unique);

  // For each destination group, split out far origin clusters and build SmartGroup
  const smartGroups: SmartGroup[] = destGroups.flatMap(group => {
    const corridor = findBestCorridor(group);
    return splitDestinationGroupByOrigin(group, corridor).map(subgroup => {
      const subgroupCorridor = findBestCorridor(subgroup);
      const originLabel = getMostCommonLabel(subgroup, 'origin');
      const destLabel = getMostCommonLabel(subgroup, 'destination');
      return { requests: subgroup, originLabel, destLabel, corridor: subgroupCorridor };
    });
  });

  smartGroups.sort((a, b) => b.requests.length - a.requests.length);
  return smartGroups;
}

// ─── Corridor matching ────────────────────────────────
const MAX_CORRIDOR_DIST_KM = 2.5; // keep corridors realistic, not broad detours

function findBestCorridor(group: RouteRequest[]): Corridor | null {
  let bestCorridor: Corridor | null = null;
  let bestScore = Infinity;
  let bestCoverage = 0;

  for (const corridor of CAIRO_CORRIDORS) {
    const wps = corridor.waypoints;

    let totalDist = 0;
    let usersOnCorridor = 0;

    for (const rr of group) {
      const originDist = minDistToCorridor(rr.origin_lat, rr.origin_lng, wps);
      const destDist = minDistToCorridor(rr.destination_lat, rr.destination_lng, wps);
      if (originDist < MAX_CORRIDOR_DIST_KM && destDist < MAX_CORRIDOR_DIST_KM) {
        usersOnCorridor++;
        totalDist += originDist + destDist;
      }
    }

    if (usersOnCorridor === 0) continue;
    // Score: prefer corridors that serve more users with less deviation
    const coverage = usersOnCorridor / group.length;
    const score = (group.length - usersOnCorridor) * 100 + totalDist / usersOnCorridor;
    if (coverage > bestCoverage || (coverage === bestCoverage && score < bestScore)) {
      bestScore = score;
      bestCoverage = coverage;
      bestCorridor = corridor;
    }
  }

  if (!bestCorridor) return null;
  if (group.length > 1 && bestCoverage < MIN_CORRIDOR_COVERAGE) return null;
  return bestCorridor;
}

function minDistToCorridor(lat: number, lng: number, waypoints: Waypoint[]): number {
  let minDist = Infinity;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const { dist } = pointToSegment(lat, lng, waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

function snapToCorridor(lat: number, lng: number, waypoints: Waypoint[]): { lat: number; lng: number; segIndex: number; t: number } {
  let best = { lat, lng, segIndex: 0, t: 0, dist: Infinity };
  for (let i = 0; i < waypoints.length - 1; i++) {
    const result = pointToSegment(lat, lng, waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
    if (result.dist < best.dist) {
      best = { lat: result.lat, lng: result.lng, segIndex: i, t: result.t, dist: result.dist };
    }
  }
  return best;
}

// ─── Zone name simplification ─────────────────────────
// Maps coordinates to area names for display (simplified)
const CAIRO_ZONES: { lat: number; lng: number; name: string; radius: number }[] = [
  { lat: 30.1070, lng: 31.6370, name: 'Madinaty', radius: 3 },
  { lat: 30.1240, lng: 31.6100, name: 'El Shorouk', radius: 4 },
  { lat: 30.1380, lng: 31.5500, name: 'Obour City', radius: 3 },
  { lat: 30.0500, lng: 31.5000, name: 'Rehab City', radius: 3 },
  { lat: 30.0300, lng: 31.4700, name: 'New Cairo', radius: 5 },
  { lat: 30.0550, lng: 31.3600, name: 'Nasr City', radius: 3 },
  { lat: 30.0450, lng: 31.3200, name: 'Heliopolis', radius: 3 },
  { lat: 30.0500, lng: 31.2600, name: 'Downtown Cairo', radius: 3 },
  { lat: 30.0400, lng: 31.2100, name: 'Mohandessin', radius: 2 },
  { lat: 30.0250, lng: 31.2000, name: 'Dokki', radius: 2 },
  { lat: 30.0130, lng: 31.1600, name: 'Haram / Faisal', radius: 3 },
  { lat: 30.0700, lng: 31.0170, name: 'Smart Village', radius: 3 },
  { lat: 30.0200, lng: 30.9800, name: '6th October City', radius: 5 },
  { lat: 29.9900, lng: 30.9500, name: 'Sheikh Zayed', radius: 4 },
  { lat: 29.9900, lng: 31.2800, name: 'Maadi', radius: 3 },
  { lat: 30.2900, lng: 31.7800, name: '10th of Ramadan', radius: 5 },
  { lat: 30.0900, lng: 31.5400, name: 'Badr City', radius: 3 },
  { lat: 30.0060, lng: 31.4350, name: 'Katameya', radius: 3 },
  { lat: 30.0760, lng: 31.2850, name: 'Ain Shams', radius: 2 },
  { lat: 30.0600, lng: 31.3000, name: 'Abbasseya', radius: 2 },
];

function getZoneName(lat: number, lng: number, fallback: string): string {
  for (const zone of CAIRO_ZONES) {
    if (haversine(lat, lng, zone.lat, zone.lng) < zone.radius) return zone.name;
  }
  return fallback;
}

// ─── Stop generation ──────────────────────────────────
export function generateSmartRoute(group: SmartGroup): GeneratedRoute {
  const { requests } = group;
  const corridor = group.corridor && group.corridor.waypoints.length >= 2 ? group.corridor : null;
  const totalCorridorLen = corridor ? corridorLength(corridor.waypoints) : 0;
  const forwardDirection = corridor ? getForwardDirection(requests, corridor, totalCorridorLen) : true;

  const pickupStops = buildPickupStops(requests, corridor, totalCorridorLen, forwardDirection);
  const dropoffStops = buildDropoffStops(
    requests,
    corridor,
    totalCorridorLen,
    forwardDirection,
    pickupStops[pickupStops.length - 1] || null,
  );

  if (pickupStops.length === 0 || dropoffStops.length === 0) {
    return generateFallbackRoute(group);
  }

  const origin = {
    lat: pickupStops[0].lat,
    lng: pickupStops[0].lng,
    name: pickupStops[0].name,
  };
  const destination = {
    lat: dropoffStops[dropoffStops.length - 1].lat,
    lng: dropoffStops[dropoffStops.length - 1].lng,
    name: dropoffStops[dropoffStops.length - 1].name,
  };

  const intermediateStops = [
    ...pickupStops.slice(1),
    ...dropoffStops.slice(0, -1),
  ];

  return {
    origin,
    destination,
    stops: intermediateStops,
    pickupStops,
    dropoffStops,
    totalDistance: routeDistance([origin, ...intermediateStops, destination]),
    corridor,
  };
}

// Fallback for groups with no matching corridor
function generateFallbackRoute(group: SmartGroup): GeneratedRoute {
  const reqs = group.requests;
  const pickupStops = buildPickupStops(reqs, null, 0, true);
  const dropoffStops = buildDropoffStops(reqs, null, 0, true, pickupStops[pickupStops.length - 1] || null);

  if (pickupStops.length === 0 || dropoffStops.length === 0) {
    const fallbackOrigin = reqs[0]
      ? { lat: reqs[0].origin_lat, lng: reqs[0].origin_lng, name: reqs[0].origin_name }
      : { lat: 30.0444, lng: 31.2357, name: 'Cairo' };
    const fallbackDestination = reqs[0]
      ? { lat: reqs[0].destination_lat, lng: reqs[0].destination_lng, name: reqs[0].destination_name }
      : { lat: 30.0444, lng: 31.2357, name: 'Cairo' };

    return {
      origin: fallbackOrigin,
      destination: fallbackDestination,
      stops: [],
      pickupStops: pickupStops,
      dropoffStops: dropoffStops,
      totalDistance: haversine(fallbackOrigin.lat, fallbackOrigin.lng, fallbackDestination.lat, fallbackDestination.lng),
      corridor: null,
    };
  }

  const origin = {
    lat: pickupStops[0].lat,
    lng: pickupStops[0].lng,
    name: pickupStops[0].name,
  };
  const destination = {
    lat: dropoffStops[dropoffStops.length - 1].lat,
    lng: dropoffStops[dropoffStops.length - 1].lng,
    name: dropoffStops[dropoffStops.length - 1].name,
  };
  const intermediateStops = [
    ...pickupStops.slice(1),
    ...dropoffStops.slice(0, -1),
  ];

  return {
    origin,
    destination,
    stops: intermediateStops,
    pickupStops,
    dropoffStops,
    totalDistance: routeDistance([origin, ...intermediateStops, destination]),
    corridor: null,
  };
}

// ─── Helpers ──────────────────────────────────────────
function clusterRequestsByDestination(requests: RouteRequest[]): RouteRequest[][] {
  const assigned = new Set<string>();
  const clusters: RouteRequest[][] = [];

  for (const seed of requests) {
    if (assigned.has(seed.user_id)) continue;
    const cluster: RouteRequest[] = [];
    const queue = [seed];
    assigned.add(seed.user_id);

    while (queue.length) {
      const current = queue.shift()!;
      cluster.push(current);

      for (const other of requests) {
        if (assigned.has(other.user_id)) continue;
        if (haversine(current.destination_lat, current.destination_lng, other.destination_lat, other.destination_lng) <= DEST_THRESHOLD_KM) {
          assigned.add(other.user_id);
          queue.push(other);
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function splitDestinationGroupByOrigin(group: RouteRequest[], corridor: Corridor | null): RouteRequest[][] {
  if (group.length <= 1) return [group];

  const totalLen = corridor ? corridorLength(corridor.waypoints) : 0;
  const enriched = group.map(rr => {
    const snap = corridor ? snapToCorridor(rr.origin_lat, rr.origin_lng, corridor.waypoints) : null;
    return {
      request: rr,
      zone: getZoneName(rr.origin_lat, rr.origin_lng, rr.origin_name),
      corridorDist: corridor ? minDistToCorridor(rr.origin_lat, rr.origin_lng, corridor.waypoints) : Infinity,
      progress: corridor && snap ? segmentProgress(snap.segIndex, snap.t, corridor.waypoints, totalLen) : 0,
    };
  });

  const taken = new Set<string>();
  const clusters: RouteRequest[][] = [];

  for (const seed of enriched) {
    if (taken.has(seed.request.user_id)) continue;
    const cluster: RouteRequest[] = [];
    const queue = [seed];
    taken.add(seed.request.user_id);

    while (queue.length) {
      const current = queue.shift()!;
      cluster.push(current.request);

      for (const other of enriched) {
        if (taken.has(other.request.user_id)) continue;
        if (shouldShareShuttleCluster(current, other, corridor)) {
          taken.add(other.request.user_id);
          queue.push(other);
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function shouldShareShuttleCluster(
  a: { request: RouteRequest; zone: string; corridorDist: number; progress: number },
  b: { request: RouteRequest; zone: string; corridorDist: number; progress: number },
  corridor: Corridor | null,
): boolean {
  if (a.zone === b.zone) return true;

  const directOriginDistance = haversine(
    a.request.origin_lat,
    a.request.origin_lng,
    b.request.origin_lat,
    b.request.origin_lng,
  );
  if (directOriginDistance <= ORIGIN_CLUSTER_KM) return true;

  if (!corridor) return false;

  const nearCorridor = a.corridorDist <= MAX_CORRIDOR_DIST_KM && b.corridorDist <= MAX_CORRIDOR_DIST_KM;
  const progressGap = Math.abs(a.progress - b.progress);

  return nearCorridor && progressGap <= ORIGIN_PROGRESS_GAP;
}

function getMostCommonLabel(group: RouteRequest[], kind: 'origin' | 'destination'): string {
  const counts: Record<string, number> = {};
  group.forEach(rr => {
    const zone = kind === 'origin'
      ? getZoneName(rr.origin_lat, rr.origin_lng, rr.origin_name)
      : getZoneName(rr.destination_lat, rr.destination_lng, rr.destination_name);
    counts[zone] = (counts[zone] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
    || (kind === 'origin' ? group[0]?.origin_name : group[0]?.destination_name)
    || 'Route';
}

function getForwardDirection(requests: RouteRequest[], corridor: Corridor, totalLen: number): boolean {
  const avgPickupProgress = average(
    requests.map(rr => {
      const snap = snapToCorridor(rr.origin_lat, rr.origin_lng, corridor.waypoints);
      return segmentProgress(snap.segIndex, snap.t, corridor.waypoints, totalLen);
    })
  );
  const avgDropoffProgress = average(
    requests.map(rr => {
      const snap = snapToCorridor(rr.destination_lat, rr.destination_lng, corridor.waypoints);
      return segmentProgress(snap.segIndex, snap.t, corridor.waypoints, totalLen);
    })
  );
  return avgDropoffProgress >= avgPickupProgress;
}

type RequestPoint = {
  userId: string;
  lat: number;
  lng: number;
  name: string;
};

function buildPickupStops(
  requests: RouteRequest[],
  corridor: Corridor | null,
  totalCorridorLen: number,
  forwardDirection: boolean,
): GeneratedStop[] {
  const points: RequestPoint[] = requests.map(rr => ({
    userId: rr.user_id,
    lat: rr.origin_lat,
    lng: rr.origin_lng,
    name: rr.origin_name,
  }));

  const stops = clusterRequestPoints(points, PICKUP_CLUSTER_KM, 'pickup', corridor, totalCorridorLen);

  if (corridor) {
    return sortStopsAlongCorridor(stops, corridor, totalCorridorLen, forwardDirection);
  }

  const avgDestination = {
    lat: average(requests.map(rr => rr.destination_lat)),
    lng: average(requests.map(rr => rr.destination_lng)),
  };

  return [...stops].sort((a, b) =>
    haversine(avgDestination.lat, avgDestination.lng, b.lat, b.lng) -
    haversine(avgDestination.lat, avgDestination.lng, a.lat, a.lng)
  );
}

function buildDropoffStops(
  requests: RouteRequest[],
  corridor: Corridor | null,
  totalCorridorLen: number,
  forwardDirection: boolean,
  previousStop: { lat: number; lng: number } | null,
): GeneratedStop[] {
  const points: RequestPoint[] = requests.map(rr => ({
    userId: rr.user_id,
    lat: rr.destination_lat,
    lng: rr.destination_lng,
    name: rr.destination_name,
  }));

  const stops = clusterRequestPoints(points, DROPOFF_CLUSTER_KM, 'dropoff', corridor, totalCorridorLen);

  if (corridor) {
    return sortStopsAlongCorridor(stops, corridor, totalCorridorLen, forwardDirection);
  }

  return sortStopsByNearestNeighbor(stops, previousStop);
}

function clusterRequestPoints(
  points: RequestPoint[],
  thresholdKm: number,
  stopType: 'pickup' | 'dropoff',
  corridor: Corridor | null,
  totalCorridorLen: number,
): GeneratedStop[] {
  if (points.length === 0) return [];

  const used = new Set<number>();
  const stops: GeneratedStop[] = [];

  for (let i = 0; i < points.length; i++) {
    if (used.has(i)) continue;
    const clusterIndexes = [i];
    used.add(i);

    for (let j = i + 1; j < points.length; j++) {
      if (used.has(j)) continue;
      if (haversine(points[i].lat, points[i].lng, points[j].lat, points[j].lng) <= thresholdKm) {
        clusterIndexes.push(j);
        used.add(j);
      }
    }

    const cluster = clusterIndexes.map(index => points[index]);
    const avgLat = average(cluster.map(point => point.lat));
    const avgLng = average(cluster.map(point => point.lng));
    const displayedPoint = corridor
      ? getWalkableCorridorPoint(avgLat, avgLng, corridor.waypoints)
      : { lat: avgLat, lng: avgLng };

    const fallbackName = mostCommonName(cluster.map(point => point.name));
    const name = cluster.length === 1
      ? cluster[0].name
      : getZoneName(displayedPoint.lat, displayedPoint.lng, fallbackName);

    stops.push({
      lat: displayedPoint.lat,
      lng: displayedPoint.lng,
      name,
      userCount: cluster.length,
      userIds: cluster.map(point => point.userId),
      stopType,
    });
  }

  return dedupeStops(stops, thresholdKm / 2);
}

function getWalkableCorridorPoint(lat: number, lng: number, waypoints: Waypoint[]): { lat: number; lng: number } {
  const snapped = snapToCorridor(lat, lng, waypoints);
  const walkDistance = haversine(lat, lng, snapped.lat, snapped.lng);
  if (walkDistance <= MAX_WALK_TO_STOP_KM) {
    return { lat: snapped.lat, lng: snapped.lng };
  }
  return { lat, lng };
}

function sortStopsAlongCorridor(
  stops: GeneratedStop[],
  corridor: Corridor,
  totalCorridorLen: number,
  forwardDirection: boolean,
): GeneratedStop[] {
  return [...stops].sort((a, b) => {
    const aSnap = snapToCorridor(a.lat, a.lng, corridor.waypoints);
    const bSnap = snapToCorridor(b.lat, b.lng, corridor.waypoints);
    const aProgress = segmentProgress(aSnap.segIndex, aSnap.t, corridor.waypoints, totalCorridorLen);
    const bProgress = segmentProgress(bSnap.segIndex, bSnap.t, corridor.waypoints, totalCorridorLen);
    return forwardDirection ? aProgress - bProgress : bProgress - aProgress;
  });
}

function sortStopsByNearestNeighbor(stops: GeneratedStop[], start: { lat: number; lng: number } | null): GeneratedStop[] {
  if (stops.length <= 1 || !start) return stops;

  const remaining = [...stops];
  const ordered: GeneratedStop[] = [];
  let current = start;

  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = haversine(current.lat, current.lng, remaining[0].lat, remaining[0].lng);

    for (let i = 1; i < remaining.length; i++) {
      const distance = haversine(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    const [nextStop] = remaining.splice(bestIndex, 1);
    ordered.push(nextStop);
    current = nextStop;
  }

  return ordered;
}

function dedupeStops(stops: GeneratedStop[], thresholdKm: number): GeneratedStop[] {
  const deduped: GeneratedStop[] = [];

  stops.forEach(stop => {
    const existing = deduped.find(candidate => candidate.stopType === stop.stopType && haversine(candidate.lat, candidate.lng, stop.lat, stop.lng) <= thresholdKm);
    if (!existing) {
      deduped.push({ ...stop });
      return;
    }

    existing.userCount += stop.userCount;
    existing.userIds = Array.from(new Set([...existing.userIds, ...stop.userIds]));
  });

  return deduped;
}

function corridorLength(wps: Waypoint[]): number {
  let d = 0;
  for (let i = 0; i < wps.length - 1; i++) d += haversine(wps[i].lat, wps[i].lng, wps[i + 1].lat, wps[i + 1].lng);
  return d;
}

function segmentProgress(segIndex: number, t: number, wps: Waypoint[], totalLen: number): number {
  let d = 0;
  for (let i = 0; i < segIndex; i++) d += haversine(wps[i].lat, wps[i].lng, wps[i + 1].lat, wps[i + 1].lng);
  d += t * haversine(wps[segIndex].lat, wps[segIndex].lng, wps[segIndex + 1].lat, wps[segIndex + 1].lng);
  return totalLen > 0 ? d / totalLen : 0;
}

function findNearestWaypoint(lat: number, lng: number, wps: Waypoint[]): Waypoint {
  let best = wps[0];
  let bestDist = haversine(lat, lng, wps[0].lat, wps[0].lng);
  for (let i = 1; i < wps.length; i++) {
    const d = haversine(lat, lng, wps[i].lat, wps[i].lng);
    if (d < bestDist) { best = wps[i]; bestDist = d; }
  }
  return best;
}

function routeDistance(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversine(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  return total;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function mostCommonName(names: string[]): string {
  const counts: Record<string, number> = {};
  names.forEach(name => {
    counts[name] = (counts[name] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || names[0] || 'Stop';
}
