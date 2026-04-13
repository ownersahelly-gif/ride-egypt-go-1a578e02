import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Wand2, Loader2, X, Lock, Unlock } from 'lucide-react';
import { type RouteRequestUser, type CircleZone, getDistance } from './types';

interface ZoneRecommenderProps {
  users: RouteRequestUser[];
  onCreateZonePair: (pickup: Omit<CircleZone, 'id'>, dropoff: Omit<CircleZone, 'id'>) => void;
  onClose: () => void;
}

interface ClusterResult {
  centerLat: number;
  centerLng: number;
  radius: number;
  userIds: string[];
}

function findCluster(
  users: RouteRequestUser[],
  targetCount: number,
  getCoords: (u: RouteRequestUser) => { lat: number; lng: number },
  maxKm?: number
): ClusterResult | null {
  if (users.length === 0) return null;

  let sumLat = 0, sumLng = 0;
  users.forEach(u => {
    const c = getCoords(u);
    sumLat += c.lat;
    sumLng += c.lng;
  });
  let centerLat = sumLat / users.length;
  let centerLng = sumLng / users.length;

  const withDist = users.map(u => {
    const c = getCoords(u);
    return { user: u, dist: getDistance(c.lat, c.lng, centerLat, centerLng) };
  }).sort((a, b) => a.dist - b.dist);

  const count = Math.min(targetCount, withDist.length);
  const selected = withDist.slice(0, count);

  sumLat = 0; sumLng = 0;
  selected.forEach(s => {
    const c = getCoords(s.user);
    sumLat += c.lat;
    sumLng += c.lng;
  });
  centerLat = sumLat / selected.length;
  centerLng = sumLng / selected.length;

  let maxDist = 0;
  selected.forEach(s => {
    const c = getCoords(s.user);
    const d = getDistance(c.lat, c.lng, centerLat, centerLng);
    if (d > maxDist) maxDist = d;
  });

  let radius = maxDist + 500;
  if (maxKm && radius > maxKm * 1000) {
    radius = maxKm * 1000;
  }

  return {
    centerLat,
    centerLng,
    radius,
    userIds: selected.map(s => s.user.id),
  };
}

async function calculateRealRouteStats(
  users: RouteRequestUser[]
): Promise<{ distanceKm: number; durationMin: number } | null> {
  if (users.length < 2 || typeof google === 'undefined') return null;

  const ds = new google.maps.DirectionsService();
  let totalDist = 0;
  let totalDur = 0;

  try {
    const pickups = users.map(u => ({ lat: u.originLat, lng: u.originLng }));
    if (pickups.length >= 2) {
      const result = await ds.route({
        origin: new google.maps.LatLng(pickups[0].lat, pickups[0].lng),
        destination: new google.maps.LatLng(pickups[pickups.length - 1].lat, pickups[pickups.length - 1].lng),
        waypoints: pickups.slice(1, -1).slice(0, 23).map(p => ({
          location: new google.maps.LatLng(p.lat, p.lng),
          stopover: true,
        })),
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
      });
      result.routes[0]?.legs?.forEach(l => {
        totalDist += l.distance?.value || 0;
        totalDur += l.duration?.value || 0;
      });
    }

    const dropoffs = users.map(u => ({ lat: u.destinationLat, lng: u.destinationLng }));
    if (dropoffs.length >= 2) {
      const result = await ds.route({
        origin: new google.maps.LatLng(dropoffs[0].lat, dropoffs[0].lng),
        destination: new google.maps.LatLng(dropoffs[dropoffs.length - 1].lat, dropoffs[dropoffs.length - 1].lng),
        waypoints: dropoffs.slice(1, -1).slice(0, 23).map(p => ({
          location: new google.maps.LatLng(p.lat, p.lng),
          stopover: true,
        })),
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
      });
      result.routes[0]?.legs?.forEach(l => {
        totalDist += l.distance?.value || 0;
        totalDur += l.duration?.value || 0;
      });
    }

    if (pickups.length >= 1 && dropoffs.length >= 1) {
      const bridgeResult = await ds.route({
        origin: new google.maps.LatLng(pickups[pickups.length - 1].lat, pickups[pickups.length - 1].lng),
        destination: new google.maps.LatLng(dropoffs[0].lat, dropoffs[0].lng),
        travelMode: google.maps.TravelMode.DRIVING,
      });
      bridgeResult.routes[0]?.legs?.forEach(l => {
        totalDist += l.distance?.value || 0;
        totalDur += l.duration?.value || 0;
      });
    }
  } catch (e) {
    console.error('Route stats calculation failed:', e);
    return null;
  }

  return {
    distanceKm: totalDist / 1000,
    durationMin: Math.round(totalDur / 60),
  };
}

interface LockState {
  people: boolean;
  duration: boolean;
  pickupRadius: boolean;
  dropoffRadius: boolean;
}

const LockToggle = ({ locked, onToggle }: { locked: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className={`p-0.5 rounded transition-colors ${locked ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
    title={locked ? 'Locked — strict constraint' : 'Unlocked — flexible'}
  >
    {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
  </button>
);

const ZoneRecommender = ({ users, onCreateZonePair, onClose }: ZoneRecommenderProps) => {
  const [targetPeople, setTargetPeople] = useState(10);
  const [maxTripMin, setMaxTripMin] = useState(90);
  const [maxPickupRadiusKm, setMaxPickupRadiusKm] = useState(15);
  const [maxDropoffRadiusKm, setMaxDropoffRadiusKm] = useState(15);
  const [pairName, setPairName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [locks, setLocks] = useState<LockState>({
    people: false,
    duration: true,
    pickupRadius: false,
    dropoffRadius: false,
  });
  const [preview, setPreview] = useState<{
    pickup: ClusterResult;
    dropoff: ClusterResult;
    routeDistanceKm: number;
    routeDurationMin: number;
    userCount: number;
    violations: string[];
  } | null>(null);

  const toggleLock = (key: keyof LockState) => {
    setLocks(prev => ({ ...prev, [key]: !prev[key] }));
    setPreview(null);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setPreview(null);

    // Start with target people count
    let bestResult: typeof preview = null;

    // Try from targetPeople down to 2 (or up if people is locked)
    const minPeople = locks.people ? targetPeople : 2;
    const maxPeople = targetPeople;

    for (let tryCount = maxPeople; tryCount >= minPeople; tryCount--) {
      const puRadiusLimit = locks.pickupRadius ? maxPickupRadiusKm : undefined;
      const doRadiusLimit = locks.dropoffRadius ? maxDropoffRadiusKm : undefined;

      const pickupCluster = findCluster(
        users,
        tryCount,
        u => ({ lat: u.originLat, lng: u.originLng }),
        puRadiusLimit
      );

      if (!pickupCluster || pickupCluster.userIds.length < 2) continue;
      if (locks.people && pickupCluster.userIds.length < targetPeople) continue;

      const clusterUsers = users.filter(u => pickupCluster.userIds.includes(u.id));

      const dropoffCluster = findCluster(
        clusterUsers,
        clusterUsers.length,
        u => ({ lat: u.destinationLat, lng: u.destinationLng }),
        doRadiusLimit
      );

      if (!dropoffCluster) continue;

      // Check radius constraints
      if (locks.pickupRadius && pickupCluster.radius > maxPickupRadiusKm * 1000) continue;
      if (locks.dropoffRadius && dropoffCluster.radius > maxDropoffRadiusKm * 1000) continue;

      const routeStats = await calculateRealRouteStats(clusterUsers);

      if (routeStats) {
        // If duration is locked and exceeds, skip this count
        if (locks.duration && routeStats.durationMin > maxTripMin) continue;

        // Found a valid result
        const violations: string[] = [];
        if (!locks.duration && routeStats.durationMin > maxTripMin) violations.push('duration');
        if (!locks.pickupRadius && pickupCluster.radius > maxPickupRadiusKm * 1000) violations.push('pickup radius');
        if (!locks.dropoffRadius && dropoffCluster.radius > maxDropoffRadiusKm * 1000) violations.push('dropoff radius');
        if (!locks.people && clusterUsers.length < targetPeople) violations.push('people count');

        bestResult = {
          pickup: pickupCluster,
          dropoff: dropoffCluster,
          routeDistanceKm: routeStats.distanceKm,
          routeDurationMin: routeStats.durationMin,
          userCount: clusterUsers.length,
          violations,
        };
        break;
      } else {
        // Fallback straight-line
        let totalDist = 0;
        clusterUsers.forEach(u => {
          totalDist += getDistance(u.originLat, u.originLng, u.destinationLat, u.destinationLng);
        });

        bestResult = {
          pickup: pickupCluster,
          dropoff: dropoffCluster,
          routeDistanceKm: totalDist / clusterUsers.length / 1000,
          routeDurationMin: 0,
          userCount: clusterUsers.length,
          violations: [],
        };
        break;
      }
    }

    // If no valid result found with strict locks, show best effort without locked duration
    if (!bestResult) {
      const pickupCluster = findCluster(
        users,
        locks.people ? targetPeople : Math.min(targetPeople, users.length),
        u => ({ lat: u.originLat, lng: u.originLng }),
        locks.pickupRadius ? maxPickupRadiusKm : undefined
      );

      if (pickupCluster && pickupCluster.userIds.length >= 2) {
        const clusterUsers = users.filter(u => pickupCluster.userIds.includes(u.id));
        const dropoffCluster = findCluster(
          clusterUsers,
          clusterUsers.length,
          u => ({ lat: u.destinationLat, lng: u.destinationLng }),
          locks.dropoffRadius ? maxDropoffRadiusKm : undefined
        );

        if (dropoffCluster) {
          const routeStats = await calculateRealRouteStats(clusterUsers);
          const violations: string[] = ['Could not satisfy all locked constraints'];

          bestResult = {
            pickup: pickupCluster,
            dropoff: dropoffCluster,
            routeDistanceKm: routeStats?.distanceKm ?? 0,
            routeDurationMin: routeStats?.durationMin ?? 0,
            userCount: clusterUsers.length,
            violations,
          };
        }
      }
    }

    setPreview(bestResult);
    setGenerating(false);
  };

  const handleApply = () => {
    if (!preview) return;
    const name = pairName.trim() || `Auto ${preview.userCount}p`;
    const pairId = crypto.randomUUID().slice(0, 8);

    onCreateZonePair(
      {
        pairId,
        pairName: name,
        type: 'pickup',
        lat: preview.pickup.centerLat,
        lng: preview.pickup.centerLng,
        radius: preview.pickup.radius,
      },
      {
        pairId,
        pairName: name,
        type: 'dropoff',
        lat: preview.dropoff.centerLat,
        lng: preview.dropoff.centerLng,
        radius: preview.dropoff.radius,
      }
    );
    onClose();
  };

  const hasViolations = preview && preview.violations.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5 text-primary" />
          Zone Recommendation
        </h3>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Target people */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <LockToggle locked={locks.people} onToggle={() => toggleLock('people')} />
            Target people {locks.people && <span className="text-primary font-bold">≥</span>}
          </span>
          <span className="text-[10px] font-bold text-foreground">{targetPeople}</span>
        </div>
        <Slider
          value={[targetPeople]}
          min={2}
          max={Math.min(users.length, 50)}
          step={1}
          onValueChange={([v]) => { setTargetPeople(v); setPreview(null); }}
          className="w-full"
        />
      </div>

      {/* Max trip duration */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
            <LockToggle locked={locks.duration} onToggle={() => toggleLock('duration')} />
            ⏱️ Max trip duration {locks.duration && <span className="text-primary font-bold">≤</span>}
          </span>
          <span className="text-[10px] font-bold text-foreground">{maxTripMin} min</span>
        </div>
        <Slider
          value={[maxTripMin]}
          min={15}
          max={180}
          step={5}
          onValueChange={([v]) => { setMaxTripMin(v); setPreview(null); }}
          className="w-full"
        />
      </div>

      {/* Max pickup radius */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <LockToggle locked={locks.pickupRadius} onToggle={() => toggleLock('pickupRadius')} />
            Max pickup radius {locks.pickupRadius && <span className="text-primary font-bold">≤</span>}
          </span>
          <span className="text-[10px] font-bold text-foreground">{maxPickupRadiusKm} km</span>
        </div>
        <Slider
          value={[maxPickupRadiusKm]}
          min={1}
          max={30}
          step={1}
          onValueChange={([v]) => { setMaxPickupRadiusKm(v); setPreview(null); }}
          className="w-full"
        />
      </div>

      {/* Max dropoff radius */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <LockToggle locked={locks.dropoffRadius} onToggle={() => toggleLock('dropoffRadius')} />
            Max dropoff radius {locks.dropoffRadius && <span className="text-primary font-bold">≤</span>}
          </span>
          <span className="text-[10px] font-bold text-foreground">{maxDropoffRadiusKm} km</span>
        </div>
        <Slider
          value={[maxDropoffRadiusKm]}
          min={1}
          max={30}
          step={1}
          onValueChange={([v]) => { setMaxDropoffRadiusKm(v); setPreview(null); }}
          className="w-full"
        />
      </div>

      {/* Lock legend */}
      <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-0.5"><Lock className="w-2.5 h-2.5 text-primary" /> = strict</span>
        <span className="flex items-center gap-0.5"><Unlock className="w-2.5 h-2.5 text-muted-foreground/40" /> = flexible</span>
      </div>

      {/* Pair name */}
      <Input
        className="h-7 text-xs"
        placeholder="Zone pair name (optional)..."
        value={pairName}
        onChange={e => setPairName(e.target.value)}
      />

      {/* Generate button */}
      <Button
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={handleGenerate}
        disabled={generating || users.length < 2}
      >
        {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
        {generating ? 'Calculating real routes...' : 'Find Best Zone'}
      </Button>

      {/* Preview results */}
      {preview && (
        <div className={`rounded-lg p-2 space-y-1.5 border ${hasViolations ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/30 border-border'}`}>
          <div className="text-[10px] font-bold text-foreground">
            {hasViolations ? '⚠️ Best fit (some constraints relaxed)' : '✅ Recommendation'}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-muted-foreground">People: </span>
              <span className={`font-bold ${locks.people && preview.userCount < targetPeople ? 'text-destructive' : 'text-foreground'}`}>
                {preview.userCount}
              </span>
              {locks.people && <Lock className="w-2 h-2 inline ml-0.5 text-primary" />}
            </div>
            <div>
              <span className="text-muted-foreground">Route: </span>
              <span className="font-bold text-foreground">{preview.routeDistanceKm.toFixed(1)} km</span>
            </div>
            <div>
              <span className="text-muted-foreground">Duration: </span>
              <span className={`font-bold ${preview.routeDurationMin > maxTripMin ? 'text-destructive' : 'text-foreground'}`}>
                {preview.routeDurationMin} min
              </span>
              {locks.duration && <Lock className="w-2 h-2 inline ml-0.5 text-primary" />}
            </div>
            <div>
              <span className="text-muted-foreground">Max: </span>
              <span className="font-bold text-foreground">{maxTripMin} min</span>
            </div>
            <div>
              <span className="text-muted-foreground">PU radius: </span>
              <span className={`font-bold ${preview.pickup.radius > maxPickupRadiusKm * 1000 ? 'text-destructive' : 'text-foreground'}`}>
                {(preview.pickup.radius / 1000).toFixed(1)} km
              </span>
              {locks.pickupRadius && <Lock className="w-2 h-2 inline ml-0.5 text-primary" />}
            </div>
            <div>
              <span className="text-muted-foreground">DO radius: </span>
              <span className={`font-bold ${preview.dropoff.radius > maxDropoffRadiusKm * 1000 ? 'text-destructive' : 'text-foreground'}`}>
                {(preview.dropoff.radius / 1000).toFixed(1)} km
              </span>
              {locks.dropoffRadius && <Lock className="w-2 h-2 inline ml-0.5 text-primary" />}
            </div>
          </div>
          {hasViolations && (
            <p className="text-[9px] text-destructive">
              {preview.violations.join('. ')}. Try adjusting constraints or unlocking fields.
            </p>
          )}
          <Button size="sm" className="w-full gap-1 text-xs mt-1" onClick={handleApply}>
            Apply Zone Pair
          </Button>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground">
        🔒 Locked = must match exactly. 🔓 Unlocked = algorithm can flex this to find the best fit.
      </p>
    </div>
  );
};

export default ZoneRecommender;
