import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Link2, Plus, Trash2, ExternalLink, Copy, MapPin, Loader2, Route } from 'lucide-react';
import { toast } from 'sonner';

interface ParsedLink {
  id: string;
  raw: string;
  origin: { lat: number; lng: number; name: string } | null;
  destination: { lat: number; lng: number; name: string } | null;
  error?: string;
}

/** Use Google Geocoder to resolve a segment (place name or coordinates) */
function resolveSegment(seg: string): Promise<{ lat: number; lng: number; name: string }> {
  return new Promise((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();
    const coordMatch = seg.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        const name = status === 'OK' && results?.[0] ? results[0].formatted_address : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        resolve({ lat, lng, name });
      });
    } else {
      const decoded = decodeURIComponent(seg.replace(/\+/g, ' '));
      geocoder.geocode({ address: decoded }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng(), name: results[0].formatted_address });
        } else {
          reject(new Error(`Could not find: ${decoded.substring(0, 40)}`));
        }
      });
    }
  });
}

/** Parse a Google Maps directions URL and resolve origin/destination via Geocoder */
async function parseGoogleMapsLink(url: string): Promise<{ origin: { lat: number; lng: number; name: string }; destination: { lat: number; lng: number; name: string } } | null> {
  // Extract the path after /dir/
  const dirMatch = url.match(/\/dir\/(.+?)(?:\/@|$|\?)/);
  if (!dirMatch) return null;

  const segments = dirMatch[1].split('/').filter(s => s.trim() !== '');
  if (segments.length < 2) return null;

  const origin = await resolveSegment(segments[0]);
  const destination = await resolveSegment(segments[segments.length - 1]);

  return { origin, destination };
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function generateCombinedGoogleMapsLink(links: ParsedLink[]): string | null {
  const valid = links.filter(l => l.origin && l.destination);
  if (valid.length === 0) return null;

  // Build list of stops: each link has a pickup (P) and dropoff (D)
  // Constraint: for each link, pickup must come before dropoff
  type Stop = { lat: number; lng: number; linkIdx: number; type: 'P' | 'D' };
  const allStops: Stop[] = [];
  valid.forEach((l, i) => {
    allStops.push({ lat: l.origin!.lat, lng: l.origin!.lng, linkIdx: i, type: 'P' });
    allStops.push({ lat: l.destination!.lat, lng: l.destination!.lng, linkIdx: i, type: 'D' });
  });

  // Nearest-neighbor with pickup-before-dropoff constraint
  const ordered: Stop[] = [];
  const remaining = new Set(allStops.map((_, i) => i));
  const pickedUp = new Set<number>(); // linkIdx whose pickup has been visited

  // Start from the pickup closest to the centroid of all pickups
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
      // Can only visit a dropoff if its pickup was already visited
      if (s.type === 'D' && !pickedUp.has(s.linkIdx)) continue;
      const d = haversine(current, s);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }

    if (bestIdx === -1) break; // shouldn't happen
    remaining.delete(bestIdx);
    const stop = allStops[bestIdx];
    ordered.push(stop);
    if (stop.type === 'P') pickedUp.add(stop.linkIdx);
  }

  // Build URL
  const points = ordered.map(s => `${s.lat},${s.lng}`);
  return `https://www.google.com/maps/dir/${points.join('/')}`;
}

