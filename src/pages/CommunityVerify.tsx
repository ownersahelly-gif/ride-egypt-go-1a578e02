import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';
import { ChevronLeft, ChevronRight, Upload, Shield, Building2, CheckCircle2 } from 'lucide-react';

export default function CommunityVerify() {
  const { id: communityId } = useParams();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [community, setCommunity] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, { text?: string; file?: File }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !communityId) return;
    Promise.all([
      supabase.from('communities').select('*').eq('id', communityId).maybeSingle(),
      supabase.from('community_verification_questions').select('*').eq('community_id', communityId).order('sort_order'),
    ]).then(([cRes, qRes]) => {
      setCommunity(cRes.data);
      setQuestions(qRes.data || []);
      setLoading(false);
    });
  }, [user, communityId]);

  const setText = (qId: string, text: string) =>
    setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], text } }));
  const setFile = (qId: string, file: File | null) =>
    setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], file: file || undefined } }));

  const uploadFile = async (file: File, qId: string): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `${user!.id}/${communityId}/${qId}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('community-verifications').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('community-verifications').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!user || !communityId) return;
    // Validate required
    for (const q of questions) {
      if (q.required) {
        const a = answers[q.id];
        if (q.field_type === 'file') {
          if (!a?.file) {
            toast({ title: lang === 'ar' ? 'حقل مطلوب' : 'Required field', description: lang === 'ar' ? q.label_ar : q.label_en, variant: 'destructive' });
            return;
          }
        } else if (!a?.text?.trim()) {
          toast({ title: lang === 'ar' ? 'حقل مطلوب' : 'Required field', description: lang === 'ar' ? q.label_ar : q.label_en, variant: 'destructive' });
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      // Upsert membership (pending)
      const { data: membership, error: mErr } = await supabase
        .from('community_memberships')
        .upsert({
          user_id: user.id,
          community_id: communityId,
          status: 'pending',
          admin_notes: null,
        }, { onConflict: 'user_id,community_id' })
        .select()
        .single();
      if (mErr) throw mErr;

      // Clear old answers (in case re-applying)
      await supabase.from('community_verification_answers').delete().eq('membership_id', membership.id);

      // Insert new answers
      const rows: any[] = [];
      for (const q of questions) {
        const a = answers[q.id];
        if (!a) continue;
        if (q.field_type === 'file' && a.file) {
          const url = await uploadFile(a.file, q.id);
          rows.push({ membership_id: membership.id, question_id: q.id, answer_file_url: url });
        } else if (a.text) {
          rows.push({ membership_id: membership.id, question_id: q.id, answer_text: a.text });
        }
      }
      if (rows.length > 0) {
        const { error: aErr } = await supabase.from('community_verification_answers').insert(rows);
        if (aErr) throw aErr;
      }

      toast({ title: lang === 'ar' ? 'تم الإرسال!' : 'Submitted!', description: lang === 'ar' ? 'سيتم مراجعة طلبك قريباً' : 'Your application will be reviewed soon.' });
      navigate('/communities');
    } catch (e: any) {
      toast({ title: lang === 'ar' ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!community) {
    return (
      <div className="h-screen flex items-center justify-center text-muted-foreground">
        {lang === 'ar' ? 'المجتمع غير موجود' : 'Community not found.'}
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 shrink-0 safe-area-top">
        <button onClick={() => navigate('/communities')} className="mb-3"><Back className="w-6 h-6" /></button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          {lang === 'ar' ? community.name_ar : community.name_en}
        </h1>
        <p className="text-sm text-primary-foreground/70 mt-1">
          {lang === 'ar' ? 'أكمل التحقق للانضمام لهذا المجتمع' : 'Complete verification to join this community'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {questions.length === 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground text-center">
                {lang === 'ar' ? 'لا توجد أسئلة تحقق. اضغط للانضمام.' : 'No verification questions set. Tap submit to join.'}
              </p>
            </CardContent>
          </Card>
        )}

        {questions.map(q => {
          const label = lang === 'ar' ? q.label_ar : q.label_en;
          return (
            <Card key={q.id}>
              <CardContent className="p-4 space-y-2">
                <Label>
                  {label} {q.required && <span className="text-destructive">*</span>}
                </Label>
                {q.field_type === 'text' && (
                  <Input value={answers[q.id]?.text || ''} onChange={e => setText(q.id, e.target.value)} />
                )}
                {q.field_type === 'number' && (
                  <Input type="number" value={answers[q.id]?.text || ''} onChange={e => setText(q.id, e.target.value)} />
                )}
                {q.field_type === 'dropdown' && (
                  <Select value={answers[q.id]?.text || ''} onValueChange={v => setText(q.id, v)}>
                    <SelectTrigger><SelectValue placeholder={lang === 'ar' ? 'اختر' : 'Select'} /></SelectTrigger>
                    <SelectContent>
                      {(q.options || []).map((o: any, i: number) => {
                        const val = typeof o === 'string' ? o : (o.value || o.label_en);
                        const lbl = typeof o === 'string' ? o : (lang === 'ar' ? (o.label_ar || o.label_en) : o.label_en);
                        return <SelectItem key={i} value={val}>{lbl}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                )}
                {q.field_type === 'file' && (
                  <label className="flex items-center gap-2 border border-dashed border-border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    {answers[q.id]?.file ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-sm text-muted-foreground truncate">
                      {answers[q.id]?.file?.name || (lang === 'ar' ? 'اختر ملف أو صورة' : 'Choose file or photo')}
                    </span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setFile(q.id, e.target.files?.[0] || null)} />
                  </label>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
          <Shield className="w-4 h-4 mr-2" />
          {submitting ? (lang === 'ar' ? 'جاري الإرسال...' : 'Submitting...') : (lang === 'ar' ? 'إرسال للمراجعة' : 'Submit for Review')}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}
