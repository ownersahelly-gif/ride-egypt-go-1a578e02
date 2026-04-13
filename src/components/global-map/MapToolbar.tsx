import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ChevronLeft, Route, Layers, Filter, X, Plus, Trash2, MapPin, Circle, Save, ExternalLink, Users, Lock, Unlock, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { type FilterState, type CircleZone, type RouteRequestUser, ZONE_COLORS, AREA_PRESETS } from './types';
import ZoneRecommender from './ZoneRecommender';

interface MapToolbarProps {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  showLines: boolean;
  onToggleLines: () => void;
  showConnectedRoutes: boolean;
  onToggleConnectedRoutes: () => void;
  onGenerateRoute: () => void;
  routeMode: boolean;
  onToggleRouteMode: () => void;
  visibleCount: number;
  totalCount: number;
  showFilters: boolean;
  onToggleFilters: () => void;
  loadingRoutes: boolean;
  circleZones: CircleZone[];
  onAddCircleZone: (pairId: string, type: 'pickup' | 'dropoff') => void;
  onCreatePair: (name: string) => void;
  onDeletePair: (pairId: string) => void;
  onDeleteZone: (zoneId: string) => void;
  onUpdateZoneRadius: (zoneId: string, radius: number) => void;
  addingCircleType: 'pickup' | 'dropoff' | null;
  addingCirclePairId: string;
  onCancelAdding: () => void;
  hourlyDistribution: { hour: number; count: number }[];
  canSaveConnectedRoute: boolean;
  onSaveConnectedRoute: () => void;
  savingConnectedRoute: boolean;
  onOpenInGoogleMaps: () => void;
  onFilterCommonDays: () => void;
  commonDaysActive: boolean;
  zonesLocked: boolean;
  onToggleZonesLocked: () => void;
  allUsers: RouteRequestUser[];
  onCreateZonePair: (pickup: Omit<CircleZone, 'id'>, dropoff: Omit<CircleZone, 'id'>) => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MapToolbar = ({
  filters, onFiltersChange,
  showLines, onToggleLines,
  showConnectedRoutes, onToggleConnectedRoutes,
  onGenerateRoute, routeMode, onToggleRouteMode,
  visibleCount, totalCount,
  showFilters, onToggleFilters,
  loadingRoutes,
  circleZones, onAddCircleZone, onCreatePair, onDeletePair, onDeleteZone, onUpdateZoneRadius,
  addingCircleType, addingCirclePairId, onCancelAdding,
  hourlyDistribution, canSaveConnectedRoute, onSaveConnectedRoute, savingConnectedRoute,
  onOpenInGoogleMaps, onFilterCommonDays, commonDaysActive,
  zonesLocked, onToggleZonesLocked,
  allUsers, onCreateZonePair,
}: MapToolbarProps) => {
  const [newPairName, setNewPairName] = useState('');
  const [showZones, setShowZones] = useState(false);
  const [showRecommender, setShowRecommender] = useState(false);

  const toggleDay = (d: number) => {
    const days = filters.days.includes(d) ? filters.days.filter(x => x !== d) : [...filters.days, d];
    onFiltersChange({ ...filters, days });
  };

  const clearFilters = () => {
    onFiltersChange({ timeFrom: '', timeTo: '', days: [] });
  };

  const hasFilters = filters.timeFrom || filters.timeTo || filters.days.length > 0;
  const pairIds = [...new Set(circleZones.map(z => z.pairId))];

  return (
    <div className="absolute top-0 left-0 right-0 z-10 bg-card/95 backdrop-blur border-b border-border">
      {/* Main toolbar - scrollable */}
      <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-thin">
        <Link to="/admin" className="shrink-0">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-sm font-bold text-foreground shrink-0">Global Map</h1>
        <span className="text-xs text-muted-foreground shrink-0">
          {visibleCount}/{totalCount} users
        </span>
        
        <div className="flex-1 min-w-4" />

        <Button variant={showFilters ? 'secondary' : 'outline'} size="sm" onClick={onToggleFilters} className="gap-1 shrink-0">
          <Filter className="w-3.5 h-3.5" />
          Filters
          {hasFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
        </Button>
        <Button variant={showZones ? 'secondary' : 'outline'} size="sm" onClick={() => setShowZones(!showZones)} className="gap-1 shrink-0">
          <Circle className="w-3.5 h-3.5" />
          Zones {circleZones.length > 0 && `(${pairIds.length})`}
        </Button>
        {circleZones.length > 0 && (
          <Button variant={zonesLocked ? 'default' : 'outline'} size="sm" onClick={onToggleZonesLocked} className="gap-1 shrink-0" title={zonesLocked ? 'Unlock zones' : 'Lock zones'}>
            {zonesLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </Button>
        )}
        <Button variant={showLines ? 'secondary' : 'outline'} size="sm" onClick={onToggleLines} className="gap-1 shrink-0">
          <Layers className="w-3.5 h-3.5" />
          Lines
        </Button>
        <Button
          variant={showConnectedRoutes ? 'secondary' : 'outline'}
          size="sm"
          onClick={onToggleConnectedRoutes}
          className="gap-1 shrink-0"
          disabled={loadingRoutes}
        >
          <Route className="w-3.5 h-3.5" />
          {loadingRoutes ? 'Loading...' : showConnectedRoutes ? 'Hide Routes' : 'Show Routes'}
        </Button>
        {canSaveConnectedRoute && (
          <Button size="sm" onClick={onSaveConnectedRoute} disabled={savingConnectedRoute} className="gap-1 shrink-0">
            <Save className="w-3.5 h-3.5" />
            {savingConnectedRoute ? 'Saving...' : 'Save to Routes'}
          </Button>
        )}
        {canSaveConnectedRoute && (
          <Button variant="outline" size="sm" onClick={onOpenInGoogleMaps} className="gap-1 shrink-0">
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Maps
          </Button>
        )}
        <Button variant={routeMode ? 'default' : 'outline'} size="sm" onClick={onToggleRouteMode} className="gap-1 shrink-0">
          <Route className="w-3.5 h-3.5" />
          {routeMode ? 'Building...' : 'Build Route'}
        </Button>
        {routeMode && (
          <Button size="sm" onClick={onGenerateRoute} className="shrink-0">
            Generate Route
          </Button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Time:</span>
              <Input type="time" className="w-28 h-7 text-xs" value={filters.timeFrom} onChange={e => onFiltersChange({ ...filters, timeFrom: e.target.value })} />
              <span className="text-xs">→</span>
              <Input type="time" className="w-28 h-7 text-xs" value={filters.timeTo} onChange={e => onFiltersChange({ ...filters, timeTo: e.target.value })} />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 gap-1 text-xs">
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>
          {/* Hourly distribution */}
          {hourlyDistribution.length > 0 && (
            <div className="flex items-end gap-px h-10 bg-muted/30 rounded p-1">
              {hourlyDistribution.map(h => {
                const maxCount = Math.max(...hourlyDistribution.map(x => x.count));
                const height = maxCount > 0 ? Math.max(4, (h.count / maxCount) * 28) : 4;
                const isActive = (!filters.timeFrom && !filters.timeTo) ||
                  (filters.timeFrom && filters.timeTo && 
                   `${String(h.hour).padStart(2,'0')}:00` >= filters.timeFrom && 
                   `${String(h.hour).padStart(2,'0')}:00` <= filters.timeTo);
                return (
                  <div key={h.hour} className="flex flex-col items-center flex-1 min-w-0 group relative cursor-pointer"
                    onClick={() => {
                      onFiltersChange({
                        ...filters,
                        timeFrom: `${String(h.hour).padStart(2,'0')}:00`,
                        timeTo: `${String(h.hour + 1).padStart(2,'0')}:00`,
                      });
                    }}
                  >
                    <div className="absolute -top-5 bg-foreground text-background text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                      {String(h.hour).padStart(2,'0')}:00 — {h.count}
                    </div>
                    <div
                      className={`w-full rounded-sm transition-colors ${isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      style={{ height: `${height}px` }}
                    />
                    {h.hour % 3 === 0 && (
                      <span className="text-[8px] text-muted-foreground mt-0.5">{h.hour}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-1 flex-wrap items-center">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                  filters.days.includes(i)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {label}
              </button>
            ))}
            {filters.days.length >= 2 && (
              <Button
                variant={commonDaysActive ? 'secondary' : 'outline'}
                size="sm"
                onClick={onFilterCommonDays}
                className="h-6 text-[10px] gap-1 ml-1"
              >
                <Users className="w-3 h-3" />
                Common Only
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Zone management panel */}
      {showZones && (
        <div className="px-3 pb-3 border-t border-border pt-2 space-y-3 max-h-[300px] overflow-y-auto">
          {/* Toggle between manual and AI recommendation */}
          <div className="flex items-center gap-2">
            <Button
              variant={showRecommender ? 'outline' : 'secondary'}
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={() => setShowRecommender(false)}
            >
              Manual
            </Button>
            <Button
              variant={showRecommender ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs flex-1 gap-1"
              onClick={() => setShowRecommender(true)}
            >
              <Wand2 className="w-3 h-3" /> Recommend
            </Button>
          </div>

          {showRecommender ? (
            <ZoneRecommender
              users={allUsers}
              onCreateZonePair={onCreateZonePair}
              onClose={() => setShowRecommender(false)}
            />
          ) : (
          <>
          <div className="flex items-center gap-2">
            <Input
              className="h-7 text-xs flex-1"
              placeholder="New zone pair name..."
              value={newPairName}
              onChange={e => setNewPairName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newPairName.trim()) {
                  onCreatePair(newPairName.trim());
                  setNewPairName('');
                }
              }}
            />
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={!newPairName.trim()}
              onClick={() => { onCreatePair(newPairName.trim()); setNewPairName(''); }}
            >
              <Plus className="w-3 h-3" /> Add Pair
            </Button>
          </div>

          {pairIds.map((pairId, pairIdx) => {
            const pairZones = circleZones.filter(z => z.pairId === pairId);
            const pairName = pairZones[0]?.pairName || pairId;
            const colorIdx = pairIdx % ZONE_COLORS.length;
            const colors = ZONE_COLORS[colorIdx];
            const pickupZone = pairZones.find(z => z.type === 'pickup');
            const dropoffZone = pairZones.find(z => z.type === 'dropoff');

            return (
              <div key={pairId} className="border border-border rounded-lg p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-3 h-3 rounded-full" style={{ background: colors.pickup }} />
                      <span className="w-3 h-3 rounded-full" style={{ background: colors.dropoff }} />
                    </div>
                    <span className="text-xs font-bold text-foreground">{pairName}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onDeletePair(pairId)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>

                {/* Pickup zone */}
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors.pickup }} />
                  <span className="text-[10px] text-muted-foreground w-8">PU</span>
                  {pickupZone ? (
                    <>
                      <span className="text-[10px] text-foreground">{(pickupZone.radius / 1000).toFixed(1)}km</span>
                      <Slider
                        value={[pickupZone.radius]}
                        min={1000}
                        max={20000}
                        step={500}
                        onValueChange={([v]) => onUpdateZoneRadius(pickupZone.id, v)}
                        className="w-20"
                      />
                      <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => onDeleteZone(pickupZone.id)}>
                        <X className="w-2.5 h-2.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 text-[10px] gap-1"
                      onClick={() => onAddCircleZone(pairId, 'pickup')}
                    >
                      <MapPin className="w-2.5 h-2.5" /> Click map to add
                    </Button>
                  )}
                </div>

                {/* Dropoff zone */}
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors.dropoff }} />
                  <span className="text-[10px] text-muted-foreground w-8">DO</span>
                  {dropoffZone ? (
                    <>
                      <span className="text-[10px] text-foreground">{(dropoffZone.radius / 1000).toFixed(1)}km</span>
                      <Slider
                        value={[dropoffZone.radius]}
                        min={1000}
                        max={20000}
                        step={500}
                        onValueChange={([v]) => onUpdateZoneRadius(dropoffZone.id, v)}
                        className="w-20"
                      />
                      <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => onDeleteZone(dropoffZone.id)}>
                        <X className="w-2.5 h-2.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 text-[10px] gap-1"
                      onClick={() => onAddCircleZone(pairId, 'dropoff')}
                    >
                      <MapPin className="w-2.5 h-2.5" /> Click map to add
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {pairIds.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Create a zone pair to filter by pickup and dropoff areas. Each pair links a pickup circle to a dropoff circle.
            </p>
          )}
          </>
          )}
        </div>
      )}
    </div>
  );
};

export default MapToolbar;
