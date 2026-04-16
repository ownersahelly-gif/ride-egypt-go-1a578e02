import React, { Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import GlobalNotifications from "./components/GlobalNotifications";
import { useIncomingCall } from "./hooks/useIncomingCall";
// Lazy-load all pages for code splitting
const Index = React.lazy(() => import("./pages/Index"));
const Login = React.lazy(() => import("./pages/Login"));
const Signup = React.lazy(() => import("./pages/Signup"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const BookRide = React.lazy(() => import("./pages/BookRide"));
const MyBookings = React.lazy(() => import("./pages/MyBookings"));
const RequestRoute = React.lazy(() => import("./pages/RequestRoute"));
const Profile = React.lazy(() => import("./pages/Profile"));
const DriverApply = React.lazy(() => import("./pages/DriverApply"));
const DriverDashboard = React.lazy(() => import("./pages/DriverDashboard"));
const TrackShuttle = React.lazy(() => import("./pages/TrackShuttle"));
const ActiveRide = React.lazy(() => import("./pages/ActiveRide"));
const AdminPanel = React.lazy(() => import("./pages/AdminPanel"));
const DriverProfile = React.lazy(() => import("./pages/DriverProfile"));
const Carpool = React.lazy(() => import("./pages/Carpool"));
const CarpoolVerify = React.lazy(() => import("./pages/CarpoolVerify"));
const CarpoolPost = React.lazy(() => import("./pages/CarpoolPost"));
const CarpoolRoute = React.lazy(() => import("./pages/CarpoolRoute"));
const CarpoolManage = React.lazy(() => import("./pages/CarpoolManage"));
const Communities = React.lazy(() => import("./pages/Communities"));
const CommunityVerify = React.lazy(() => import("./pages/CommunityVerify"));
const Wallet = React.lazy(() => import("./pages/Wallet"));
const DriverTestView = React.lazy(() => import("./pages/DriverTestView"));
const PartnerDashboard = React.lazy(() => import("./pages/PartnerDashboard"));
const GlobalMap = React.lazy(() => import("./pages/GlobalMap"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Legal = React.lazy(() => import("./pages/Legal"));
const Support = React.lazy(() => import("./pages/Support"));
const IncomingCall = React.lazy(() => import("./pages/IncomingCall"));

const queryClient = new QueryClient();

const AppMobileServices = () => {
  useIncomingCall();

  useEffect(() => {
    const root = document.documentElement;
    const setInset = (px: number) => {
      root.style.setProperty("--kb-inset", `${px}px`);
      const open = px > 0 ? "true" : "false";
      document.querySelectorAll("[data-bottom-nav]").forEach((el) => {
        (el as HTMLElement).dataset.kbOpen = open;
      });
    };
    setInset(0);

    let cleanupNative: (() => void) | undefined;
    let usingNative = false;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
          try {
            await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
          } catch {
            // ignore if unsupported on this runtime
          }

          try {
            await Keyboard.setScroll({ isDisabled: false });
          } catch {
            // ignore if unsupported on this runtime
          }

          usingNative = true;
          const showSub = await Keyboard.addListener("keyboardWillShow", (info) => {
            setInset(info.keyboardHeight || 0);
          });
          const hideSub = await Keyboard.addListener("keyboardWillHide", () => {
            setInset(0);
          });
          cleanupNative = () => {
            showSub.remove();
            hideSub.remove();
          };
        }
      } catch {
        // ignore — fallback below
      }
    })();

    // Web/visualViewport fallback
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const onVV = () => {
      if (usingNative || !vv) return;
      const diff = window.innerHeight - vv.height - vv.offsetTop;
      setInset(diff > 80 ? diff : 0);
    };
    vv?.addEventListener("resize", onVV);
    vv?.addEventListener("scroll", onVV);

    return () => {
      cleanupNative?.();
      vv?.removeEventListener("resize", onVV);
      vv?.removeEventListener("scroll", onVV);
      setInset(0);
    };
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <GlobalNotifications />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppMobileServices />
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/book" element={<Navigate to="/dashboard" replace />} />
                <Route path="/book-ride" element={<BookRide />} />
                <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
                <Route path="/request-route" element={<ProtectedRoute><RequestRoute /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
                <Route path="/driver-apply" element={<ProtectedRoute><DriverApply /></ProtectedRoute>} />
                <Route path="/driver-dashboard" element={<ProtectedRoute><DriverDashboard /></ProtectedRoute>} />
                <Route path="/track" element={<ProtectedRoute><TrackShuttle /></ProtectedRoute>} />
                <Route path="/active-ride" element={<ProtectedRoute><ActiveRide /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
                <Route path="/driver-test" element={<ProtectedRoute><DriverTestView /></ProtectedRoute>} />
                <Route path="/driver/:id" element={<DriverProfile />} />
                <Route path="/carpool" element={<ProtectedRoute><Carpool /></ProtectedRoute>} />
                <Route path="/carpool/verify" element={<ProtectedRoute><CarpoolVerify /></ProtectedRoute>} />
                <Route path="/carpool/post" element={<ProtectedRoute><CarpoolPost /></ProtectedRoute>} />
                <Route path="/carpool/route/:id" element={<ProtectedRoute><CarpoolRoute /></ProtectedRoute>} />
                <Route path="/carpool/manage/:id" element={<ProtectedRoute><CarpoolManage /></ProtectedRoute>} />
                <Route path="/communities" element={<ProtectedRoute><Communities /></ProtectedRoute>} />
                <Route path="/communities/:id/verify" element={<ProtectedRoute><CommunityVerify /></ProtectedRoute>} />
                <Route path="/legal" element={<Legal />} />
                <Route path="/support" element={<Support />} />
                <Route path="/partner" element={<ProtectedRoute><PartnerDashboard /></ProtectedRoute>} />
                <Route path="/admin/global-map" element={<ProtectedRoute><GlobalMap /></ProtectedRoute>} />
                <Route path="/incoming-call" element={<IncomingCall />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
