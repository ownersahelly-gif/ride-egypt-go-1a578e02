import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Trash2, Edit, ChevronDown, ChevronUp, CheckCircle2, XCircle,
  Building2, ListChecks, Users as UsersIcon, FileText,
} from 'lucide-react';

type Community = {
  id: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  logo_url: string | null;
  allowed_modes: string[];
  status: string;
};

type Question = {
  id: string;
  community_id: string;
  label_en: string;
  label_ar: string;
  field_type: 'text' | 'number' | 'dropdown' | 'file';
  options: any;
  required: boolean;
  sort_order: number;
};

type Membership = {
  id: string;
  user_id: string;
  community_id: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

const ALL_MODES = [
  { key: 'car_sharing', en: 'Car-sharing only', ar: 'مشاركة فقط' },
  { key: 'fuel_share', en: 'Fuel share', ar: 'مشاركة وقود' },
  { key: 'paid', en: 'Paid', ar: 'مدفوع' },
];

export default function CommunitiesAdmin({ lang }: { lang: 'en' | 'ar' }) {
  const { toast } = useToast();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [questions, setQuestions] = useState<Record<string, Question[]>>({});
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [answers, setAnswers] = useState<Record<string, any[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Community | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Community form state
  const [form, setForm] = useState({
    name_en: '', name_ar: '', description_en: '', description_ar: '',
    logo_url: '', allowed_modes: ['car_sharing', 'fuel_share', 'paid'] as string[],
    status: 'active',
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [cRes, qRes, mRes] = await Promise.all([
      supabase.from('communities').select('*').order('created_at', { ascending: false }),
      supabase.from('community_verification_questions').select('*').order('sort_order'),
      supabase.from('community_memberships').select('*').order('created_at', { ascending: false }),
    ]);
    const cs = (cRes.data || []) as Community[];
    setCommunities(cs);
    const qByC: Record<string, Question[]> = {};
    (qRes.data || []).forEach((q: any) => {
      qByC[q.community_id] = qByC[q.community_id] || [];
      qByC[q.community_id].push(q);
    });
    setQuestions(qByC);
    const ms = (mRes.data || []) as Membership[];
    setMemberships(ms);

    // Fetch profiles for memberships
    const userIds = [...new Set(ms.map(m => m.user_id))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', userIds);
      const pMap: Record<string, any> = {};
      (profs || []).forEach((p: any) => { pMap[p.user_id] = p; });
      setProfiles(pMap);
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      name_en: '', name_ar: '', description_en: '', description_ar: '',
      logo_url: '', allowed_modes: ['car_sharing', 'fuel_share', 'paid'],
      status: 'active',
    });
    setShowForm(true);
  };

  const openEdit = (c: Community) => {
    setEditing(c);
    setForm({
      name_en: c.name_en, name_ar: c.name_ar,
      description_en: c.description_en || '', description_ar: c.description_ar || '',
      logo_url: c.logo_url || '',
      allowed_modes: c.allowed_modes || [],
      status: c.status,
    });
    setShowForm(true);
  };

  const saveCommunity = async () => {
    if (!form.name_en || !form.name_ar) {
      toast({ title: lang === 'ar' ? 'الاسم مطلوب' : 'Name required', variant: 'destructive' });
      return;
    }
    if (form.allowed_modes.length === 0) {
      toast({ title: lang === 'ar' ? 'اختر وضعاً واحداً على الأقل' : 'Pick at least one mode', variant: 'destructive' });
      return;
    }
    const payload = {
      name_en: form.name_en, name_ar: form.name_ar,
      description_en: form.description_en || null,
      description_ar: form.description_ar || null,
      logo_url: form.logo_url || null,
      allowed_modes: form.allowed_modes,
      status: form.status,
    };
    const { error } = editing
      ? await supabase.from('communities').update(payload).eq('id', editing.id)
      : await supabase.from('communities').insert(payload);
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    toast({ title: lang === 'ar' ? 'تم الحفظ' : 'Saved' });
    setShowForm(false);
    fetchAll();
  };

  const deleteCommunity = async (id: string) => {
    if (!confirm(lang === 'ar' ? 'حذف هذا المجتمع؟' : 'Delete this community?')) return;
    const { error } = await supabase.from('communities').delete().eq('id', id);
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    toast({ title: lang === 'ar' ? 'تم الحذف' : 'Deleted' });
    fetchAll();
  };

  const toggleMode = (mode: string) => {
    setForm(f => ({
      ...f,
      allowed_modes: f.allowed_modes.includes(mode)
        ? f.allowed_modes.filter(m => m !== mode)
        : [...f.allowed_modes, mode],
    }));
  };

  const addQuestion = async (communityId: string) => {
    const existing = questions[communityId] || [];
    const { error } = await supabase.from('community_verification_questions').insert({
      community_id: communityId,
      label_en: 'New question',
      label_ar: 'سؤال جديد',
      field_type: 'text',
      required: true,
      sort_order: existing.length,
      options: [],
    });
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    fetchAll();
  };

  const updateQuestion = async (q: Question, patch: Partial<Question>) => {
    const { error } = await supabase.from('community_verification_questions')
      .update(patch).eq('id', q.id);
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    fetchAll();
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm(lang === 'ar' ? 'حذف السؤال؟' : 'Delete question?')) return;
    await supabase.from('community_verification_questions').delete().eq('id', id);
    fetchAll();
  };

  const loadMembershipAnswers = async (membershipId: string) => {
    if (answers[membershipId]) return;
    const { data } = await supabase.from('community_verification_answers')
      .select('*').eq('membership_id', membershipId);
    setAnswers(prev => ({ ...prev, [membershipId]: data || [] }));
  };

  const reviewMembership = async (id: string, status: 'approved' | 'rejected') => {
    const notes = status === 'rejected'
      ? prompt(lang === 'ar' ? 'سبب الرفض (اختياري)' : 'Rejection reason (optional)') || null
      : null;
    const { error } = await supabase.from('community_memberships')
      .update({ status, admin_notes: notes }).eq('id', id);
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    toast({ title: status === 'approved'
      ? (lang === 'ar' ? 'تمت الموافقة' : 'Approved')
      : (lang === 'ar' ? 'تم الرفض' : 'Rejected') });
    fetchAll();
  };

  const pendingMemberships = memberships.filter(m => m.status === 'pending');

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          {lang === 'ar' ? 'المجتمعات' : 'Communities'}
        </h2>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          {lang === 'ar' ? 'إنشاء مجتمع' : 'New Community'}
        </Button>
      </div>

      {/* Pending memberships banner */}
      {pendingMemberships.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-3 flex items-center gap-2 text-sm">
            <UsersIcon className="w-4 h-4 text-amber-600" />
            <span className="font-medium">
              {lang === 'ar'
                ? `${pendingMemberships.length} طلب انضمام في الانتظار`
                : `${pendingMemberships.length} pending membership request${pendingMemberships.length === 1 ? '' : 's'}`}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Community form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? (lang === 'ar' ? 'تعديل المجتمع' : 'Edit Community')
                : (lang === 'ar' ? 'إنشاء مجتمع جديد' : 'New Community')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{lang === 'ar' ? 'الاسم (EN)' : 'Name (EN)'}</Label>
                <Input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} placeholder="AUC" />
              </div>
              <div>
                <Label>{lang === 'ar' ? 'الاسم (AR)' : 'Name (AR)'}</Label>
                <Input value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} placeholder="الجامعة الأمريكية" />
              </div>
            </div>
            <div>
              <Label>{lang === 'ar' ? 'الوصف (EN)' : 'Description (EN)'}</Label>
              <Textarea value={form.description_en} onChange={e => setForm({ ...form, description_en: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>{lang === 'ar' ? 'الوصف (AR)' : 'Description (AR)'}</Label>
              <Textarea value={form.description_ar} onChange={e => setForm({ ...form, description_ar: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>{lang === 'ar' ? 'رابط الشعار' : 'Logo URL'}</Label>
              <Input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label className="mb-2 block">{lang === 'ar' ? 'الأوضاع المسموحة (الأعضاء يختارون عند نشر الرحلة)' : 'Allowed modes (members pick when posting)'}</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_MODES.map(m => (
                  <button
                    key={m.key} type="button"
                    onClick={() => toggleMode(m.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.allowed_modes.includes(m.key)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {lang === 'ar' ? m.ar : m.en}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{lang === 'ar' ? 'الحالة' : 'Status'}</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{lang === 'ar' ? 'نشط' : 'Active'}</SelectItem>
                  <SelectItem value="inactive">{lang === 'ar' ? 'غير نشط' : 'Inactive'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveCommunity} className="w-full">
              {lang === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Communities list */}
      {communities.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          {lang === 'ar' ? 'لا يوجد مجتمعات بعد' : 'No communities yet. Create one above.'}
        </p>
      )}

      <div className="space-y-3">
        {communities.map(c => {
          const isOpen = expanded === c.id;
          const qs = questions[c.id] || [];
          const ms = memberships.filter(m => m.community_id === c.id);
          const pending = ms.filter(m => m.status === 'pending');
          const approved = ms.filter(m => m.status === 'approved');
          return (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {c.logo_url && <img src={c.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold truncate">{lang === 'ar' ? c.name_ar : c.name_en}</p>
                        <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-xs">{c.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span>{approved.length} {lang === 'ar' ? 'عضو' : 'members'}</span>
                        {pending.length > 0 && (
                          <span className="text-amber-600 font-medium">
                            {pending.length} {lang === 'ar' ? 'في الانتظار' : 'pending'}
                          </span>
                        )}
                        <span>{qs.length} {lang === 'ar' ? 'أسئلة' : 'questions'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(c.allowed_modes || []).map(m => {
                          const mode = ALL_MODES.find(am => am.key === m);
                          return mode && <Badge key={m} variant="outline" className="text-[10px]">{lang === 'ar' ? mode.ar : mode.en}</Badge>;
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteCommunity(c.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setExpanded(isOpen ? null : c.id)}>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t pt-3 space-y-4">
                    {/* Questions builder */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-sm flex items-center gap-1.5">
                          <ListChecks className="w-4 h-4" />
                          {lang === 'ar' ? 'أسئلة التحقق' : 'Verification Questions'}
                        </h4>
                        <Button size="sm" variant="outline" onClick={() => addQuestion(c.id)}>
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          {lang === 'ar' ? 'إضافة سؤال' : 'Add Question'}
                        </Button>
                      </div>
                      {qs.length === 0 && <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'لا أسئلة' : 'No questions yet.'}</p>}
                      <div className="space-y-2">
                        {qs.map((q, idx) => (
                          <Card key={q.id} className="bg-muted/30">
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteQuestion(q.id)}>
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Label EN" value={q.label_en}
                                  onChange={e => updateQuestion(q, { label_en: e.target.value })}
                                />
                                <Input
                                  placeholder="Label AR" value={q.label_ar}
                                  onChange={e => updateQuestion(q, { label_ar: e.target.value })}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2 items-end">
                                <div>
                                  <Label className="text-xs">{lang === 'ar' ? 'النوع' : 'Field type'}</Label>
                                  <Select value={q.field_type} onValueChange={v => updateQuestion(q, { field_type: v as any })}>
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text">{lang === 'ar' ? 'نص' : 'Text'}</SelectItem>
                                      <SelectItem value="number">{lang === 'ar' ? 'رقم' : 'Number'}</SelectItem>
                                      <SelectItem value="dropdown">{lang === 'ar' ? 'قائمة' : 'Dropdown'}</SelectItem>
                                      <SelectItem value="file">{lang === 'ar' ? 'ملف / صورة' : 'File / Photo'}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-center gap-2 pb-1">
                                  <Switch checked={q.required} onCheckedChange={v => updateQuestion(q, { required: v })} />
                                  <Label className="text-xs">{lang === 'ar' ? 'إجباري' : 'Required'}</Label>
                                </div>
                              </div>
                              {q.field_type === 'dropdown' && (
                                <div>
                                  <Label className="text-xs">{lang === 'ar' ? 'الخيارات (سطر لكل خيار)' : 'Options (one per line)'}</Label>
                                  <Textarea
                                    rows={3}
                                    value={(q.options || []).map((o: any) => typeof o === 'string' ? o : o.label_en || o.value || '').join('\n')}
                                    onChange={e => {
                                      const opts = e.target.value.split('\n').filter(Boolean).map(line => ({ value: line, label_en: line, label_ar: line }));
                                      updateQuestion(q, { options: opts });
                                    }}
                                    placeholder={lang === 'ar' ? 'هندسة\nأعمال\nعلوم' : 'Engineering\nBusiness\nScience'}
                                  />
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Memberships */}
                    <div>
                      <h4 className="font-semibold text-sm flex items-center gap-1.5 mb-2">
                        <UsersIcon className="w-4 h-4" />
                        {lang === 'ar' ? 'الأعضاء والطلبات' : 'Members & Applications'}
                      </h4>
                      {ms.length === 0 && <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'لا أعضاء بعد' : 'No applications yet.'}</p>}
                      <div className="space-y-2">
                        {ms.map(m => {
                          const prof = profiles[m.user_id];
                          return (
                            <Card key={m.id} className="bg-muted/30">
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{prof?.full_name || m.user_id.slice(0, 8)}</p>
                                    {prof?.phone && <p className="text-xs text-muted-foreground">{prof.phone}</p>}
                                  </div>
                                  <Badge variant={m.status === 'approved' ? 'default' : m.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                                    {m.status}
                                  </Badge>
                                </div>
                                <Button
                                  size="sm" variant="ghost" className="text-xs h-7"
                                  onClick={() => loadMembershipAnswers(m.id)}
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  {answers[m.id] ? `${answers[m.id].length} ${lang === 'ar' ? 'إجابات' : 'answers'}` : (lang === 'ar' ? 'عرض الإجابات' : 'View answers')}
                                </Button>
                                {answers[m.id] && (
                                  <div className="space-y-1 bg-background rounded p-2">
                                    {answers[m.id].map((a: any) => {
                                      const q = qs.find(qq => qq.id === a.question_id);
                                      return (
                                        <div key={a.id} className="text-xs">
                                          <span className="font-medium">{q ? (lang === 'ar' ? q.label_ar : q.label_en) : a.question_id}: </span>
                                          {a.answer_file_url ? (
                                            <a href={a.answer_file_url} target="_blank" rel="noreferrer" className="text-primary underline">
                                              {lang === 'ar' ? 'عرض الملف' : 'View file'}
                                            </a>
                                          ) : (
                                            <span>{a.answer_text}</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {m.status === 'pending' && (
                                  <div className="flex gap-2">
                                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => reviewMembership(m.id, 'approved')}>
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                      {lang === 'ar' ? 'قبول' : 'Approve'}
                                    </Button>
                                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => reviewMembership(m.id, 'rejected')}>
                                      <XCircle className="w-3.5 h-3.5 mr-1" />
                                      {lang === 'ar' ? 'رفض' : 'Reject'}
                                    </Button>
                                  </div>
                                )}
                                {m.admin_notes && (
                                  <p className="text-xs text-muted-foreground italic">"{m.admin_notes}"</p>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
