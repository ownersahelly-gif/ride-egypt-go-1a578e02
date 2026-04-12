import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import BookRide from "./pages/BookRide.tsx";
import MyBookings from "./pages/MyBookings.tsx";
import RequestRoute from "./pages/RequestRoute.tsx";
import Profile from "./pages/Profile.tsx";
import DriverApply from "./pages/DriverApply.tsx";
import DriverDashboard from "./pages/DriverDashboard.tsx";
import TrackShuttle from "./pages/TrackShuttle.tsx";
import ActiveRide from "./pages/ActiveRide.tsx";
import AdminPanel from "./pages/AdminPanel.tsx";
import DriverProfile from "./pages/DriverProfile.tsx";
import Carpool from "./pages/Carpool.tsx";
import CarpoolVerify from "./pages/CarpoolVerify.tsx";
import CarpoolPost from "./pages/CarpoolPost.tsx";
import CarpoolRoute from "./pages/CarpoolRoute.tsx";
import CarpoolManage from "./pages/CarpoolManage.tsx";
import Wallet from "./pages/Wallet.tsx";
import DriverTestView from "./pages/DriverTestView.tsx";
import PartnerDashboard from "./pages/PartnerDashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import Legal from "./pages/Legal.tsx";
import GlobalNotifications from "./components/GlobalNotifications";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <GlobalNotifications />
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
              <Route path="/legal" element={<Legal />} />
              <Route path="/partner" element={<ProtectedRoute><PartnerDashboard /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
