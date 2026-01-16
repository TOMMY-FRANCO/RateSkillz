import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { supabase } from './lib/supabase';

console.log('🚀 main.tsx: Starting app render');

async function syncCoinPoolOnStartup() {
  try {
    console.log('🔄 Running coin pool integrity sync on startup...');
    const { data, error } = await supabase
      .rpc('sync_coin_pool_integrity')
      .single();

    if (error) {
      console.error('❌ Coin pool sync error:', error);
      return;
    }

    if (data.corrected) {
      console.warn('⚠️ Coin pool discrepancy corrected on startup:', data);
    } else {
      console.log('✅ Coin pool is in sync:', data);
    }
  } catch (error) {
    console.error('❌ Failed to sync coin pool on startup:', error);
  }
}

syncCoinPoolOnStartup();

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
