import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Star, Car, MapPin, Users, Clock } from 'lucide-react';

const DriverProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { lang } = useLanguage();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [profile, setProfile] = useState<any>(null);
  const [shuttle, setShuttle] = useState<any>(null);
  const [ratings, setRatings] = useState<any[]>([]);
  const [rideCount, setRideCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchDriver = async () => {
      // Get shuttle IDs first
      const { data: shuttlesData } = await supabase.from('shuttles').select('id').eq('driver_id', id);
      const shuttleIds = (shuttlesData || []).map(s => s.id);

      const [{ data: profileData }, { data: shuttleData }, { data: ratingsData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', id).single(),
        supabase.from('shuttles').select('*').eq('driver_id', id).limit(1).maybeSingle(),
        supabase.from('ratings').select('*').eq('driver_id', id).order('created_at', { ascending: false }),
      ]);

      let completedCount = 0;
      if (shuttleIds.length > 0) {
        const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'completed').in('shuttle_id', shuttleIds);
        completedCount = count || 0;
      }

      // Fetch reviewer names
      const reviewerIds = [...new Set((ratingsData || []).map(r => r.user_id))];
      let reviewerMap: Record<string, string> = {};
      if (reviewerIds.length > 0) {
        const { data: reviewers } = await supabase.from('profiles').select('user_id, full_name').in('user_id', reviewerIds);
        (reviewers || []).forEach(r => { reviewerMap[r.user_id] = r.full_name || ''; });
      }

      setProfile(profileData);
      setShuttle(shuttleData);
      setRatings((ratingsData || []).map(r => ({ ...r, reviewer_name: reviewerMap[r.user_id] })));
      setRideCount(completedCount);
      setLoading(false);
    };
    fetchDriver();
  }, [id]);

  if (loading) {
    return (
      <div className="h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{lang === 'ar' ? 'السائق غير موجود' : 'Driver not found'}</p>
        <Link to="/dashboard"><Button variant="outline">{lang === 'ar' ? 'رجوع' : 'Go Back'}</Button></Link>
      </div>
    );
  }

  const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <header className="bg-card border-b border-border shrink-0 z-40 safe-area-top">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button></Link>
          <h1 className="text-lg font-bold text-foreground">{lang === 'ar' ? 'ملف السائق' : 'Driver Profile'}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto container mx-auto px-4 py-6 max-w-lg pb-24">
        {/* Driver Info */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden mb-3">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <Car className="w-12 h-12 text-primary" />
            )}
          </div>
          <h2 className="text-xl font-bold text-foreground">{profile.full_name || (lang === 'ar' ? 'سائق' : 'Driver')}</h2>
          {shuttle && (
            <p className="text-sm text-muted-foreground mt-1">{shuttle.vehicle_model} · {shuttle.vehicle_plate}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="w-5 h-5 fill-secondary text-secondary" />
              <span className="text-2xl font-bold text-foreground">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
            </div>
            <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'التقييم' : 'Rating'}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{ratings.length}</p>
            <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'تقييمات' : 'Reviews'}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{rideCount}</p>
            <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'رحلات' : 'Rides'}</p>
          </div>
        </div>

        {/* Reviews */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">{lang === 'ar' ? 'التقييمات' : 'Reviews'} ({ratings.length})</h3>
          {ratings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{lang === 'ar' ? 'لا توجد تقييمات بعد' : 'No reviews yet'}</p>
          ) : (
            ratings.map((r) => (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-4 h-4 ${s <= r.rating ? 'fill-secondary text-secondary' : 'text-muted-foreground/20'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="text-sm text-foreground">{r.comment}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {(r as any).profiles?.full_name || (lang === 'ar' ? 'راكب' : 'Rider')}
                </p>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default DriverProfile;