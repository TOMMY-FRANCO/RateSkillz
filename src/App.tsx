import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { supabase } from './lib/supabase';
import { measureWebVitals, perfMonitor } from './lib/performance';
import ErrorBoundary from './components/ErrorBoundary';
import PWAInstallPrompt from './components/PWAInstallPrompt';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';

const EditProfile = lazy(() => import('./pages/EditProfile'));
const Friends = lazy(() => import('./pages/Friends'));
const Settings = lazy(() => import('./pages/Settings'));
const ProfileView = lazy(() => import('./pages/ProfileView'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const PublicCard = lazy(() => import('./pages/PublicCard'));
const Shop = lazy(() => import('./pages/Shop'));
const TransactionHistory = lazy(() => import('./pages/TransactionHistory'));
const WatchAd = lazy(() => import('./pages/WatchAd'));
const Store = lazy(() => import('./pages/Store').then(m => ({ default: m.Store })));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess').then(m => ({ default: m.CheckoutSuccess })));
const TradingDashboard = lazy(() => import('./pages/TradingDashboard'));
const BattleMode = lazy(() => import('./pages/BattleMode'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Chat = lazy(() => import('./pages/Chat'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const VerifyProfile = lazy(() => import('./pages/VerifyProfile').then(m => ({ default: m.VerifyProfile })));
const SearchFriends = lazy(() => import('./pages/SearchFriends'));
const ViewedMe = lazy(() => import('./pages/ViewedMe'));
const BalanceRecovery = lazy(() => import('./pages/BalanceRecovery'));
const AdminCoinPool = lazy(() => import('./pages/AdminCoinPool'));
const AdminModeration = lazy(() => import('./pages/AdminModeration'));
const ShimmerDemo = lazy(() => import('./pages/ShimmerDemo'));
const AddFriendByQR = lazy(() => import('./pages/AddFriendByQR'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 mx-auto">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full opacity-20 animate-pulse"></div>
            <Loader2 className="w-16 h-16 text-cyan-400 animate-spin relative z-10" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            RatingSkill
          </h2>
          <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
        <div className="w-48 h-1 bg-gray-700 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [adminVerified, setAdminVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || loading) return;

    let cancelled = false;
    supabase.rpc('is_user_admin').single().then(({ data, error }) => {
      if (!cancelled) {
        setAdminVerified(!error && data === true);
      }
    });

    return () => { cancelled = true; };
  }, [user, loading]);

  if (loading || adminVerified === null) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!adminVerified) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  console.log('🚀 App component rendering');

  useEffect(() => {
    // Initialize performance monitoring
    measureWebVitals();

    // Log performance summary in dev mode after 10 seconds
    if (import.meta.env.DEV) {
      const perfTimeout = setTimeout(() => {
        console.group('📊 Performance Metrics');
        console.table(perfMonitor.getSummary());
        console.groupEnd();
      }, 10000);

      return () => {
        clearTimeout(perfTimeout);
      };
    }
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
          <Route
            path="/"
            element={
              <PublicRoute>
                <Landing />
              </PublicRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit-profile"
            element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <Friends />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search-friends"
            element={
              <ProtectedRoute>
                <SearchFriends />
              </ProtectedRoute>
            }
          />
          <Route
            path="/viewed-me"
            element={
              <ProtectedRoute>
                <ViewedMe />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:username"
            element={
              <ProtectedRoute>
                <ProfileView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <Leaderboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shop"
            element={
              <ProtectedRoute>
                <Shop />
              </ProtectedRoute>
            }
          />
          <Route
            path="/store"
            element={
              <ProtectedRoute>
                <Store />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <TransactionHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/watch-ad"
            element={
              <ProtectedRoute>
                <WatchAd />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trading"
            element={
              <ProtectedRoute>
                <TradingDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/battle-mode"
            element={
              <ProtectedRoute>
                <BattleMode />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout/success"
            element={
              <ProtectedRoute>
                <CheckoutSuccess />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <Inbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox/:conversationId"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/balance-recovery"
            element={
              <ProtectedRoute>
                <BalanceRecovery />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/coin-pool"
            element={
              <AdminRoute>
                <AdminCoinPool />
              </AdminRoute>
            }
          />
          <Route
            path="/admin-hq-london"
            element={
              <AdminRoute>
                <AdminModeration />
              </AdminRoute>
            }
          />
          <Route path="/card/:username" element={<PublicCard />} />
          <Route path="/verify/:token" element={<VerifyProfile />} />
          <Route path="/add-friend" element={<AddFriendByQR />} />
          <Route path="/shimmer-demo" element={<ShimmerDemo />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <PWAInstallPrompt />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