const LinkCombiner = ({ lang }: { lang: string }) => {
  const [links, setLinks] = useState<ParsedLink[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [combinedLink, setCombinedLink] = useState<string | null>(null);
  const [bulkInput, setBulkInput] = useState('');
  const [parsing, setParsing] = useState(false);

  const addLink = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setParsing(true);
    try {
      const parsed = await parseGoogleMapsLink(trimmed);
      const newLink: ParsedLink = {
        id: crypto.randomUUID(),
        raw: trimmed,
        origin: parsed?.origin || null,
        destination: parsed?.destination || null,
        error: parsed ? undefined : (lang === 'ar' ? 'تعذر استخراج الإحداثيات' : 'Could not extract coordinates'),
      };
      setLinks(prev => [...prev, newLink]);
      setCombinedLink(null);
    } catch (err: any) {
      setLinks(prev => [...prev, {
        id: crypto.randomUUID(),
        raw: trimmed,
        origin: null,
        destination: null,
        error: err.message || (lang === 'ar' ? 'تعذر استخراج الإحداثيات' : 'Could not extract coordinates'),
      }]);
    }
    setParsing(false);
  };

  const addBulkLinks = async () => {
    const urls = bulkInput.split('\n').map(s => s.trim()).filter(Boolean);
    setBulkInput('');
    for (const url of urls) {
      await addLink(url);
    }
  };

  const removeLink = (id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id));
    setCombinedLink(null);
  };

  const generateLink = () => {
    const result = generateCombinedGoogleMapsLink(links);
    if (result) {
      setCombinedLink(result);
      toast.success(lang === 'ar' ? 'تم إنشاء الرابط المجمع!' : 'Combined link generated!');
    } else {
      toast.error(lang === 'ar' ? 'لا توجد روابط صالحة لدمجها' : 'No valid links to combine');
    }
  };

  const copyLink = () => {
    if (combinedLink) {
      navigator.clipboard.writeText(combinedLink);
      toast.success(lang === 'ar' ? 'تم النسخ!' : 'Copied!');
    }
  };

  const validCount = links.filter(l => l.origin && l.destination).length;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Route className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground text-lg">
          {lang === 'ar' ? 'دمج روابط Google Maps' : 'Combine Google Maps Links'}
        </h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {lang === 'ar'
          ? 'الصق روابط رحلات Google Maps لأشخاص مختلفين وسيتم إنشاء رابط واحد يجمع كل نقاط الالتقاط والتوصيل معاً'
          : 'Paste Google Maps driving links for different people and generate one combined route connecting all pickup and dropoff points'}
      </p>

      {/* Single link input */}
      <div className="flex gap-2">
        <Input
          className="flex-1 text-sm"
          placeholder={lang === 'ar' ? 'الصق رابط Google Maps هنا...' : 'Paste a Google Maps link here...'}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          disabled={parsing}
          onKeyDown={e => {
            if (e.key === 'Enter' && inputValue.trim() && !parsing) {
              addLink(inputValue);
              setInputValue('');
            }
          }}
        />
        <Button
          size="sm"
          disabled={!inputValue.trim() || parsing}
          onClick={() => { addLink(inputValue); setInputValue(''); }}
        >
          {parsing ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <Plus className="w-4 h-4 me-1" />}
          {lang === 'ar' ? 'إضافة' : 'Add'}
        </Button>
      </div>

      {/* Bulk paste */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          {lang === 'ar' ? 'إضافة عدة روابط دفعة واحدة' : 'Bulk paste multiple links'}
        </summary>
        <div className="mt-2 space-y-2">
          <Textarea
            className="text-xs"
            rows={4}
            placeholder={lang === 'ar' ? 'رابط واحد في كل سطر...' : 'One link per line...'}
            value={bulkInput}
            onChange={e => setBulkInput(e.target.value)}
          />
          <Button size="sm" variant="outline" onClick={addBulkLinks} disabled={!bulkInput.trim() || parsing}>
            {parsing ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <Plus className="w-4 h-4 me-1" />}
            {lang === 'ar' ? 'إضافة الكل' : 'Add All'}
          </Button>
        </div>
      </details>

      {/* Parsing indicator */}
      {parsing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          {lang === 'ar' ? 'جارِ تحليل الرابط...' : 'Parsing link...'}
        </div>
      )}

      {/* Links list */}
      {links.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {lang === 'ar' ? `الروابط (${validCount} صالحة من ${links.length})` : `Links (${validCount} valid of ${links.length})`}
          </Label>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {links.map((link, idx) => (
              <div
                key={link.id}
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                  link.error ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-muted/30'
                }`}
              >
                <span className="font-mono text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                {link.origin && link.destination ? (
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="truncate">{link.origin.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-destructive shrink-0" />
                      <span className="truncate">{link.destination.name}</span>
                    </div>
                  </div>
                ) : (
                  <span className="flex-1 text-destructive truncate">{link.error}</span>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeLink(link.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate button */}
      {links.length >= 2 && validCount >= 2 && (
        <Button onClick={generateLink} className="w-full gap-2">
          <Link2 className="w-4 h-4" />
          {lang === 'ar' ? `دمج ${validCount} رحلة في رابط واحد` : `Combine ${validCount} trips into one link`}
        </Button>
      )}

      {links.length === 1 && (
        <p className="text-xs text-muted-foreground text-center">
          {lang === 'ar' ? 'أضف رابطاً آخر على الأقل لدمج الرحلات' : 'Add at least one more link to combine trips'}
        </p>
      )}

      {/* Combined result */}
      {combinedLink && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
          <Label className="text-sm font-semibold text-primary">
            {lang === 'ar' ? 'الرابط المجمع' : 'Combined Route Link'}
          </Label>
          <div className="flex gap-2">
            <Input readOnly value={combinedLink} className="text-xs flex-1 font-mono" />
            <Button size="sm" variant="outline" onClick={copyLink}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(combinedLink, '_blank')}>
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {lang === 'ar'
              ? 'يبدأ المسار من أقرب نقطة التقاط ويمر بجميع نقاط الالتقاط ثم جميع نقاط التوصيل'
              : 'Route starts from the nearest pickup, passes through all pickups, then all dropoffs'}
          </p>
        </div>
      )}

      {/* Clear all */}
      {links.length > 0 && (
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setLinks([]); setCombinedLink(null); }}>
          <Trash2 className="w-3 h-3 me-1" />
          {lang === 'ar' ? 'مسح الكل' : 'Clear All'}
        </Button>
      )}
    </div>
  );
};

export default LinkCombiner;
