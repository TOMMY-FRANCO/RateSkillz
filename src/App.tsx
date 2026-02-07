import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { startTokenCleanup } from './lib/passwordReset';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import EditProfile from './pages/EditProfile';
import Friends from './pages/Friends';
import Settings from './pages/Settings';
import ProfileView from './pages/ProfileView';
import Leaderboard from './pages/Leaderboard';
import PublicCard from './pages/PublicCard';
import Shop from './pages/Shop';
import TransactionHistory from './pages/TransactionHistory';
import WatchAd from './pages/WatchAd';
import { Store } from './pages/Store';
import { CheckoutSuccess } from './pages/CheckoutSuccess';
import TradingDashboard from './pages/TradingDashboard';
import BattleMode from './pages/BattleMode';
import Inbox from './pages/Inbox';
import Chat from './pages/Chat';
import TermsOfService from './pages/TermsOfService';
import { VerifyProfile } from './pages/VerifyProfile';
import SearchFriends from './pages/SearchFriends';
import ViewedMe from './pages/ViewedMe';
import BalanceRecovery from './pages/BalanceRecovery';
import AdminCoinPool from './pages/AdminCoinPool';
import AdminModeration from './pages/AdminModeration';
import ShimmerDemo from './pages/ShimmerDemo';
import AddFriendByQR from './pages/AddFriendByQR';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ErrorBoundary from './components/ErrorBoundary';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
        <p className="text-cyan-400 text-lg font-semibold">Loading RatingSkill...</p>
        <p className="text-gray-400 text-sm mt-2">Please wait</p>
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

  if (profile && !profile.is_admin) {
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
    // Start periodic cleanup of expired password reset tokens
    const cleanupInterval = startTokenCleanup();

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Router>
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
      </Router>
    </ErrorBoundary>
  );
}

export default App;
