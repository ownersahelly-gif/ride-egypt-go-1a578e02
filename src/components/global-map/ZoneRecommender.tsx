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

  // Step 1: Find centroid
  let sumLat = 0, sumLng = 0;
  users.forEach(u => {
    const c = getCoords(u);
    sumLat += c.lat;
    sumLng += c.lng;
  });
  let centerLat = sumLat / users.length;
  let centerLng = sumLng / users.length;

  // Step 2: Sort users by distance to centroid
  const withDist = users.map(u => {
    const c = getCoords(u);
    return { user: u, dist: getDistance(c.lat, c.lng, centerLat, centerLng) };
  }).sort((a, b) => a.dist - b.dist);

  // Step 3: Take the closest N users (target count)
  const count = Math.min(targetCount, withDist.length);
  const selected = withDist.slice(0, count);

  // Step 4: Re-center on selected users for tighter fit
  sumLat = 0; sumLng = 0;
  selected.forEach(s => {
    const c = getCoords(s.user);
    sumLat += c.lat;
    sumLng += c.lng;
  });
  centerLat = sumLat / selected.length;
  centerLng = sumLng / selected.length;

  // Step 5: Calculate radius to encompass all selected users
  let maxDist = 0;
  selected.forEach(s => {
    const c = getCoords(s.user);
    const d = getDistance(c.lat, c.lng, centerLat, centerLng);
    if (d > maxDist) maxDist = d;
  });

  let radius = maxDist + 500; // Add 500m buffer

  // Step 6: Apply max km constraint
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

const ZoneRecommender = ({ users, onCreateZonePair, onClose }: ZoneRecommenderProps) => {
  const [targetPeople, setTargetPeople] = useState(10);
  const [maxTripKm, setMaxTripKm] = useState(50);
  const [maxPickupRadiusKm, setMaxPickupRadiusKm] = useState(15);
  const [maxDropoffRadiusKm, setMaxDropoffRadiusKm] = useState(15);
  const [pairName, setPairName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<{
    pickup: ClusterResult;
    dropoff: ClusterResult;
    avgTripKm: number;
  } | null>(null);

  const handleGenerate = () => {
    setGenerating(true);

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

    // Get users in pickup cluster
    const clusterUsers = users.filter(u => pickupCluster.userIds.includes(u.id));

    // Filter by max trip distance
    const tripFiltered = clusterUsers.filter(u => {
      const tripDist = getDistance(u.originLat, u.originLng, u.destinationLat, u.destinationLng);
      return tripDist <= maxTripKm * 1000;
    });

    const finalUsers = tripFiltered.length >= 2 ? tripFiltered : clusterUsers;

    // Find dropoff cluster for those users
    const dropoffCluster = findCluster(
      finalUsers,
      finalUsers.length,
      u => ({ lat: u.destinationLat, lng: u.destinationLng }),
      maxDropoffRadiusKm
    );

    if (!dropoffCluster) {
      setGenerating(false);
      return;
    }

    // Calculate average trip distance
    let totalTripDist = 0;
    finalUsers.forEach(u => {
      totalTripDist += getDistance(u.originLat, u.originLng, u.destinationLat, u.destinationLng);
    });
    const avgTripKm = totalTripDist / finalUsers.length / 1000;

    // Update pickup cluster to only include final users
    pickupCluster.userIds = finalUsers.map(u => u.id);

    setPreview({ pickup: pickupCluster, dropoff: dropoffCluster, avgTripKm });
    setGenerating(false);
  };

  const handleApply = () => {
    if (!preview) return;
    const name = pairName.trim() || `Auto ${preview.pickup.userIds.length}p`;
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

      {/* Max trip distance */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Max trip distance</span>
          <span className="text-[10px] font-bold text-foreground">{maxTripKm} km</span>
        </div>
        <Slider
          value={[maxTripKm]}
          min={5}
          max={100}
          step={5}
          onValueChange={([v]) => { setMaxTripKm(v); setPreview(null); }}
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
        Find Best Zone
      </Button>

      {/* Preview results */}
      {preview && (
        <div className="bg-muted/30 rounded-lg p-2 space-y-1.5 border border-border">
          <div className="text-[10px] font-bold text-foreground">Recommendation</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-muted-foreground">People: </span>
              <span className="font-bold text-foreground">{preview.pickup.userIds.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Avg trip: </span>
              <span className="font-bold text-foreground">{preview.avgTripKm.toFixed(1)} km</span>
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
          <Button size="sm" className="w-full gap-1 text-xs mt-1" onClick={handleApply}>
            Apply Zone Pair
          </Button>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground">
        Finds the densest cluster of {targetPeople} people, then creates a matching pickup + dropoff zone pair.
      </p>
    </div>
  );
};

export default ZoneRecommender;
