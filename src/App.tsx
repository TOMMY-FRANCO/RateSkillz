import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { measureWebVitals, perfMonitor } from './lib/performance';
import ErrorBoundary from './components/ErrorBoundary';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { LazyPageWrapper } from './components/ui/LazyPageWrapper';
import { usePushNotifications } from './hooks/usePushNotifications';
import {
  FriendsSkeleton,
  InboxSkeleton,
  BattleModeSkeleton,
  TradingDashboardSkeleton,
  LeaderboardSkeleton,
  AddFriendByQRSkeleton,
  SettingsSkeleton,
  TutorialSkeleton,
  GenericPageSkeleton,
} from './components/ui/PageSkeletons';

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
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
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
const DeleteAccount = lazy(() => import('./pages/DeleteAccount'));
const ActivityFeed = lazy(() => import('./pages/ActivityFeed'));
const DailyQuiz = lazy(() => import('./pages/DailyQuiz'));

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
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return <LoadingScreen />;
  }

  if (!profile.is_admin) {
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

// Inner component that has access to auth context
function AppContent() {
  const { user } = useAuth();
  const { requestPermission, permission } = usePushNotifications(user?.id ?? null);

  // Auto-request push permission once user is logged in
  useEffect(() => {
    if (user && permission === 'default') {
      // Small delay so it doesn't pop up immediately on login
      const timer = setTimeout(() => {
        requestPermission();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, permission, requestPermission]);

  return (
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
        <Route path="/delete-account" element={<LazyPageWrapper skeleton={<GenericPageSkeleton />}><DeleteAccount /></LazyPageWrapper>} />
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
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <EditProfile />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<FriendsSkeleton />}>
                <Friends />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/search-friends"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<FriendsSkeleton />}>
                <SearchFriends />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/viewed-me"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <ViewedMe />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<SettingsSkeleton />}>
                <Settings />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:username"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <ProfileView />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<LeaderboardSkeleton />}>
                <Leaderboard />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/shop"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <Shop />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/store"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <Store />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <TransactionHistory />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity-feed"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <ActivityFeed />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/daily-quiz"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <DailyQuiz />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/watch-ad"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <WatchAd />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/trading"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<TradingDashboardSkeleton />}>
                <TradingDashboard />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/battle-mode"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<BattleModeSkeleton />}>
                <BattleMode />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout/success"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <CheckoutSuccess />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbox"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<InboxSkeleton />}>
                <Inbox />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbox/:conversationId"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<InboxSkeleton />}>
                <Chat />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/balance-recovery"
          element={
            <ProtectedRoute>
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <BalanceRecovery />
              </LazyPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/coin-pool"
          element={
            <AdminRoute>
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <AdminCoinPool />
              </LazyPageWrapper>
            </AdminRoute>
          }
        />
        <Route
          path="/admin-hq-london"
          element={
            <AdminRoute>
              <LazyPageWrapper skeleton={<GenericPageSkeleton />}>
                <AdminModeration />
              </LazyPageWrapper>
            </AdminRoute>
          }
        />
        <Route path="/card/:username" element={<LazyPageWrapper skeleton={<GenericPageSkeleton />}><PublicCard /></LazyPageWrapper>} />
        <Route path="/verify/:token" element={<LazyPageWrapper skeleton={<GenericPageSkeleton />}><VerifyProfile /></LazyPageWrapper>} />
        <Route path="/add-friend" element={<LazyPageWrapper skeleton={<AddFriendByQRSkeleton />}><AddFriendByQR /></LazyPageWrapper>} />
        <Route path="/shimmer-demo" element={<LazyPageWrapper skeleton={<GenericPageSkeleton />}><ShimmerDemo /></LazyPageWrapper>} />
        <Route path="/terms" element={<LazyPageWrapper skeleton={<GenericPageSkeleton />}><TermsOfService /></LazyPageWrapper>} />
        <Route path="/terms-of-service" element={<LazyPageWrapper skeleton={<GenericPageSkeleton />}><TermsOfService /></LazyPageWrapper>} />
        <Route path="/privacy-policy" element={<LazyPageWrapper skeleton={<GenericPageSkeleton />}><PrivacyPolicy /></LazyPageWrapper>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
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
        <AppContent />
        <PWAInstallPrompt />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
