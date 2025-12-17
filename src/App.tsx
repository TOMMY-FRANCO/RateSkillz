import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Home } from './pages/Home';
import { Store } from './pages/Store';
import { CheckoutSuccess } from './pages/CheckoutSuccess';
import { Profile } from './pages/Profile';
import { Leaderboard } from './pages/Leaderboard';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';

function App() {
  console.log('🚀 App component rendering');
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/store" element={<Store />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/profile/:username?" element={<Profile />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;