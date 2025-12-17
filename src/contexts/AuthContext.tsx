import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
  user: { id: string } | null;
  session: { user: { id: string } } | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  updateActivity: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const updateActivity = async () => {
    if (!profile || !supabase) return;

    try {
      const now = new Date().toISOString();

      await supabase
        .from('profiles')
        .update({ last_active: now })
        .eq('id', profile.id);

      await supabase
        .from('user_presence')
        .upsert({
          user_id: profile.id,
          last_seen: now,
          updated_at: now,
        }, {
          onConflict: 'user_id'
        });

      setProfile({ ...profile, last_active: now });
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  useEffect(() => {
    console.log('🔄 AuthContext: useEffect started');

    const timeout = setTimeout(() => {
      console.error('⏰ Auth initialization timeout - forcing loading to false');
      setLoading(false);
    }, 5000);

    const initAuth = async () => {
      console.log('🔄 AuthContext: Initializing auth...');

      if (!supabase) {
        console.error('❌ Supabase not configured');
        console.log('Setting loading to false (no supabase)');
        clearTimeout(timeout);
        setLoading(false);
        return;
      }

      try {
        console.log('📡 Fetching session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('❌ Session error:', sessionError);
        }

        console.log('📡 Session:', session ? 'Found' : 'None');

        if (session?.user) {
          console.log('Setting user state...');
          setUser({ id: session.user.id });
          setSession({ user: { id: session.user.id } });

          console.log('Fetching profile...');
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profileError) {
            console.error('❌ Profile error:', profileError);
          }

          if (profileData) {
            setProfile(profileData);
            console.log('✅ Profile loaded:', profileData.username);
          } else {
            console.log('⚠️ No profile found');
          }
        } else {
          console.log('✅ No session - user not logged in');
        }
      } catch (error) {
        console.error('❌ Error loading session:', error);
      } finally {
        console.log('✅ Auth initialization complete - setting loading to FALSE');
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    initAuth();

    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id });
        setSession({ user: { id: session.user.id } });

        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data: profileData }) => {
            if (profileData) {
              setProfile(profileData);
            }
          });
      } else {
        setUser(null);
        setSession(null);
        setProfile(null);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profile) return;

    updateActivity();

    const interval = setInterval(() => {
      updateActivity();
    }, 60000);

    return () => clearInterval(interval);
  }, [profile?.id]);

  const signUp = async (email: string, password: string, username: string, fullName: string) => {
    if (!supabase) {
      return { error: new Error('Supabase not configured') };
    }

    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (existingProfile) {
        return { error: new Error('Username already taken') };
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
          data: {
            username,
            full_name: fullName,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('No user returned from signup');

      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError || !profileData) {
        throw new Error('Profile was not created');
      }

      setUser({ id: authData.user.id });
      setSession({ user: { id: authData.user.id } });
      setProfile(profileData);

      return { error: null };
    } catch (error: any) {
      console.error('Signup error:', error);
      return { error: new Error(error.message || 'Failed to create account') };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: new Error('Supabase not configured') };
    }

    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      if (!authData.user) throw new Error('No user returned from signin');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) throw new Error('Profile not found');

      await supabase
        .from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('id', authData.user.id);

      setUser({ id: authData.user.id });
      setSession({ user: { id: authData.user.id } });
      setProfile({ ...profileData, last_active: new Date().toISOString() });

      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { error: new Error(error.message || 'Failed to sign in') };
    }
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!profile || !supabase) return { error: new Error('No user logged in') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;

      const updatedProfile = { ...profile, ...updates, updated_at: new Date().toISOString() };
      setProfile(updatedProfile);
      return { error: null };
    } catch (error: any) {
      console.error('Update profile error:', error);
      return { error: new Error(error.message || 'Failed to update profile') };
    }
  };

  const refreshProfile = async () => {
    if (!profile || !supabase) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .maybeSingle();

      if (data && !error) {
        setProfile(data);
      }
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
