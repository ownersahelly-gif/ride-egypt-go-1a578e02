import { useEffect, useState, useMemo } from 'react';
import BottomNav from '@/components/BottomNav';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { formatTime12h } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Ticket, ChevronLeft, ChevronRight, MessageCircle, Navigation, Key, Star, Phone, Users, Timer, AlertCircle, Receipt, X, RotateCcw, Ban, Edit3, CheckCircle2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MapView from '@/components/MapView';
import RideChat from '@/components/RideChat';
import RideRating from '@/components/RideRating';

/** Haversine distance in km */
const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const MyBookings = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [ratingBooking, setRatingBooking] = useState<any>(null);
  const [ratedBookingIds, setRatedBookingIds] = useState<Set<string>>(new Set());
  const [unreadBookings, setUnreadBookings] = useState<Set<string>>(new Set());
  const [driverProfiles, setDriverProfiles] = useState<Record<string, any>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [receiptBooking, setReceiptBooking] = useState<any>(null);
  const [peerBookings, setPeerBookings] = useState<Record<string, any[]>>({});
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [editStops, setEditStops] = useState<any[]>([]);
  const [editPickupMode, setEditPickupMode] = useState<'start' | 'stop'>('start');
  const [editDropoffMode, setEditDropoffMode] = useState<'end' | 'stop'>('end');
  const [editSelectedPickupStop, setEditSelectedPickupStop] = useState<any>(null);
  const [editSelectedDropoffStop, setEditSelectedDropoffStop] = useState<any>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [editMapCenter, setEditMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [editMapZoom, setEditMapZoom] = useState<number>(12);

  useEffect(() => {
    if (!user) return;
    const fetchBookings = async () => {
      const [{ data: bookingsData }, { data: ratingsData }] = await Promise.all([
        supabase.from('bookings').select('*, routes(*), shuttles(*)').eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('ratings').select('booking_id').eq('user_id', user.id),
      ]);
      setBookings(bookingsData || []);
      setRatedBookingIds(new Set((ratingsData || []).map(r => r.booking_id)));

      // Fetch unread messages
      const activeBookingIds = (bookingsData || [])
        .filter((b: any) => ['confirmed', 'boarded'].includes(b.status))
        .map((b: any) => b.id);
      if (activeBookingIds.length > 0) {
        const { data: unreadData } = await supabase
          .from('ride_messages')
          .select('booking_id')
          .in('booking_id', activeBookingIds)
          .neq('sender_id', user.id)
          .eq('is_read', false);
        const unread = new Set<string>();
        (unreadData || []).forEach((m: any) => unread.add(m.booking_id));
        setUnreadBookings(unread);
      }

      // Fetch driver profiles
      const driverIds = [...new Set((bookingsData || []).map((b: any) => b.shuttles?.driver_id).filter(Boolean))];
      if (driverIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', driverIds);
        const map: Record<string, any> = {};
        (profiles || []).forEach(p => { map[p.user_id] = p; });
        setDriverProfiles(map);
      }

      // Fetch peer bookings for confirmed rides (to count stops before you)
      const confirmedBookings = (bookingsData || []).filter((b: any) => ['confirmed', 'boarded'].includes(b.status));
      if (confirmedBookings.length > 0) {
        const peerMap: Record<string, any[]> = {};
        for (const b of confirmedBookings) {
          if (!b.shuttle_id) continue;
          const key = `${b.shuttle_id}_${b.scheduled_date}_${b.scheduled_time}`;
          if (!peerMap[key]) {
            const { data } = await supabase
              .from('bookings')
              .select('user_id, custom_pickup_lat, custom_pickup_lng, status')
              .eq('shuttle_id', b.shuttle_id)
              .eq('scheduled_date', b.scheduled_date)
              .eq('scheduled_time', b.scheduled_time)
              .in('status', ['confirmed', 'boarded', 'pending'])
              .neq('user_id', user.id);
            peerMap[key] = data || [];
          }
        }
        setPeerBookings(peerMap);
      }

      setLoading(false);
    };
    fetchBookings();
  }, [user]);

  const cancelBooking = async (id: string) => {
    setCancellingId(id);
    const booking = bookings.find(b => b.id === id);
    if (!booking) { setCancellingId(null); return; }

    // Calculate refund based on 24-hour policy
    const [h, m] = (booking.scheduled_time || '00:00').split(':').map(Number);
    const depTime = new Date(booking.scheduled_date + 'T00:00:00');
    depTime.setHours(h, m, 0);
    const hoursUntilDeparture = (depTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const refundPercent = hoursUntilDeparture > 24 ? 0.5 : 0;
    const refundAmount = Math.round(parseFloat(booking.total_price || 0) * refundPercent * 100) / 100;

    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (error) { toast({ title: t('auth.error'), description: error.message, variant: 'destructive' }); setCancellingId(null); return; }

    // Create refund record if applicable
    if (refundAmount > 0 && user) {
      await supabase.from('refunds').insert({
        user_id: user.id,
        booking_id: id,
        amount: refundAmount,
        reason: 'Rider cancelled 24+ hours before departure',
        status: 'pending',
        refund_type: 'pending',
      });
    }

    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
    toast({ 
      title: t('booking.cancelled'),
      description: refundAmount > 0
        ? (lang === 'ar' ? `سيتم استرداد ${refundAmount} جنيه (50%) إلى محفظتك` : `${refundAmount} EGP (50%) will be refunded to your wallet`)
        : (lang === 'ar' ? 'لا يوجد استرداد — الإلغاء خلال 24 ساعة من الموعد' : 'No refund — cancelled within 24 hours of departure'),
    });
    setCancellingId(null);
    setConfirmCancelId(null);
  };

  const [requestingRefund, setRequestingRefund] = useState<string | null>(null);
  const requestRefund = async (booking: any) => {
    if (!user) return;
    setRequestingRefund(booking.id);
    await supabase.from('refunds').insert({
      user_id: user.id,
      booking_id: booking.id,
      amount: parseFloat(booking.total_price || 0),
      reason: 'Rider requested refund for cancelled trip',
      status: 'pending',
      refund_type: 'pending',
    });
    toast({ title: lang === 'ar' ? 'تم إرسال طلب الاسترداد' : 'Refund request submitted' });
    setRequestingRefund(null);
  };

  /** Calculate simple ETA for a booking */
  const getEtaInfo = (booking: any) => {
    if (!['confirmed', 'boarded'].includes(booking.status)) return null;
    const shuttle = booking.shuttles;
    const route = booking.routes;
    if (!route) return null;

    // If shuttle has live location, use distance-based ETA
    const shuttleLoc = (shuttle?.current_lat && shuttle?.current_lng)
      ? { lat: shuttle.current_lat, lng: shuttle.current_lng }
      : null;

    const myPickup = {
      lat: booking.custom_pickup_lat ?? route.origin_lat,
      lng: booking.custom_pickup_lng ?? route.origin_lng,
    };

    // Count stops before me
    const key = `${booking.shuttle_id}_${booking.scheduled_date}_${booking.scheduled_time}`;
    const peers = peerBookings[key] || [];

    // Route progress projection
    const routeOrigin = { lat: route.origin_lat, lng: route.origin_lng };
    const routeDest = { lat: route.destination_lat, lng: route.destination_lng };
    const calcProgress = (point: { lat: number; lng: number }) => {
      const dx = point.lat - routeOrigin.lat;
      const dy = point.lng - routeOrigin.lng;
      const rx = routeDest.lat - routeOrigin.lat;
      const ry = routeDest.lng - routeOrigin.lng;
      const len = Math.sqrt(rx * rx + ry * ry);
      return len === 0 ? 0 : (dx * rx + dy * ry) / (len * len);
    };

    const myProgress = calcProgress(myPickup);
    const stopsBefore = peers.filter(p => {
      if (p.status === 'boarded') return false;
      const pPickup = {
        lat: p.custom_pickup_lat ?? route.origin_lat,
        lng: p.custom_pickup_lng ?? route.origin_lng,
      };
      return calcProgress(pPickup) < myProgress;
    }).length;

    if (shuttleLoc) {
      // Distance from shuttle to my pickup
      const distKm = haversineKm(shuttleLoc, myPickup);
      let etaMin = Math.ceil((distKm / 30) * 60);
      etaMin += stopsBefore;
      return { etaMin, stopsBefore, isLive: true };
    }

    // No live GPS — calculate ETA from scheduled departure time
    const now = new Date();
    const [h, m, s] = (booking.scheduled_time || '08:00:00').split(':').map(Number);
    const scheduledDeparture = new Date(booking.scheduled_date + 'T00:00:00');
    scheduledDeparture.setHours(h, m, s || 0);

    // If departure is in the future, show time until departure + estimated route time to user's stop
    const msUntilDeparture = scheduledDeparture.getTime() - now.getTime();
    if (msUntilDeparture > 0) {
      // Time until departure + proportional route time to user's stop + 1 min per stop
      const routeDurationMin = route.estimated_duration_minutes || 30;
      const progressToUser = Math.max(0, Math.min(1, myProgress));
      const routeTimeToUser = Math.ceil(routeDurationMin * progressToUser);
      const etaMin = Math.ceil(msUntilDeparture / 60000) + routeTimeToUser + stopsBefore;
      return { etaMin, stopsBefore, isLive: false };
    }

    // Departure was in the past but no live GPS — estimate based on elapsed time
    const elapsedMin = Math.abs(msUntilDeparture) / 60000;
    const routeDurationMin = route.estimated_duration_minutes || 30;
    const progressToUser = Math.max(0, Math.min(1, myProgress));
    const routeTimeToUser = Math.ceil(routeDurationMin * progressToUser);
    const remainingMin = Math.max(1, routeTimeToUser + stopsBefore - Math.floor(elapsedMin));
    return { etaMin: remainingMin, stopsBefore, isLive: false };
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-secondary/20 text-secondary',
    quote_pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-green-100 text-green-700',
    boarded: 'bg-primary/10 text-primary',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <header className="bg-card border-b border-border shrink-0 z-40 safe-area-top">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button></Link>
          <h1 className="text-lg font-bold text-foreground">{t('dashboard.myBookings')}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto container mx-auto px-4 py-8 max-w-2xl pb-24">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : bookings.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Ticket className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('dashboard.noBookings')}</p>
            <Link to="/book"><Button className="mt-4">{t('dashboard.bookFirst')}</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => {
              const dp = driverProfiles[booking.shuttles?.driver_id];
              const eta = getEtaInfo(booking);
              // Check if trip is expired (30+ min past departure, never started)
              const isExpired = (() => {
                if (!['confirmed', 'pending'].includes(booking.status)) return false;
                const [eh, em] = (booking.scheduled_time || '00:00').split(':').map(Number);
                const eDep = new Date(booking.scheduled_date + 'T00:00:00');
                eDep.setHours(eh, em, 0);
                return (Date.now() - eDep.getTime()) > 30 * 60 * 1000;
              })();
              const effectivelyCancelled = booking.status === 'cancelled' || isExpired;
              return (
                <div key={booking.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{lang === 'ar' ? booking.routes?.name_ar : booking.routes?.name_en}</h3>
                      {booking.trip_direction && booking.trip_direction !== 'both' && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${booking.trip_direction === 'go' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {booking.trip_direction === 'go' ? (lang === 'ar' ? '🚀 ذهاب' : '🚀 Go') : (lang === 'ar' ? '🔄 عودة' : '🔄 Return')}
                        </span>
                      )}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${effectivelyCancelled ? statusColors['cancelled'] : (statusColors[booking.status] || '')}`}>
                      {effectivelyCancelled
                        ? (lang === 'ar' ? 'ملغاة' : 'Cancelled')
                        : booking.status === 'boarded' 
                          ? (lang === 'ar' ? 'في الشاتل' : 'On Board')
                          : booking.status === 'quote_pending'
                            ? (lang === 'ar' ? 'بانتظار السعر' : 'Price Pending')
                            : t(`booking.status.${booking.status}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{booking.scheduled_date}</span>
                    <span>{formatTime12h(booking.scheduled_time, lang)}</span>
                    <span>{booking.seats} {t('booking.seat')}</span>
                  </div>

                  {/* Expired trip — 30+ min past departure, driver never started = treat as driver-cancelled */}
                  {['confirmed', 'pending'].includes(booking.status) && (() => {
                    const [h, m] = (booking.scheduled_time || '00:00').split(':').map(Number);
                    const depTime = new Date(booking.scheduled_date + 'T00:00:00');
                    depTime.setHours(h, m, 0);
                    const isExpired = (Date.now() - depTime.getTime()) > 30 * 60 * 1000;
                    if (!isExpired) return null;
                    return (
                      <div className="bg-destructive/15 border-2 border-destructive/30 rounded-xl p-4 mb-3 text-center">
                        <Ban className="w-10 h-10 text-destructive mx-auto mb-2" />
                        <p className="text-lg font-extrabold text-destructive uppercase tracking-wide">
                          {lang === 'ar' ? 'ملغاة' : 'CANCELLED'}
                        </p>
                        <p className="text-sm text-destructive/80 font-medium mt-1">
                          {lang === 'ar' ? 'تم الإلغاء بواسطة السائق — انتظر استرداد كامل المبلغ' : 'Cancelled by the driver — wait for your full refund'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {lang === 'ar' ? 'لم يبدأ السائق الرحلة في الوقت المحدد' : 'Driver did not start the trip on time'}
                        </p>
                      </div>
                    );
                  })()}

                  {/* ETA Banner for active rides — only show when trip has started (shuttle has live GPS) */}
                  {eta && eta.isLive && !booking.status.includes('boarded') && (
                    <div className={`${eta.isLive ? 'bg-primary/10' : 'bg-secondary/10'} rounded-lg p-3 mb-3 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <Timer className={`w-4 h-4 ${eta.isLive ? 'text-primary' : 'text-secondary'}`} />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            ~{eta.etaMin} {lang === 'ar' ? 'دقيقة' : 'min'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {eta.isLive
                              ? (lang === 'ar' ? 'تتبع مباشر' : 'Live tracking')
                              : (lang === 'ar' ? 'الوقت المقدر للوصول' : 'Estimated arrival')}
                          </p>
                        </div>
                      </div>
                      {eta.stopsBefore > 0 && (
                        <div className="text-center bg-card rounded-lg px-3 py-1.5">
                          <p className="text-sm font-bold text-primary">{eta.stopsBefore}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {lang === 'ar' ? 'توقفات قبلك' : 'stops before you'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Boarding code */}
                  {booking.boarding_code && ['confirmed', 'pending'].includes(booking.status) && !isExpired && (
                    <div className="bg-surface rounded-lg p-3 mb-3 flex items-center gap-3">
                      <Key className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'رمز الصعود' : 'Boarding Code'}</p>
                        <p className="text-xl font-mono font-bold text-foreground tracking-widest">{booking.boarding_code}</p>
                      </div>
                      <p className="text-xs text-muted-foreground ms-auto max-w-[120px] text-end">
                        {lang === 'ar' ? 'أظهر هذا الرمز للسائق' : 'Show this to your driver'}
                      </p>
                    </div>
                  )}

                  {/* Skipped notification */}
                  {booking.skipped_at && (
                    <div className="bg-destructive/10 rounded-lg p-3 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive">
                          {lang === 'ar' ? 'تم تخطيك — لم تحضر في الوقت' : 'Skipped — No show at pickup'}
                        </p>
                        {booking.skip_refund_amount > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {lang === 'ar' ? `سيتم استرداد ${booking.skip_refund_amount} جنيه (50%)` : `${booking.skip_refund_amount} EGP (50%) will be refunded`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rating prompt for completed rides */}
                  {booking.status === 'completed' && !ratedBookingIds.has(booking.id) && (
                    <div className="bg-secondary/10 rounded-lg p-3 mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-secondary" />
                        <span className="text-sm font-medium text-foreground">
                          {lang === 'ar' ? 'كيف كانت رحلتك؟' : 'How was your ride?'}
                        </span>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setRatingBooking(booking)}>
                        {lang === 'ar' ? 'قيّم الآن' : 'Rate Now'}
                      </Button>
                    </div>
                  )}

                  {/* Rated indicator */}
                  {booking.status === 'completed' && ratedBookingIds.has(booking.id) && (
                    <div className="flex items-center gap-1 mb-3 text-xs text-muted-foreground">
                      <Star className="w-3 h-3 fill-secondary text-secondary" />
                      {lang === 'ar' ? 'تم التقييم' : 'Rated'}
                    </div>
                  )}

                  {/* Driver info */}
                  {dp && (
                    <div className="flex items-center gap-2 mb-3 bg-surface rounded-lg p-3 text-sm">
                      <Users className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{dp.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.shuttles?.vehicle_model} · {booking.shuttles?.vehicle_plate}
                        </p>
                      </div>
                      {dp.phone && (
                        <a href={`tel:${dp.phone}`}>
                          <Button variant="outline" size="icon" className="rounded-full w-8 h-8">
                            <Phone className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>
                  )}

                   {/* Cancelled trip banner */}
                  {booking.status === 'cancelled' && !booking.skipped_at && (() => {
                    // Determine if cancelled by driver (departure passed 30+ min) or by rider
                    const [ch, cm] = (booking.scheduled_time || '00:00').split(':').map(Number);
                    const depT = new Date(booking.scheduled_date + 'T00:00:00');
                    depT.setHours(ch, cm, 0);
                    const msSinceDep = Date.now() - depT.getTime();
                    const cancelledByDriver = msSinceDep > 30 * 60 * 1000;
                    return (
                      <div className="bg-destructive/15 border-2 border-destructive/30 rounded-xl p-4 mb-3 text-center">
                        <Ban className="w-10 h-10 text-destructive mx-auto mb-2" />
                        <p className="text-lg font-extrabold text-destructive uppercase tracking-wide">
                          {lang === 'ar' ? 'ملغاة' : 'CANCELLED'}
                        </p>
                        <p className="text-sm text-destructive/80 font-medium mt-1">
                          {cancelledByDriver
                            ? (lang === 'ar' ? 'تم الإلغاء بواسطة السائق — انتظر استرداد كامل المبلغ' : 'Cancelled by the driver — wait for your full refund')
                            : (lang === 'ar' ? 'تم الإلغاء بواسطتك — انتظر مراجعة طلب الاسترداد' : 'Cancelled by you — wait for your refund review')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {lang === 'ar' ? 'التتبع والمحادثة غير متاحة' : 'Tracking and chat are disabled'}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Pickup & Dropoff info */}
                  {(booking.custom_pickup_name || booking.custom_dropoff_name) && (
                    <div className="bg-surface rounded-lg p-3 mb-3 space-y-1.5">
                      {booking.custom_pickup_name && (
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground">{lang === 'ar' ? 'نقطة الركوب' : 'Pickup'}</p>
                            <p className="text-foreground text-xs truncate">{booking.custom_pickup_name}</p>
                          </div>
                          {booking.custom_pickup_lat && booking.custom_pickup_lng && (
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${booking.custom_pickup_lat},${booking.custom_pickup_lng}`}
                              target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <Button variant="ghost" size="icon" className="w-7 h-7 text-primary">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                        </div>
                      )}
                      {booking.custom_dropoff_name && (
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground">{lang === 'ar' ? 'نقطة النزول' : 'Dropoff'}</p>
                            <p className="text-foreground text-xs truncate">{booking.custom_dropoff_name}</p>
                          </div>
                          {booking.custom_dropoff_lat && booking.custom_dropoff_lng && (
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${booking.custom_dropoff_lat},${booking.custom_dropoff_lng}`}
                              target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <Button variant="ghost" size="icon" className="w-7 h-7 text-primary">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                        </div>
                      )}
                      {['confirmed', 'pending', 'quote_pending'].includes(booking.status) && !isExpired && (
                        <Button variant="outline" size="sm" className="w-full mt-2" onClick={async () => {
                          setEditingBooking(booking);
                          if (booking.route_id) {
                            const { data: stops } = await supabase.from('stops').select('*').eq('route_id', booking.route_id).order('stop_order');
                            setEditStops(stops || []);
                          }
                          const route = booking.routes;
                          const isPickupAtOrigin = !booking.custom_pickup_lat || 
                            (Math.abs(booking.custom_pickup_lat - route?.origin_lat) < 0.001 && Math.abs(booking.custom_pickup_lng - route?.origin_lng) < 0.001);
                          const isDropoffAtDest = !booking.custom_dropoff_lat ||
                            (Math.abs(booking.custom_dropoff_lat - route?.destination_lat) < 0.001 && Math.abs(booking.custom_dropoff_lng - route?.destination_lng) < 0.001);
                          setEditPickupMode(isPickupAtOrigin ? 'start' : 'stop');
                          setEditDropoffMode(isDropoffAtDest ? 'end' : 'stop');
                          setEditSelectedPickupStop(null);
                          setEditSelectedDropoffStop(null);
                          setEditMapCenter(undefined);
                          setEditMapZoom(12);
                        }}>
                          <Edit3 className="w-3.5 h-3.5 me-1" />
                          {lang === 'ar' ? 'تعديل الموقع' : 'Edit Location'}
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">
                      {booking.status === 'quote_pending' || (booking.total_price === 0 && booking.status !== 'completed')
                        ? (lang === 'ar' ? '⏳ بانتظار تأكيد السعر' : '⏳ Price pending confirmation')
                        : `${booking.total_price} EGP`}
                    </span>
                    <div className="flex items-center gap-2">
                      {['confirmed', 'boarded'].includes(booking.status) && !isExpired && dp?.phone && (
                        <a href={`tel:${dp.phone}`}>
                          <Button variant="outline" size="sm">
                            <Phone className="w-3.5 h-3.5 me-1" />
                            {lang === 'ar' ? 'اتصل' : 'Call'}
                          </Button>
                        </a>
                      )}
                      {['confirmed', 'boarded'].includes(booking.status) && !isExpired && (
                        <Button variant="outline" size="sm" className="relative" onClick={() => setChatBookingId(booking.id)}>
                          <MessageCircle className="w-3.5 h-3.5 me-1" />
                          {lang === 'ar' ? 'محادثة' : 'Chat'}
                          {unreadBookings.has(booking.id) && (
                            <span className="absolute -top-1 -end-1 w-2.5 h-2.5 bg-destructive rounded-full" />
                          )}
                        </Button>
                      )}
                      {['confirmed', 'boarded'].includes(booking.status) && !isExpired && (
                        <Link to={`/track?booking=${booking.id}`}>
                          <Button variant="outline" size="sm">
                            <Navigation className="w-3.5 h-3.5 me-1" />
                            {lang === 'ar' ? 'تتبع' : 'Track'}
                          </Button>
                        </Link>
                      )}
                      {booking.status === 'pending' && (
                        <Button variant="destructive" size="sm" onClick={() => setConfirmCancelId(booking.id)}
                          disabled={cancellingId === booking.id}>
                          {cancellingId === booking.id ? (lang === 'ar' ? 'جاري...' : 'Cancelling...') : t('booking.cancel')}
                        </Button>
                      )}
                      {(booking.status === 'cancelled' || isExpired) && !booking.skipped_at && parseFloat(booking.total_price || 0) > 0 && (
                        <Button variant="outline" size="sm" onClick={() => requestRefund(booking)}
                          disabled={requestingRefund === booking.id}>
                          <RotateCcw className="w-3.5 h-3.5 me-1" />
                          {requestingRefund === booking.id
                            ? (lang === 'ar' ? 'جاري...' : 'Sending...')
                            : (lang === 'ar' ? 'طلب استرداد' : 'Request Refund')}
                        </Button>
                      )}
                      {booking.status === 'completed' && (
                        <Button variant="outline" size="sm" onClick={() => setReceiptBooking(booking)}>
                          <Receipt className="w-3.5 h-3.5 me-1" />
                          {lang === 'ar' ? 'إيصال' : 'Receipt'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <RideChat
        bookingId={chatBookingId || ''}
        isOpen={!!chatBookingId}
        onClose={() => setChatBookingId(null)}
        onRead={() => {
          if (chatBookingId) {
            setUnreadBookings(prev => { const next = new Set(prev); next.delete(chatBookingId); return next; });
          }
        }}
      />

      {ratingBooking && (
        <RideRating
          bookingId={ratingBooking.id}
          driverId={ratingBooking.shuttles?.driver_id}
          routeName={lang === 'ar' ? ratingBooking.routes?.name_ar : ratingBooking.routes?.name_en}
          isOpen={!!ratingBooking}
          onClose={() => setRatingBooking(null)}
          onRated={() => setRatedBookingIds(prev => new Set([...prev, ratingBooking.id]))}
        />
      )}

      {/* Cancel Confirmation Dialog with refund policy */}
      {confirmCancelId && (() => {
        const bk = bookings.find(b => b.id === confirmCancelId);
        const [h2, m2] = (bk?.scheduled_time || '00:00').split(':').map(Number);
        const dep = new Date((bk?.scheduled_date || '') + 'T00:00:00');
        dep.setHours(h2, m2, 0);
        const hoursLeft = (dep.getTime() - Date.now()) / (1000 * 60 * 60);
        const willRefund = hoursLeft > 24;
        const refundAmt = willRefund ? Math.round(parseFloat(bk?.total_price || 0) * 0.5 * 100) / 100 : 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card border border-border rounded-2xl p-6 w-[90%] max-w-sm shadow-xl space-y-4">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
                <h3 className="text-lg font-bold text-foreground">
                  {lang === 'ar' ? 'إلغاء الحجز؟' : 'Cancel Booking?'}
                </h3>
              </div>
              <div className="bg-surface rounded-lg p-3 space-y-2 text-sm">
                {willRefund ? (
                  <div className="flex items-start gap-2">
                    <RotateCcw className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-foreground">
                      {lang === 'ar'
                        ? `سيتم استرداد ${refundAmt} جنيه (50%) إلى محفظتك`
                        : `${refundAmt} EGP (50%) will be refunded to your wallet`}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <Ban className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-destructive font-medium">
                      {lang === 'ar'
                        ? 'لا يوجد استرداد — الإلغاء خلال 24 ساعة من موعد الرحلة'
                        : 'No refund — cancelling within 24 hours of departure'}
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {lang === 'ar' ? 'هذا الإجراء لا يمكن التراجع عنه.' : 'This action cannot be undone.'}
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmCancelId(null)}>
                  {lang === 'ar' ? 'لا، ارجع' : 'No, Go Back'}
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => cancelBooking(confirmCancelId)}
                  disabled={cancellingId === confirmCancelId}>
                  {cancellingId === confirmCancelId ? (lang === 'ar' ? 'جاري...' : 'Cancelling...') : (lang === 'ar' ? 'نعم، إلغاء' : 'Yes, Cancel')}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Ride Receipt Modal */}
      {receiptBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-2xl p-6 w-[90%] max-w-sm shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                {lang === 'ar' ? 'إيصال الرحلة' : 'Ride Receipt'}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setReceiptBooking(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{lang === 'ar' ? 'المسار' : 'Route'}</span>
                <span className="font-medium text-foreground">{lang === 'ar' ? receiptBooking.routes?.name_ar : receiptBooking.routes?.name_en}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{lang === 'ar' ? 'التاريخ' : 'Date'}</span>
                <span className="font-medium text-foreground">{receiptBooking.scheduled_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{lang === 'ar' ? 'الوقت' : 'Time'}</span>
                <span className="font-medium text-foreground">{receiptBooking.scheduled_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{lang === 'ar' ? 'المقاعد' : 'Seats'}</span>
                <span className="font-medium text-foreground">{receiptBooking.seats}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{lang === 'ar' ? 'نوع الرحلة' : 'Trip Type'}</span>
                <span className="font-medium text-foreground">
                  {receiptBooking.trip_direction === 'both' ? (lang === 'ar' ? 'ذهاب وعودة' : 'Round Trip') : receiptBooking.trip_direction === 'go' ? (lang === 'ar' ? 'ذهاب' : 'Going') : (lang === 'ar' ? 'عودة' : 'Return')}
                </span>
              </div>
              {receiptBooking.boarded_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{lang === 'ar' ? 'وقت الصعود' : 'Boarded At'}</span>
                  <span className="font-medium text-foreground">{new Date(receiptBooking.boarded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
              {receiptBooking.dropped_off_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{lang === 'ar' ? 'وقت النزول' : 'Dropped Off'}</span>
                  <span className="font-medium text-foreground">{new Date(receiptBooking.dropped_off_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
              {receiptBooking.boarded_at && receiptBooking.dropped_off_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{lang === 'ar' ? 'المدة' : 'Duration'}</span>
                  <span className="font-medium text-foreground">
                    {Math.round((new Date(receiptBooking.dropped_off_at).getTime() - new Date(receiptBooking.boarded_at).getTime()) / 60000)} {lang === 'ar' ? 'دقيقة' : 'min'}
                  </span>
                </div>
              )}
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-semibold text-foreground">{lang === 'ar' ? 'الإجمالي' : 'Total'}</span>
                <span className="text-lg font-bold text-primary">{receiptBooking.total_price} EGP</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{lang === 'ar' ? 'طريقة الدفع' : 'Payment'}</span>
                <span className="text-foreground">{receiptBooking.payment_proof_url ? 'InstaPay' : (lang === 'ar' ? 'كاش' : 'Cash')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Location Modal */}
      {editingBooking && (() => {
        const route = editingBooking.routes;
        const pickupStops = editStops.filter((s: any) => s.stop_type === 'pickup' || s.stop_type === 'both');
        const dropoffStops = editStops.filter((s: any) => s.stop_type === 'dropoff' || s.stop_type === 'both');

        // Build map markers
        const mapMarkers: { lat: number; lng: number; label?: string; color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' }[] = [];
        if (route) {
          mapMarkers.push({ lat: route.origin_lat, lng: route.origin_lng, label: 'A', color: 'green' });
          mapMarkers.push({ lat: route.destination_lat, lng: route.destination_lng, label: 'B', color: 'red' });
        }
        editStops.forEach((stop: any) => {
          mapMarkers.push({ lat: stop.lat, lng: stop.lng, label: (stop.stop_order + 1).toString(), color: 'blue' });
        });
        if (editPickupMode === 'stop' && editSelectedPickupStop) {
          mapMarkers.push({ lat: editSelectedPickupStop.lat, lng: editSelectedPickupStop.lng, label: '✓', color: 'green' });
        }
        if (editDropoffMode === 'stop' && editSelectedDropoffStop) {
          mapMarkers.push({ lat: editSelectedDropoffStop.lat, lng: editSelectedDropoffStop.lng, label: '✓', color: 'red' });
        }

        // Build connection lines from origin → stops → destination
        const connectionLines: { from: { lat: number; lng: number }; to: { lat: number; lng: number }; color?: string }[] = [];
        if (route) {
          const sortedStops = [...editStops].sort((a: any, b: any) => a.stop_order - b.stop_order);
          const points = [
            { lat: route.origin_lat, lng: route.origin_lng },
            ...sortedStops.map((s: any) => ({ lat: s.lat, lng: s.lng })),
            { lat: route.destination_lat, lng: route.destination_lng },
          ];
          for (let i = 0; i < points.length - 1; i++) {
            connectionLines.push({ from: points[i], to: points[i + 1], color: '#3B82F6' });
          }
        }

        const zoomToPoint = (lat: number, lng: number) => {
          setEditMapCenter({ lat, lng });
          setEditMapZoom(16);
        };

        const handleSave = async () => {
          setSavingLocation(true);
          const updates: any = {};
          if (editPickupMode === 'start' && route) {
            updates.custom_pickup_lat = route.origin_lat;
            updates.custom_pickup_lng = route.origin_lng;
            updates.custom_pickup_name = lang === 'ar' ? route.origin_name_ar : route.origin_name_en;
          } else if (editPickupMode === 'stop' && editSelectedPickupStop) {
            updates.custom_pickup_lat = editSelectedPickupStop.lat;
            updates.custom_pickup_lng = editSelectedPickupStop.lng;
            updates.custom_pickup_name = lang === 'ar' ? editSelectedPickupStop.name_ar : editSelectedPickupStop.name_en;
          }
          if (editDropoffMode === 'end' && route) {
            updates.custom_dropoff_lat = route.destination_lat;
            updates.custom_dropoff_lng = route.destination_lng;
            updates.custom_dropoff_name = lang === 'ar' ? route.destination_name_ar : route.destination_name_en;
          } else if (editDropoffMode === 'stop' && editSelectedDropoffStop) {
            updates.custom_dropoff_lat = editSelectedDropoffStop.lat;
            updates.custom_dropoff_lng = editSelectedDropoffStop.lng;
            updates.custom_dropoff_name = lang === 'ar' ? editSelectedDropoffStop.name_ar : editSelectedDropoffStop.name_en;
          }

          if (Object.keys(updates).length === 0) {
            setSavingLocation(false);
            return;
          }

          const { error } = await supabase.from('bookings').update(updates).eq('id', editingBooking.id);
          if (error) {
            toast({ title: lang === 'ar' ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
          } else {
            setBookings(prev => prev.map(b => b.id === editingBooking.id ? { ...b, ...updates } : b));
            toast({ title: lang === 'ar' ? 'تم تحديث الموقع' : 'Location updated' });
            setEditingBooking(null);
          }
          setSavingLocation(false);
        };

        const canSave = (editPickupMode === 'start' || !!editSelectedPickupStop) && (editDropoffMode === 'end' || !!editSelectedDropoffStop);

        return (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <header className="bg-card border-b border-border shrink-0 safe-area-top">
              <div className="flex items-center h-14 px-4 gap-3">
                <Button variant="ghost" size="icon" onClick={() => setEditingBooking(null)}>
                  <X className="w-5 h-5" />
                </Button>
                <h2 className="text-base font-bold text-foreground flex-1">
                  {lang === 'ar' ? 'تعديل موقع الركوب / النزول' : 'Edit Pickup / Dropoff'}
                </h2>
                <Button size="sm" disabled={savingLocation || !canSave} onClick={handleSave}>
                  {savingLocation ? (lang === 'ar' ? 'جاري...' : 'Saving...') : (lang === 'ar' ? 'حفظ' : 'Save')}
                </Button>
              </div>
            </header>

            {/* Map */}
            {route && (
              <div className="h-48 shrink-0">
                <MapView
                  origin={{ lat: route.origin_lat, lng: route.origin_lng }}
                  destination={{ lat: route.destination_lat, lng: route.destination_lng }}
                  waypoints={editStops.map((s: any) => ({ lat: s.lat, lng: s.lng }))}
                  showDirections={true}
                  markers={mapMarkers}
                  center={editMapCenter}
                  zoom={editMapZoom}
                  className="h-full w-full"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Pickup selector */}
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-1 text-sm">
                  <MapPin className="w-4 h-4 text-green-500" />
                  {lang === 'ar' ? 'نقطة الركوب' : 'Pickup'}
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => { setEditPickupMode('start'); setEditSelectedPickupStop(null); if (route) zoomToPoint(route.origin_lat, route.origin_lng); }}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${editPickupMode === 'start' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'}`}>
                    {lang === 'ar' ? '🚏 نقطة الانطلاق' : '🚏 Starting Point'}
                  </button>
                  {pickupStops.length > 0 && (
                    <button onClick={() => { setEditPickupMode('stop'); setEditSelectedPickupStop(null); }}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${editPickupMode === 'stop' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'}`}>
                      {lang === 'ar' ? '📍 نقطة توقف' : '📍 Bus Stop'}
                    </button>
                  )}
                </div>
                {editPickupMode === 'start' && (
                  <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <p className="font-medium text-xs">{lang === 'ar' ? route?.origin_name_ar : route?.origin_name_en}</p>
                  </div>
                )}
                {editPickupMode === 'stop' && (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {pickupStops.map((stop: any) => (
                      <button key={stop.id} onClick={() => { setEditSelectedPickupStop(stop); zoomToPoint(stop.lat, stop.lng); }}
                        className={`w-full text-start px-3 py-2 rounded-lg text-xs border transition-colors flex items-center gap-2 ${
                          editSelectedPickupStop?.id === stop.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:border-primary/50'
                        }`}>
                        <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">{stop.stop_order + 1}</span>
                        <span className="truncate">{lang === 'ar' ? stop.name_ar : stop.name_en}</span>
                      </button>
                    ))}
                  </div>
                )}
                {editPickupMode === 'stop' && editSelectedPickupStop && (
                  <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="font-medium">#{editSelectedPickupStop.stop_order + 1} {lang === 'ar' ? editSelectedPickupStop.name_ar : editSelectedPickupStop.name_en} ✓</span>
                  </div>
                )}
              </div>

              {/* Dropoff selector */}
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-1 text-sm">
                  <MapPin className="w-4 h-4 text-destructive" />
                  {lang === 'ar' ? 'نقطة النزول' : 'Dropoff'}
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => { setEditDropoffMode('end'); setEditSelectedDropoffStop(null); if (route) zoomToPoint(route.destination_lat, route.destination_lng); }}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${editDropoffMode === 'end' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'}`}>
                    {lang === 'ar' ? '🏁 نقطة الوصول' : '🏁 End Point'}
                  </button>
                  {dropoffStops.length > 0 && (
                    <button onClick={() => { setEditDropoffMode('stop'); setEditSelectedDropoffStop(null); }}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${editDropoffMode === 'stop' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'}`}>
                      {lang === 'ar' ? '📍 نقطة توقف' : '📍 Bus Stop'}
                    </button>
                  )}
                </div>
                {editDropoffMode === 'end' && (
                  <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <p className="font-medium text-xs">{lang === 'ar' ? route?.destination_name_ar : route?.destination_name_en}</p>
                  </div>
                )}
                {editDropoffMode === 'stop' && (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {dropoffStops.map((stop: any) => (
                      <button key={stop.id} onClick={() => { setEditSelectedDropoffStop(stop); zoomToPoint(stop.lat, stop.lng); }}
                        className={`w-full text-start px-3 py-2 rounded-lg text-xs border transition-colors flex items-center gap-2 ${
                          editSelectedDropoffStop?.id === stop.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:border-primary/50'
                        }`}>
                        <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">{stop.stop_order + 1}</span>
                        <span className="truncate">{lang === 'ar' ? stop.name_ar : stop.name_en}</span>
                      </button>
                    ))}
                  </div>
                )}
                {editDropoffMode === 'stop' && editSelectedDropoffStop && (
                  <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="font-medium">#{editSelectedDropoffStop.stop_order + 1} {lang === 'ar' ? editSelectedDropoffStop.name_ar : editSelectedDropoffStop.name_en} ✓</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      
      <BottomNav />
    </div>
  );
};

export default MyBookings;