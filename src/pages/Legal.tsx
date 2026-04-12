import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Shield, FileText, MapPin, Scale } from 'lucide-react';

type Section = 'privacy' | 'terms' | 'location' | 'licenses';

const Legal = () => {
  const { lang, appName } = useLanguage();
  const [searchParams] = useSearchParams();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;
  const initialSection = (searchParams.get('section') as Section) || 'privacy';
  const [active, setActive] = useState<Section>(initialSection);

  const tabs: { key: Section; icon: React.ReactNode; label: { en: string; ar: string } }[] = [
    { key: 'privacy', icon: <Shield className="w-4 h-4" />, label: { en: 'Privacy Policy', ar: 'سياسة الخصوصية' } },
    { key: 'terms', icon: <FileText className="w-4 h-4" />, label: { en: 'Terms of Service', ar: 'شروط الخدمة' } },
    { key: 'location', icon: <MapPin className="w-4 h-4" />, label: { en: 'Location Usage', ar: 'استخدام الموقع' } },
    { key: 'licenses', icon: <Scale className="w-4 h-4" />, label: { en: 'Licenses', ar: 'التراخيص' } },
  ];

  const lastUpdated = '2026-04-12';

  const content: Record<Section, { en: React.ReactNode; ar: React.ReactNode }> = {
    privacy: {
      en: (
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
          <h3 className="text-base font-semibold text-foreground">1. Information We Collect</h3>
          <p>We collect information you provide directly: name, email address, phone number, and profile photo. We also collect usage data including ride history, booking preferences, and app interaction patterns.</p>
          <h3 className="text-base font-semibold text-foreground">2. Location Data</h3>
          <p>{appName} collects precise location data to provide core ride services: matching you with nearby shuttles, real-time ride tracking, and navigation. Location is collected when the app is in use and, for drivers, in the background during active trips. See the Location Usage section for full details.</p>
          <h3 className="text-base font-semibold text-foreground">3. How We Use Your Information</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Provide, maintain, and improve our shuttle services</li>
            <li>Process bookings, payments, and refunds</li>
            <li>Send ride confirmations, updates, and safety notifications</li>
            <li>Verify driver and carpool participant identities</li>
            <li>Respond to customer support requests</li>
            <li>Ensure safety and prevent fraud</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">4. Data Sharing</h3>
          <p>We share limited data with: drivers (your name and pickup location for active rides), payment processors, cloud infrastructure providers (Supabase), and map services (Google Maps). We do not sell your personal data to third parties.</p>
          <h3 className="text-base font-semibold text-foreground">5. Data Retention</h3>
          <p>Account data is retained while your account is active. Ride history is kept for 2 years for service improvement and dispute resolution. You may request deletion of your account and associated data at any time.</p>
          <h3 className="text-base font-semibold text-foreground">6. Data Security</h3>
          <p>We use industry-standard encryption (TLS/SSL) for data in transit and at rest. Access to user data is restricted to authorized personnel only.</p>
          <h3 className="text-base font-semibold text-foreground">7. Your Rights</h3>
          <p>You have the right to access, correct, or delete your personal data. You can export your data or withdraw consent for optional processing at any time through the app settings or by contacting us.</p>
          <h3 className="text-base font-semibold text-foreground">8. Children's Privacy</h3>
          <p>{appName} is not intended for children under 16. We do not knowingly collect personal information from children.</p>
          <h3 className="text-base font-semibold text-foreground">9. Contact</h3>
          <p>For privacy inquiries, contact us at privacy@{appName.toLowerCase()}.app</p>
        </div>
      ),
      ar: (
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">آخر تحديث: {lastUpdated}</p>
          <h3 className="text-base font-semibold text-foreground">1. المعلومات التي نجمعها</h3>
          <p>نجمع المعلومات التي تقدمها مباشرة: الاسم، البريد الإلكتروني، رقم الهاتف، وصورة الملف الشخصي. كما نجمع بيانات الاستخدام بما في ذلك سجل الرحلات وتفضيلات الحجز.</p>
          <h3 className="text-base font-semibold text-foreground">2. بيانات الموقع</h3>
          <p>يجمع {appName} بيانات الموقع الدقيقة لتقديم خدمات النقل الأساسية: مطابقتك مع الحافلات القريبة، تتبع الرحلة في الوقت الفعلي، والملاحة. يتم جمع الموقع عند استخدام التطبيق، وللسائقين، في الخلفية أثناء الرحلات النشطة.</p>
          <h3 className="text-base font-semibold text-foreground">3. كيف نستخدم معلوماتك</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>تقديم خدمات النقل وصيانتها وتحسينها</li>
            <li>معالجة الحجوزات والمدفوعات والمبالغ المستردة</li>
            <li>إرسال تأكيدات الرحلات والتحديثات وإشعارات السلامة</li>
            <li>التحقق من هوية السائقين والمشاركين في مشاركة السيارات</li>
            <li>الرد على طلبات دعم العملاء</li>
            <li>ضمان السلامة ومنع الاحتيال</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">4. مشاركة البيانات</h3>
          <p>نشارك بيانات محدودة مع: السائقين (اسمك وموقع الالتقاط للرحلات النشطة)، معالجي الدفع، مزودي البنية التحتية السحابية (Supabase)، وخدمات الخرائط (Google Maps). لا نبيع بياناتك الشخصية لأطراف ثالثة.</p>
          <h3 className="text-base font-semibold text-foreground">5. الاحتفاظ بالبيانات</h3>
          <p>يتم الاحتفاظ ببيانات الحساب طالما حسابك نشط. يتم الاحتفاظ بسجل الرحلات لمدة عامين لتحسين الخدمة وحل النزاعات. يمكنك طلب حذف حسابك والبيانات المرتبطة به في أي وقت.</p>
          <h3 className="text-base font-semibold text-foreground">6. أمان البيانات</h3>
          <p>نستخدم تشفيرًا متوافقًا مع معايير الصناعة (TLS/SSL) للبيانات أثناء النقل وفي حالة الراحة.</p>
          <h3 className="text-base font-semibold text-foreground">7. حقوقك</h3>
          <p>لديك الحق في الوصول إلى بياناتك الشخصية أو تصحيحها أو حذفها. يمكنك تصدير بياناتك أو سحب الموافقة على المعالجة الاختيارية في أي وقت.</p>
          <h3 className="text-base font-semibold text-foreground">8. خصوصية الأطفال</h3>
          <p>{appName} غير مخصص للأطفال دون سن 16 عامًا. لا نجمع عن قصد معلومات شخصية من الأطفال.</p>
          <h3 className="text-base font-semibold text-foreground">9. التواصل</h3>
          <p>للاستفسارات المتعلقة بالخصوصية، تواصل معنا على privacy@{appName.toLowerCase()}.app</p>
        </div>
      ),
    },
    terms: {
      en: (
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
          <h3 className="text-base font-semibold text-foreground">1. Acceptance of Terms</h3>
          <p>By downloading, installing, or using {appName}, you agree to be bound by these Terms of Service. If you do not agree, do not use the app.</p>
          <h3 className="text-base font-semibold text-foreground">2. Service Description</h3>
          <p>{appName} is a shared shuttle booking platform connecting riders with shuttle drivers along predefined routes in Egypt. We also facilitate carpooling between verified users.</p>
          <h3 className="text-base font-semibold text-foreground">3. User Accounts</h3>
          <p>You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your credentials. One account per person; accounts are non-transferable.</p>
          <h3 className="text-base font-semibold text-foreground">4. Booking & Payments</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Prices are displayed before booking confirmation</li>
            <li>Payments are processed via InstaPay or wallet balance</li>
            <li>Cancellation refunds follow our refund policy (50% if driver already departed)</li>
            <li>Bundle/package purchases are non-refundable once rides are used</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">5. User Conduct</h3>
          <p>Users must not: use the service for illegal purposes, harass drivers or other passengers, provide false identity documents, attempt to manipulate the booking system, or interfere with the app's operation.</p>
          <h3 className="text-base font-semibold text-foreground">6. Driver Requirements</h3>
          <p>Drivers must maintain valid licenses, vehicle registration, and insurance. Vehicles must pass safety inspections. {appName} reserves the right to deactivate driver accounts for safety violations.</p>
          <h3 className="text-base font-semibold text-foreground">7. Limitation of Liability</h3>
          <p>{appName} acts as a platform connecting riders and drivers. We are not a transportation company. While we verify drivers and vehicles, we are not liable for incidents during rides beyond what is required by applicable Egyptian law.</p>
          <h3 className="text-base font-semibold text-foreground">8. Intellectual Property</h3>
          <p>All content, trademarks, and technology in {appName} are owned by or licensed to us. You may not copy, modify, or distribute any part of the app without written permission.</p>
          <h3 className="text-base font-semibold text-foreground">9. Termination</h3>
          <p>We may suspend or terminate your account for violations of these terms. You may delete your account at any time through the app.</p>
          <h3 className="text-base font-semibold text-foreground">10. Governing Law</h3>
          <p>These terms are governed by the laws of the Arab Republic of Egypt. Disputes shall be resolved in Egyptian courts.</p>
        </div>
      ),
      ar: (
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">آخر تحديث: {lastUpdated}</p>
          <h3 className="text-base font-semibold text-foreground">1. قبول الشروط</h3>
          <p>بتنزيل أو تثبيت أو استخدام {appName}، فإنك توافق على الالتزام بشروط الخدمة هذه. إذا لم توافق، لا تستخدم التطبيق.</p>
          <h3 className="text-base font-semibold text-foreground">2. وصف الخدمة</h3>
          <p>{appName} هو منصة حجز حافلات مشتركة تربط الركاب بسائقي الحافلات على مسارات محددة مسبقًا في مصر. كما نسهل مشاركة السيارات بين المستخدمين المتحقق منهم.</p>
          <h3 className="text-base font-semibold text-foreground">3. حسابات المستخدمين</h3>
          <p>يجب عليك تقديم معلومات دقيقة عند إنشاء حساب. أنت مسؤول عن الحفاظ على سرية بيانات الاعتماد الخاصة بك. حساب واحد لكل شخص.</p>
          <h3 className="text-base font-semibold text-foreground">4. الحجز والمدفوعات</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>يتم عرض الأسعار قبل تأكيد الحجز</li>
            <li>تتم معالجة المدفوعات عبر InstaPay أو رصيد المحفظة</li>
            <li>تتبع المبالغ المستردة سياسة الاسترداد الخاصة بنا</li>
            <li>مشتريات الباقات غير قابلة للاسترداد بمجرد استخدام الرحلات</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">5. سلوك المستخدم</h3>
          <p>يجب على المستخدمين عدم: استخدام الخدمة لأغراض غير قانونية، مضايقة السائقين أو الركاب الآخرين، تقديم وثائق هوية مزورة، أو التلاعب بنظام الحجز.</p>
          <h3 className="text-base font-semibold text-foreground">6. متطلبات السائق</h3>
          <p>يجب على السائقين الحفاظ على رخص قيادة سارية وتسجيل المركبة والتأمين. يجب أن تجتاز المركبات فحوصات السلامة.</p>
          <h3 className="text-base font-semibold text-foreground">7. حدود المسؤولية</h3>
          <p>{appName} يعمل كمنصة تربط الركاب بالسائقين. نحن لسنا شركة نقل. بينما نتحقق من السائقين والمركبات، لسنا مسؤولين عن الحوادث أثناء الرحلات بما يتجاوز ما يتطلبه القانون المصري المعمول به.</p>
          <h3 className="text-base font-semibold text-foreground">8. الملكية الفكرية</h3>
          <p>جميع المحتويات والعلامات التجارية والتكنولوجيا في {appName} مملوكة لنا أو مرخصة لنا.</p>
          <h3 className="text-base font-semibold text-foreground">9. الإنهاء</h3>
          <p>يمكننا تعليق أو إنهاء حسابك لمخالفات هذه الشروط. يمكنك حذف حسابك في أي وقت من خلال التطبيق.</p>
          <h3 className="text-base font-semibold text-foreground">10. القانون الحاكم</h3>
          <p>تخضع هذه الشروط لقوانين جمهورية مصر العربية.</p>
        </div>
      ),
    },
    location: {
      en: (
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
          <h3 className="text-base font-semibold text-foreground">Why We Use Your Location</h3>
          <p>{appName} requires access to your device's location to provide its core transportation services. Here is exactly how we use location data:</p>
          <h3 className="text-base font-semibold text-foreground">For Riders</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>When in use:</strong> To show nearby shuttle stops, calculate pickup/drop-off points, and display your position on the ride tracking map</li>
            <li><strong>Not collected in background:</strong> We do not track rider location when the app is closed</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">For Drivers</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>When in use:</strong> Navigation to pickup/drop-off stops, proximity detection for arrival notifications</li>
            <li><strong>Background location:</strong> During active trips only, to provide real-time tracking to passengers. Background tracking stops immediately when a trip is completed or ended</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">For Carpool</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Setting pickup and drop-off points when posting or requesting carpool rides</li>
            <li>Route matching between drivers and riders</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">Data Handling</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Location data is transmitted over encrypted connections (TLS)</li>
            <li>Real-time location is broadcast only to relevant ride participants</li>
            <li>Location history is not stored permanently — only the last known position during active rides</li>
            <li>You can revoke location permission at any time in your device settings (core features will be limited)</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">Third-Party Access</h3>
          <p>Location data is shared with Google Maps for map display and navigation only. Google's privacy policy applies to their processing of this data.</p>
        </div>
      ),
      ar: (
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">آخر تحديث: {lastUpdated}</p>
          <h3 className="text-base font-semibold text-foreground">لماذا نستخدم موقعك</h3>
          <p>يتطلب {appName} الوصول إلى موقع جهازك لتقديم خدمات النقل الأساسية. إليك كيف نستخدم بيانات الموقع بالضبط:</p>
          <h3 className="text-base font-semibold text-foreground">للركاب</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>أثناء الاستخدام:</strong> لعرض محطات الحافلات القريبة وحساب نقاط الالتقاط/النزول وعرض موقعك على خريطة تتبع الرحلة</li>
            <li><strong>لا يتم جمعه في الخلفية:</strong> لا نتتبع موقع الراكب عند إغلاق التطبيق</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">للسائقين</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>أثناء الاستخدام:</strong> الملاحة إلى محطات الالتقاط/النزول، كشف القرب لإشعارات الوصول</li>
            <li><strong>موقع الخلفية:</strong> أثناء الرحلات النشطة فقط، لتوفير تتبع في الوقت الفعلي للركاب. يتوقف تتبع الخلفية فورًا عند اكتمال الرحلة</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">لمشاركة السيارات</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>تحديد نقاط الالتقاط والنزول عند نشر أو طلب رحلات مشاركة السيارات</li>
            <li>مطابقة المسارات بين السائقين والركاب</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">معالجة البيانات</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>يتم نقل بيانات الموقع عبر اتصالات مشفرة (TLS)</li>
            <li>يتم بث الموقع في الوقت الفعلي فقط للمشاركين المعنيين في الرحلة</li>
            <li>لا يتم تخزين سجل الموقع بشكل دائم</li>
            <li>يمكنك إلغاء إذن الموقع في أي وقت من إعدادات جهازك</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">وصول الأطراف الثالثة</h3>
          <p>يتم مشاركة بيانات الموقع مع Google Maps لعرض الخرائط والملاحة فقط.</p>
        </div>
      ),
    },
    data: {
      en: (
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
          <h3 className="text-base font-semibold text-foreground">Third-Party Services & Data Providers</h3>
          <p>{appName} uses the following third-party services to operate:</p>
          <h3 className="text-base font-semibold text-foreground">Supabase (Database & Authentication)</h3>
          <p>Hosts user accounts, ride data, and booking information. Data is stored in secure, encrypted cloud infrastructure. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">Supabase Privacy Policy</a></p>
          <h3 className="text-base font-semibold text-foreground">Google Maps Platform</h3>
          <p>Provides maps, geocoding, place search, and navigation. Location data is sent to Google for map rendering and directions. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Privacy Policy</a></p>
          <h3 className="text-base font-semibold text-foreground">Bunny CDN (Media Storage)</h3>
          <p>Stores user-uploaded images such as profile photos, driver documents, and payment proofs. <a href="https://bunny.net/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">Bunny.net Privacy Policy</a></p>
          <h3 className="text-base font-semibold text-foreground">Apple Push Notification Service (APNs)</h3>
          <p>Delivers ride updates and booking notifications to your iOS device. Device tokens are stored to route notifications.</p>
          <h3 className="text-base font-semibold text-foreground">Data Processing</h3>
          <p>All third-party providers are bound by their respective privacy policies and data processing agreements. We only share the minimum data necessary for each service to function.</p>
        </div>
      ),
      ar: (
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">آخر تحديث: {lastUpdated}</p>
          <h3 className="text-base font-semibold text-foreground">الخدمات ومزودو البيانات من الأطراف الثالثة</h3>
          <p>يستخدم {appName} الخدمات التالية من أطراف ثالثة للتشغيل:</p>
          <h3 className="text-base font-semibold text-foreground">Supabase (قاعدة البيانات والمصادقة)</h3>
          <p>يستضيف حسابات المستخدمين وبيانات الرحلات ومعلومات الحجز. يتم تخزين البيانات في بنية تحتية سحابية مشفرة وآمنة.</p>
          <h3 className="text-base font-semibold text-foreground">Google Maps Platform</h3>
          <p>يوفر الخرائط والترميز الجغرافي والبحث عن الأماكن والملاحة. يتم إرسال بيانات الموقع إلى Google لعرض الخرائط والاتجاهات.</p>
          <h3 className="text-base font-semibold text-foreground">Bunny CDN (تخزين الوسائط)</h3>
          <p>يخزن الصور التي يرفعها المستخدمون مثل صور الملف الشخصي ووثائق السائق وإثباتات الدفع.</p>
          <h3 className="text-base font-semibold text-foreground">Apple Push Notification Service (APNs)</h3>
          <p>يقدم تحديثات الرحلات وإشعارات الحجز إلى جهاز iOS الخاص بك.</p>
          <h3 className="text-base font-semibold text-foreground">معالجة البيانات</h3>
          <p>جميع مزودي الأطراف الثالثة ملزمون بسياسات الخصوصية واتفاقيات معالجة البيانات الخاصة بهم. نحن نشارك فقط الحد الأدنى من البيانات اللازمة لعمل كل خدمة.</p>
        </div>
      ),
    },
    licenses: {
      en: (
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
          <h3 className="text-base font-semibold text-foreground">Software License</h3>
          <p>{appName} is proprietary software. All rights reserved. You are granted a limited, non-exclusive, non-transferable license to use the app for personal, non-commercial transportation purposes.</p>
          <h3 className="text-base font-semibold text-foreground">Restrictions</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>You may not reverse engineer, decompile, or disassemble the app</li>
            <li>You may not copy, modify, or create derivative works</li>
            <li>You may not rent, lease, or lend the app to third parties</li>
            <li>You may not use the app for any illegal or unauthorized purpose</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">Open Source Acknowledgments</h3>
          <p>{appName} uses the following open-source libraries and frameworks:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>React</strong> — MIT License — Meta Platforms, Inc.</li>
            <li><strong>Capacitor</strong> — MIT License — Ionic</li>
            <li><strong>Tailwind CSS</strong> — MIT License — Tailwind Labs</li>
            <li><strong>Radix UI</strong> — MIT License — WorkOS</li>
            <li><strong>Lucide Icons</strong> — ISC License — Lucide Contributors</li>
            <li><strong>Supabase JS</strong> — MIT License — Supabase Inc.</li>
            <li><strong>React Router</strong> — MIT License — Remix Software</li>
            <li><strong>TanStack Query</strong> — MIT License — TanStack</li>
            <li><strong>Recharts</strong> — MIT License — Recharts Contributors</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">Copyright Notice</h3>
          <p>© 2026 {appName}. All rights reserved. {appName} and its logo are trademarks. Unauthorized use is prohibited.</p>
        </div>
      ),
      ar: (
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">آخر تحديث: {lastUpdated}</p>
          <h3 className="text-base font-semibold text-foreground">ترخيص البرنامج</h3>
          <p>{appName} هو برنامج ملكية خاصة. جميع الحقوق محفوظة. يُمنح لك ترخيص محدود وغير حصري وغير قابل للتحويل لاستخدام التطبيق لأغراض النقل الشخصية غير التجارية.</p>
          <h3 className="text-base font-semibold text-foreground">القيود</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>لا يجوز لك إجراء هندسة عكسية أو تفكيك أو فك تجميع التطبيق</li>
            <li>لا يجوز لك نسخ أو تعديل أو إنشاء أعمال مشتقة</li>
            <li>لا يجوز لك تأجير أو إعارة التطبيق لأطراف ثالثة</li>
            <li>لا يجوز لك استخدام التطبيق لأي غرض غير قانوني</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">اعترافات المصادر المفتوحة</h3>
          <p>يستخدم {appName} المكتبات والأطر مفتوحة المصدر التالية:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>React</strong> — ترخيص MIT — Meta Platforms, Inc.</li>
            <li><strong>Capacitor</strong> — ترخيص MIT — Ionic</li>
            <li><strong>Tailwind CSS</strong> — ترخيص MIT — Tailwind Labs</li>
            <li><strong>Radix UI</strong> — ترخيص MIT — WorkOS</li>
            <li><strong>Lucide Icons</strong> — ترخيص ISC — Lucide Contributors</li>
            <li><strong>Supabase JS</strong> — ترخيص MIT — Supabase Inc.</li>
          </ul>
          <h3 className="text-base font-semibold text-foreground">إشعار حقوق الطبع والنشر</h3>
          <p>© 2026 {appName}. جميع الحقوق محفوظة. {appName} وشعاره علامات تجارية. الاستخدام غير المصرح به محظور.</p>
        </div>
      ),
    },
  };

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <header className="bg-card border-b border-border shrink-0 z-40 safe-area-top">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/profile"><Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button></Link>
          <h1 className="text-lg font-bold text-foreground">
            {lang === 'ar' ? 'القانوني والخصوصية' : 'Legal & Privacy'}
          </h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-card border-b border-border overflow-x-auto shrink-0">
        <div className="flex gap-1 px-4 py-2 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                active === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {tab.icon}
              {tab.label[lang]}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <div className="max-w-lg mx-auto">
          {content[active][lang]}
        </div>
      </main>
    </div>
  );
};

export default Legal;
