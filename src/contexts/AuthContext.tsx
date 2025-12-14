import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
  avatar_position?: { x: number; y: number; scale: number };
  bio?: string;
  position?: string;
  number?: string;
  team?: string;
  height?: string;
  weight?: string;
  achievements?: string;
  stats?: string;
  overall_rating?: number;
  created_at?: string;
  updated_at?: string;
  last_active?: string;
}

export function isUserOnline(lastActive?: string): boolean {
  if (!lastActive) return false;
  const lastActiveTime = new Date(lastActive).getTime();
  const now = Date.now();
  return now - lastActiveTime < 5 * 60 * 1000;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  updateActivity: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
        await updateActivity(data.id);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateActivity = async (userId?: string) => {
    const id = userId || user?.id;
    if (!id) return;

    try {
      await supabase
        .from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('id', id);
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  useEffect(() => {
    console.log('Checking authentication...');

    const timeout = setTimeout(() => {
      console.log('Session check timeout - showing login page');
      setLoading(false);
    }, 3000);

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        clearTimeout(timeout);

        if (error) {
          console.error('Session check error:', error);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('Session found - fetching profile');
          fetchProfile(session.user.id);
        } else {
          console.log('No session - showing login');
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error('Failed to check session:', error);
        clearTimeout(timeout);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      updateActivity();
    }, 60000);

    return () => clearInterval(interval);
  }, [user?.id]);

  const signUp = async (email: string, password: string, username: string, fullName: string) => {
    try {
      const usernameCheck = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (usernameCheck.data) {
        return { error: new Error('Username already taken') };
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            username,
            full_name: fullName,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert([
          {
            id: authData.user.id,
            username,
            full_name: fullName,
            email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_active: new Date().toISOString(),
          },
        ]);

        if (profileError) throw profileError;
      }

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signIn = async (email: string, password: string, rememberMe: boolean = true) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (!rememberMe) {
        await supabase.auth.refreshSession();
      }

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const refreshProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) setProfile(data);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshProfile,
    updateActivity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
