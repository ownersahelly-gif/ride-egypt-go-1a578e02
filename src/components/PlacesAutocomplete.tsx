import { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

let googleMapsPlacesLoader: Promise<void> | null = null;

const loadGoogleMapsPlaces = async () => {
  if (!GOOGLE_MAPS_KEY || typeof window === 'undefined') return;
  if (window.google?.maps?.places) return;
  if (googleMapsPlacesLoader) return googleMapsPlacesLoader;

  googleMapsPlacesLoader = new Promise<void>((resolve, reject) => {
    const finalize = () => {
      if (window.google?.maps?.places) {
        resolve();
      } else {
        googleMapsPlacesLoader = null;
        reject(new Error('Google Maps Places failed to initialize'));
      }
    };

    const existingScript = document.querySelector('script[data-google-maps="places"]') as HTMLScriptElement | null;
    if (existingScript) {
      if (window.google?.maps?.places) {
        resolve();
        return;
      }

      existingScript.addEventListener('load', finalize, { once: true });
      existingScript.addEventListener('error', () => {
        googleMapsPlacesLoader = null;
        reject(new Error('Failed to load Google Maps Places'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-google-maps', 'places');
    script.addEventListener('load', finalize, { once: true });
    script.addEventListener('error', () => {
      googleMapsPlacesLoader = null;
      reject(new Error('Failed to load Google Maps Places'));
    }, { once: true });
    document.head.appendChild(script);
  });

  return googleMapsPlacesLoader;
};

interface PlacesAutocompleteProps {
  placeholder?: string;
  value?: string;
  onSelect: (place: { name: string; lat: number; lng: number }) => void;
  iconColor?: string;
  className?: string;
}

const PlacesAutocomplete = ({ placeholder, value, onSelect, iconColor = 'text-primary', className }: PlacesAutocompleteProps) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingApi, setLoadingApi] = useState(false);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const initializeServices = useCallback(() => {
    if (window.google?.maps?.places && !autocompleteService.current) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      const div = document.createElement('div');
      placesService.current = new google.maps.places.PlacesService(div);
    }

    return !!autocompleteService.current && !!placesService.current;
  }, []);

  const ensureGoogleReady = useCallback(async () => {
    if (!GOOGLE_MAPS_KEY) return false;
    if (initializeServices()) return true;

    try {
      if (mountedRef.current) setLoadingApi(true);
      await loadGoogleMapsPlaces();
      return initializeServices();
    } catch (error) {
      console.error('[PlacesAutocomplete] Failed to load Google Maps Places', error);
      return false;
    } finally {
      if (mountedRef.current) setLoadingApi(false);
    }
  }, [initializeServices]);

  useEffect(() => {
    if (value !== undefined) setInputValue(value);
  }, [value]);

  useEffect(() => {
    mountedRef.current = true;

    const handleClickOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('pointerdown', handleClickOutside);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInput = async (val: string) => {
    setInputValue(val);

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    if (!val || val.length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    const ready = await ensureGoogleReady();
    if (!ready || !autocompleteService.current) return;

    debounceRef.current = window.setTimeout(() => {
      autocompleteService.current?.getPlacePredictions(
        { input: val, componentRestrictions: { country: 'eg' } },
        (results) => {
          if (!mountedRef.current) return;
          setPredictions(results || []);
          setShowDropdown(!!results?.length);
        }
      );
    }, 180);
  };

  const handleSelect = async (prediction: google.maps.places.AutocompletePrediction) => {
    const ready = await ensureGoogleReady();
    if (!ready || !placesService.current) return;

    placesService.current.getDetails(
      { placeId: prediction.place_id, fields: ['geometry', 'name', 'formatted_address'] },
      (place) => {
        if (!mountedRef.current || !place?.geometry?.location) return;

        const name = place.formatted_address || place.name || prediction.description;
        setInputValue(name || '');
        setShowDropdown(false);
        setPredictions([]);
        onSelect({
          name: name || '',
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    );
  };

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className="relative">
        <MapPin className={`absolute start-3 top-3 h-4 w-4 ${iconColor}`} />
        <Input
          placeholder={placeholder}
          className="ps-10"
          value={inputValue}
          onChange={(e) => {
            const nextValue = e.target.value;
            setInputValue(nextValue);
            onSelect({ name: nextValue, lat: 30.0444, lng: 31.2357 });
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {loadingApi ? (
        <Loader2 className="absolute start-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <MapPin className={`absolute start-3 top-3 h-4 w-4 ${iconColor}`} />
      )}

      <Input
        placeholder={placeholder}
        className={`ps-10 ${className || ''}`}
        value={inputValue}
        onChange={(e) => {
          void handleInput(e.target.value);
        }}
        onFocus={(e) => {
          void ensureGoogleReady();
          if (predictions.length > 0) setShowDropdown(true);
          const target = e.currentTarget;
          const scrollContainer = target.closest("[data-keyboard-scroll-container]") as HTMLElement | null;
          window.setTimeout(() => {
            try {
              if (scrollContainer) {
                const containerRect = scrollContainer.getBoundingClientRect();
                const targetRect = target.getBoundingClientRect();
                const nextTop = scrollContainer.scrollTop + (targetRect.top - containerRect.top) - 96;
                scrollContainer.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
              }
              target.scrollIntoView({ block: "center", behavior: "smooth" });
            } catch {
              target.scrollIntoView();
            }
          }, 450);
        }}
      />

      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                void handleSelect(p);
              }}
              className="w-full border-b border-border px-4 py-3 text-start text-sm transition-colors last:border-0 hover:bg-muted"
            >
              <p className="font-medium text-foreground">{p.structured_formatting.main_text}</p>
              <p className="text-xs text-muted-foreground">{p.structured_formatting.secondary_text}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlacesAutocomplete;