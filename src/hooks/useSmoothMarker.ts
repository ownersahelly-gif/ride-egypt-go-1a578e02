import { useRef, useCallback, useEffect, useState } from 'react';

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Smoothly interpolates a map marker between GPS coordinate updates.
 * Uses requestAnimationFrame for 60fps animation between positions.
 */
export const useSmoothMarker = (animationDurationMs = 1500) => {
  const [displayPosition, setDisplayPosition] = useState<LatLng | null>(null);
  const targetRef = useRef<LatLng | null>(null);
  const startRef = useRef<LatLng | null>(null);
  const animStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const animate = useCallback((time: number) => {
    if (!startRef.current || !targetRef.current) return;

    const elapsed = time - animStartRef.current;
    const progress = Math.min(elapsed / animationDurationMs, 1);

    // Ease-out cubic for natural deceleration
    const eased = 1 - Math.pow(1 - progress, 3);

    const lat = startRef.current.lat + (targetRef.current.lat - startRef.current.lat) * eased;
    const lng = startRef.current.lng + (targetRef.current.lng - startRef.current.lng) * eased;

    setDisplayPosition({ lat, lng });

    if (progress < 1) {
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [animationDurationMs]);

  const updatePosition = useCallback((newPos: LatLng) => {
    // Cancel any ongoing animation
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    // If no previous position, snap immediately
    if (!displayPosition && !startRef.current) {
      setDisplayPosition(newPos);
      startRef.current = newPos;
      targetRef.current = newPos;
      return;
    }

    // Start smooth animation from current display position to new target
    startRef.current = displayPosition || startRef.current;
    targetRef.current = newPos;
    animStartRef.current = performance.now();
    rafRef.current = requestAnimationFrame(animate);
  }, [displayPosition, animate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return { position: displayPosition, updatePosition };
};
