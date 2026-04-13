import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Wand2, Loader2, X } from 'lucide-react';
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

/** Calculate real driving route stats via Google Directions API */
async function calculateRealRouteStats(
  users: RouteRequestUser[]
): Promise<{ distanceKm: number; durationMin: number } | null> {
  if (users.length < 2 || typeof google === 'undefined') return null;

  const ds = new google.maps.DirectionsService();
  let totalDist = 0;
  let totalDur = 0;

  try {
    // Pickup chain
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

    // Dropoff chain
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

    // Bridge between last pickup and first dropoff
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

const ZoneRecommender = ({ users, onCreateZonePair, onClose }: ZoneRecommenderProps) => {
  const [targetPeople, setTargetPeople] = useState(10);
  const [maxTripMin, setMaxTripMin] = useState(90);
  const [maxPickupRadiusKm, setMaxPickupRadiusKm] = useState(15);
  const [maxDropoffRadiusKm, setMaxDropoffRadiusKm] = useState(15);
  const [pairName, setPairName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<{
    pickup: ClusterResult;
    dropoff: ClusterResult;
    routeDistanceKm: number;
    routeDurationMin: number;
    userCount: number;
  } | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setPreview(null);

    // Find pickup cluster
    const pickupCluster = findCluster(
      users,
      targetPeople,
      u => ({ lat: u.originLat, lng: u.originLng }),
      maxPickupRadiusKm
    );

    if (!pickupCluster || pickupCluster.userIds.length < 2) {
      setGenerating(false);
      return;
    }

    const clusterUsers = users.filter(u => pickupCluster.userIds.includes(u.id));

    // Find dropoff cluster
    const dropoffCluster = findCluster(
      clusterUsers,
      clusterUsers.length,
      u => ({ lat: u.destinationLat, lng: u.destinationLng }),
      maxDropoffRadiusKm
    );

    if (!dropoffCluster) {
      setGenerating(false);
      return;
    }

    // Calculate real driving route stats
    const routeStats = await calculateRealRouteStats(clusterUsers);

    if (routeStats) {
      // If route exceeds max time, try reducing people
      if (routeStats.durationMin > maxTripMin && clusterUsers.length > 2) {
        // Iteratively reduce users until duration fits
        let bestUsers = clusterUsers;
        for (let reduce = 1; reduce < clusterUsers.length - 1; reduce++) {
          const fewer = clusterUsers.length - reduce;
          const smallerPickup = findCluster(
            users,
            fewer,
            u => ({ lat: u.originLat, lng: u.originLng }),
            maxPickupRadiusKm
          );
          if (!smallerPickup || smallerPickup.userIds.length < 2) break;

          const smallerUsers = users.filter(u => smallerPickup.userIds.includes(u.id));
          const smallerStats = await calculateRealRouteStats(smallerUsers);

          if (smallerStats && smallerStats.durationMin <= maxTripMin) {
            bestUsers = smallerUsers;

            const newPickup = findCluster(bestUsers, bestUsers.length, u => ({ lat: u.originLat, lng: u.originLng }), maxPickupRadiusKm);
            const newDropoff = findCluster(bestUsers, bestUsers.length, u => ({ lat: u.destinationLat, lng: u.destinationLng }), maxDropoffRadiusKm);

            if (newPickup && newDropoff) {
              setPreview({
                pickup: newPickup,
                dropoff: newDropoff,
                routeDistanceKm: smallerStats.distanceKm,
                routeDurationMin: smallerStats.durationMin,
                userCount: bestUsers.length,
              });
            }
            setGenerating(false);
            return;
          }
        }
      }

      // Show result (even if over time limit, with warning)
      pickupCluster.userIds = clusterUsers.map(u => u.id);
      setPreview({
        pickup: pickupCluster,
        dropoff: dropoffCluster,
        routeDistanceKm: routeStats.distanceKm,
        routeDurationMin: routeStats.durationMin,
        userCount: clusterUsers.length,
      });
    } else {
      // Fallback to straight-line estimate
      let totalDist = 0;
      clusterUsers.forEach(u => {
        totalDist += getDistance(u.originLat, u.originLng, u.destinationLat, u.destinationLng);
      });
      pickupCluster.userIds = clusterUsers.map(u => u.id);
      setPreview({
        pickup: pickupCluster,
        dropoff: dropoffCluster,
        routeDistanceKm: totalDist / clusterUsers.length / 1000,
        routeDurationMin: 0,
        userCount: clusterUsers.length,
      });
    }

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

  const overTime = preview && preview.routeDurationMin > maxTripMin;

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
          <span className="text-[10px] text-muted-foreground">Target people</span>
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

      {/* Max trip duration - PRIMARY constraint */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-bold">⏱️ Max trip duration</span>
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
          <span className="text-[10px] text-muted-foreground">Max pickup radius</span>
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
          <span className="text-[10px] text-muted-foreground">Max dropoff radius</span>
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
        <div className={`rounded-lg p-2 space-y-1.5 border ${overTime ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/30 border-border'}`}>
          <div className="text-[10px] font-bold text-foreground">
            {overTime ? '⚠️ Closest fit (exceeds time limit)' : '✅ Recommendation'}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-muted-foreground">People: </span>
              <span className="font-bold text-foreground">{preview.userCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Route: </span>
              <span className="font-bold text-foreground">{preview.routeDistanceKm.toFixed(1)} km</span>
            </div>
            <div>
              <span className="text-muted-foreground">Duration: </span>
              <span className={`font-bold ${overTime ? 'text-destructive' : 'text-foreground'}`}>
                {preview.routeDurationMin} min
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Max: </span>
              <span className="font-bold text-foreground">{maxTripMin} min</span>
            </div>
            <div>
              <span className="text-muted-foreground">PU radius: </span>
              <span className="font-bold text-foreground">{(preview.pickup.radius / 1000).toFixed(1)} km</span>
            </div>
            <div>
              <span className="text-muted-foreground">DO radius: </span>
              <span className="font-bold text-foreground">{(preview.dropoff.radius / 1000).toFixed(1)} km</span>
            </div>
          </div>
          {overTime && (
            <p className="text-[9px] text-destructive">
              Could not find {targetPeople} people within {maxTripMin} min. Try increasing time or reducing people.
            </p>
          )}
          <Button size="sm" className="w-full gap-1 text-xs mt-1" onClick={handleApply}>
            Apply Zone Pair
          </Button>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground">
        Uses Google Maps driving directions to calculate real route distance and duration — matches Show Routes exactly.
      </p>
    </div>
  );
};

export default ZoneRecommender;
