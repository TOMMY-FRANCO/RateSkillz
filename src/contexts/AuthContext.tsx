import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { ensureProfileExists } from '../lib/profileCreation';
import { updateUserActivity } from '../lib/activityTracking';

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
  terms_accepted_at?: string;
  username_customized?: boolean;
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
  const [loading, setLoading] = useState(false);

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

      await updateUserActivity(profile.id);

      setProfile({ ...profile, last_active: now });
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  useEffect(() => {
    if (!supabase) return;

    const loadUserSession = async (session: any) => {
      if (!session?.user) {
        setUser(null);
        setSession(null);
        setProfile(null);
        return;
      }

      try {
        console.log('[Session] Loading user session:', session.user.id);
        setUser({ id: session.user.id });
        setSession({ user: { id: session.user.id } });

        const username = session.user.user_metadata?.username ||
          session.user.email?.split('@')[0]?.toLowerCase() || 'user';
        const fullName = session.user.user_metadata?.full_name || '';

        const profileData = await ensureProfileExists(
          session.user.id,
          session.user.email || '',
          username,
          fullName
        );

        if (profileData) {
          setProfile(profileData);
          console.log('[Session] Profile loaded successfully');
        } else {
          console.warn('[Session] Could not load profile');
        }
      } catch (error) {
        console.error('[Session] Error loading profile:', error);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUserSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserSession(session);
    });

    return () => {
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
      console.error('[SignUp] Supabase not configured');
      return { error: new Error('Supabase not configured') };
    }

    setLoading(true);
    console.log('========================================');
    console.log('[SignUp] STARTING SIGN-UP PROCESS');
    console.log(`  Email: ${email}`);
    console.log(`  Username: ${username}`);
    console.log(`  Full Name: ${fullName}`);
    console.log('========================================');

    try {
      console.log('[SignUp] [1/4] Checking username availability...');
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('[SignUp] Database error checking username:', checkError);
        throw new Error(`Database error: ${checkError.message}`);
      }

      if (existingProfile) {
        console.log('[SignUp] ✗ Username already taken');
        return { error: new Error('Username already taken. Please choose a different username.') };
      }

      console.log('[SignUp] ✓ Username available');

      console.log('[SignUp] [2/4] Creating authentication account...');
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
          data: {
            username: username.toLowerCase(),
            full_name: fullName,
          },
        },
      });

      if (signUpError) {
        console.error('[SignUp] Authentication error:', signUpError);
        throw signUpError;
      }

      if (!authData.user) {
        console.error('[SignUp] No user returned from authentication');
        throw new Error('Account creation failed. Please try again.');
      }

      console.log('[SignUp] ✓ Authentication account created');
      console.log(`  User ID: ${authData.user.id}`);

      console.log('[SignUp] [3/4] Setting up your profile...');
      console.log('  Waiting for database trigger or creating manually if needed...');

      const profileData = await ensureProfileExists(
        authData.user.id,
        email,
        username,
        fullName
      );

      if (!profileData) {
        throw new Error('Profile setup failed. Please try logging in to complete setup.');
      }

      console.log('[SignUp] ✓ Profile setup complete');

      console.log('[SignUp] [4/4] Finalizing account setup...');
      setUser({ id: authData.user.id });
      setSession({ user: { id: authData.user.id } });
      setProfile(profileData);

      console.log('========================================');
      console.log('[SignUp] ✓ SIGN-UP COMPLETED SUCCESSFULLY');
      console.log('========================================');

      return { error: null };
    } catch (error: any) {
      console.error('========================================');
      console.error('[SignUp] ✗ SIGN-UP FAILED');
      console.error('  Error:', error.message);
      if (error.code) console.error('  Code:', error.code);
      if (error.details) console.error('  Details:', error.details);
      console.error('========================================');

      let errorMessage = 'Failed to create account. Please try again.';

      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (error.message.includes('Invalid email')) {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.message.includes('Password')) {
        errorMessage = 'Password must be at least 6 characters long.';
      } else if (error.message.includes('Username already taken')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return { error: new Error(errorMessage) };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      console.error('[SignIn] Supabase not configured');
      return { error: new Error('Supabase not configured') };
    }

    setLoading(true);
    console.log('========================================');
    console.log('[SignIn] STARTING SIGN-IN PROCESS');
    console.log(`  Email: ${email}`);
    console.log('========================================');

    try {
      console.log('[SignIn] [1/3] Authenticating...');
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('[SignIn] Authentication failed:', signInError);
        throw signInError;
      }

      if (!authData.user) {
        console.error('[SignIn] No user data returned');
        throw new Error('Sign in failed. Please try again.');
      }

      console.log('[SignIn] ✓ Authentication successful');
      console.log(`  User ID: ${authData.user.id}`);

      console.log('[SignIn] [2/3] Loading your profile...');
      const username = (authData.user.user_metadata?.username || authData.user.email?.split('@')[0] || 'user').toLowerCase();
      const fullName = authData.user.user_metadata?.full_name || '';

      const profileData = await ensureProfileExists(
        authData.user.id,
        authData.user.email || email,
        username,
        fullName
      );

      if (!profileData) {
        throw new Error('Profile setup failed. Please contact support.');
      }

      console.log('[SignIn] ✓ Profile loaded');

      console.log('[SignIn] [3/3] Updating activity...');
      const now = new Date().toISOString();
      await supabase
        .from('profiles')
        .update({ last_active: now })
        .eq('id', authData.user.id);

      await supabase
        .from('user_presence')
        .upsert({
          user_id: authData.user.id,
          last_seen: now,
          updated_at: now,
        }, {
          onConflict: 'user_id'
        });

      await updateUserActivity(authData.user.id);

      setUser({ id: authData.user.id });
      setSession({ user: { id: authData.user.id } });
      setProfile({ ...profileData, last_active: now });

      console.log('========================================');
      console.log('[SignIn] ✓ SIGN-IN COMPLETED SUCCESSFULLY');
      console.log(`  Welcome back, ${profileData.username}!`);
      console.log('========================================');

      return { error: null };
    } catch (error: any) {
      console.error('========================================');
      console.error('[SignIn] ✗ SIGN-IN FAILED');
      console.error('  Error:', error.message);
      if (error.code) console.error('  Code:', error.code);
      console.error('========================================');

      let errorMessage = 'Failed to sign in. Please try again.';

      if (error.message.includes('Invalid login credentials') || error.message.includes('Invalid')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email address before signing in.';
      } else if (error.message.includes('Too many requests')) {
        errorMessage = 'Too many login attempts. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return { error: new Error(errorMessage) };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (supabase && user) {
      const now = new Date().toISOString();
      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          last_seen: now,
          updated_at: now,
        }, {
          onConflict: 'user_id'
        });

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
