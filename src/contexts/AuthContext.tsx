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

      setProfile({ ...profile, last_active: now });
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
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
      }
    });

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

    console.log('[SignUp] Starting sign-up process for:', { email, username, fullName });

    try {
      console.log('[SignUp] Step 1: Checking username availability...');
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle();

      if (checkError) {
        console.error('[SignUp] Error checking username:', checkError);
        throw new Error(`Database error checking username: ${checkError.message}`);
      }

      if (existingProfile) {
        console.log('[SignUp] Username already taken:', username);
        return { error: new Error('Username already taken') };
      }

      console.log('[SignUp] Step 2: Creating auth user...');
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
        console.error('[SignUp] Auth sign-up error:', signUpError);
        throw signUpError;
      }

      if (!authData.user) {
        console.error('[SignUp] No user returned from signup');
        throw new Error('No user returned from signup');
      }

      console.log('[SignUp] Auth user created successfully:', authData.user.id);
      console.log('[SignUp] Step 3: Waiting for profile creation by trigger...');

      let profileData = null;
      for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (profileError) {
          console.error(`[SignUp] Error fetching profile (attempt ${i + 1}):`, profileError);
        }

        if (data) {
          console.log(`[SignUp] Profile found after ${i + 1} attempts`);
          profileData = data;
          break;
        }
      }

      if (!profileData) {
        console.log('[SignUp] Step 4: Profile not created by trigger, creating manually...');

        const { data: insertedProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            username: username.toLowerCase(),
            full_name: fullName,
            email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_active: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('[SignUp] Error inserting profile:', insertError);
          throw new Error(`Failed to create profile: ${insertError.message}`);
        }

        console.log('[SignUp] Profile created manually');
        profileData = insertedProfile;

        console.log('[SignUp] Step 5: Creating card ownership...');
        const { error: cardError } = await supabase
          .from('card_ownership')
          .insert({
            card_user_id: authData.user.id,
            owner_id: authData.user.id,
            current_price: 20.00,
            base_price: 20.00,
          });

        if (cardError) {
          console.error('[SignUp] Error creating card ownership:', cardError);
        } else {
          console.log('[SignUp] Card ownership created successfully');
        }
      } else {
        console.log('[SignUp] Profile created automatically by trigger');
      }

      console.log('[SignUp] Step 6: Setting user session...');
      setUser({ id: authData.user.id });
      setSession({ user: { id: authData.user.id } });
      setProfile(profileData);

      console.log('[SignUp] Sign-up completed successfully!');
      return { error: null };
    } catch (error: any) {
      console.error('[SignUp] Fatal error during signup:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        stack: error.stack
      });

      let errorMessage = 'Failed to create account';

      if (error.message.includes('already registered')) {
        errorMessage = 'Email already registered';
      } else if (error.message.includes('Invalid email')) {
        errorMessage = 'Invalid email address';
      } else if (error.message.includes('Password')) {
        errorMessage = 'Password must be at least 6 characters';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return { error: new Error(errorMessage) };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      console.error('[SignIn] Supabase not configured');
      return { error: new Error('Supabase not configured') };
    }

    console.log('[SignIn] Starting sign-in process for:', email);

    try {
      console.log('[SignIn] Step 1: Authenticating user...');
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('[SignIn] Auth error:', signInError);
        throw signInError;
      }

      if (!authData.user) {
        console.error('[SignIn] No user returned from signin');
        throw new Error('No user returned from signin');
      }

      console.log('[SignIn] Auth successful:', authData.user.id);
      console.log('[SignIn] Step 2: Fetching profile...');

      let profileData = null;
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('[SignIn] Error fetching profile:', profileError);
        throw new Error(`Database error fetching profile: ${profileError.message}`);
      }

      if (!data) {
        console.log('[SignIn] Step 3: Profile not found, creating...');
        const username = (authData.user.user_metadata?.username || authData.user.email?.split('@')[0] || 'user').toLowerCase();
        const fullName = authData.user.user_metadata?.full_name || '';

        const { data: insertedProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            username,
            full_name: fullName,
            email: authData.user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_active: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('[SignIn] Error creating profile:', insertError);
          throw new Error(`Failed to create profile: ${insertError.message}`);
        }

        console.log('[SignIn] Profile created successfully');
        profileData = insertedProfile;

        console.log('[SignIn] Creating card ownership...');
        const { error: cardError } = await supabase
          .from('card_ownership')
          .insert({
            card_user_id: authData.user.id,
            owner_id: authData.user.id,
            current_price: 20.00,
            base_price: 20.00,
          });

        if (cardError && !cardError.message.includes('duplicate')) {
          console.error('[SignIn] Error creating card ownership:', cardError);
        }
      } else {
        console.log('[SignIn] Profile found');
        profileData = data;
      }

      console.log('[SignIn] Step 4: Updating last active...');
      await supabase
        .from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('id', authData.user.id);

      console.log('[SignIn] Step 5: Setting user session...');
      setUser({ id: authData.user.id });
      setSession({ user: { id: authData.user.id } });
      setProfile({ ...profileData, last_active: new Date().toISOString() });

      console.log('[SignIn] Sign-in completed successfully!');
      return { error: null };
    } catch (error: any) {
      console.error('[SignIn] Fatal error during sign-in:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });

      let errorMessage = 'Failed to sign in';

      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return { error: new Error(errorMessage) };
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
