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
  signIn: (username: string) => Promise<{ error: Error | null }>;
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
    if (!profile) return;

    if (!supabase) {
      const updatedProfile = { ...profile, last_active: new Date().toISOString() };
      localStorage.setItem('currentProfile', JSON.stringify(updatedProfile));
      return;
    }

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('profiles')
        .update({ last_active: now })
        .eq('id', profile.id);

      if (error) throw error;

      await supabase
        .from('user_presence')
        .upsert({
          user_id: profile.id,
          last_seen: now,
          updated_at: now,
        }, {
          onConflict: 'user_id'
        });

      const updatedProfile = { ...profile, last_active: now };
      setProfile(updatedProfile);
      localStorage.setItem('currentProfile', JSON.stringify(updatedProfile));
    } catch (error) {
      const updatedProfile = { ...profile, last_active: new Date().toISOString() };
      localStorage.setItem('currentProfile', JSON.stringify(updatedProfile));
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      console.log('🔐 Auth Check Starting...');
      const startTime = Date.now();

      const storedProfile = localStorage.getItem('currentProfile');
      console.log('  Stored profile:', storedProfile ? 'Found' : 'Not found');

      if (storedProfile) {
        const profileData = JSON.parse(storedProfile);
        console.log('  Profile ID:', profileData.id);
        console.log('  Username:', profileData.username);

        if (!supabase) {
          console.warn('⚠️  Supabase not configured, using localStorage fallback');
          setProfile(profileData);
          setUser({ id: profileData.id });
          setSession({ user: { id: profileData.id } });
          setLoading(false);
          return;
        }

        try {
          console.log('  Fetching profile from Supabase...');

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 2000);
          });

          const fetchPromise = supabase
            .from('profiles')
            .select('*')
            .eq('id', profileData.id)
            .maybeSingle();

          const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

          const elapsed = Date.now() - startTime;
          console.log(`  ✅ Fetch completed in ${elapsed}ms`);

          if (data && !error) {
            console.log('  Profile updated from database');
            setProfile(data);
            setUser({ id: data.id });
            setSession({ user: { id: data.id } });
            localStorage.setItem('currentProfile', JSON.stringify(data));
          } else {
            console.log('  Using cached profile (no data or error)');
            setProfile(profileData);
            setUser({ id: profileData.id });
            setSession({ user: { id: profileData.id } });
          }
        } catch (error: any) {
          const elapsed = Date.now() - startTime;

          if (error.message === 'Timeout') {
            console.warn(`⚠️  Session check timed out after ${elapsed}ms`);
            console.warn('  Using cached profile');
          } else {
            console.error('❌ Error loading profile:', error);
          }

          setProfile(profileData);
          setUser({ id: profileData.id });
          setSession({ user: { id: profileData.id } });
        }
      } else {
        console.log('  No stored profile - user needs to login');
      }

      const totalTime = Date.now() - startTime;
      console.log(`🔐 Auth Check Complete (${totalTime}ms)`);
      setLoading(false);
    };

    loadProfile();
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
    return { error: new Error('Not implemented') };
  };

  const signIn = async (username: string) => {
    console.log('🔑 Sign In Attempt:', username);

    if (!supabase) {
      console.warn('⚠️  Supabase not available, using localStorage mode');

      const allProfiles = JSON.parse(localStorage.getItem('profiles') || '{}');
      let profileData = Object.values(allProfiles).find(
        (p: any) => p.username === username
      ) as Profile | undefined;

      if (!profileData) {
        console.log('  Creating new local profile');
        const newId = Date.now().toString();
        profileData = {
          id: newId,
          username,
          full_name: username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        };
        allProfiles[newId] = profileData;
        localStorage.setItem('profiles', JSON.stringify(allProfiles));
      }

      localStorage.setItem('currentProfile', JSON.stringify(profileData));
      setProfile(profileData);
      setUser({ id: profileData.id });
      setSession({ user: { id: profileData.id } });
      console.log('✅ Sign in successful (local mode)');

      return { error: null };
    }

    try {
      console.log('  Checking for existing profile in database...');

      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (fetchError) {
        console.error('❌ Error fetching profile:', fetchError);
        throw fetchError;
      }

      let profileData: Profile;

      if (existingProfile) {
        console.log('  Found existing profile:', existingProfile.id);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ last_active: new Date().toISOString() })
          .eq('id', existingProfile.id);

        if (updateError) {
          console.error('⚠️  Error updating last_active:', updateError);
        }

        profileData = { ...existingProfile, last_active: new Date().toISOString() };
      } else {
        console.log('  Creating new profile in database...');

        const newProfile = {
          username,
          full_name: username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        };

        const { data: insertedProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();

        if (insertError) {
          console.error('❌ Error creating profile:', insertError);
          throw insertError;
        }

        profileData = insertedProfile;
        console.log('  Profile created:', profileData.id);
      }

      localStorage.setItem('currentProfile', JSON.stringify(profileData));
      setProfile(profileData);
      setUser({ id: profileData.id });
      setSession({ user: { id: profileData.id } });
      console.log('✅ Sign in successful');

      return { error: null };
    } catch (error: any) {
      console.error('❌ Sign in error:', error.message);
      console.warn('⚠️  Falling back to localStorage mode');

      const allProfiles = JSON.parse(localStorage.getItem('profiles') || '{}');
      let profileData = Object.values(allProfiles).find(
        (p: any) => p.username === username
      ) as Profile | undefined;

      if (!profileData) {
        console.log('  Creating new local profile (fallback)');
        const newId = Date.now().toString();
        profileData = {
          id: newId,
          username,
          full_name: username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        };
        allProfiles[newId] = profileData;
        localStorage.setItem('profiles', JSON.stringify(allProfiles));
      }

      localStorage.setItem('currentProfile', JSON.stringify(profileData));
      setProfile(profileData);
      setUser({ id: profileData.id });
      setSession({ user: { id: profileData.id } });
      console.log('✅ Sign in successful (fallback mode)');

      return { error: null };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('currentProfile');
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!profile) return { error: new Error('No user logged in') };

    console.log('📝 Updating profile:', Object.keys(updates));

    const updatedProfile = { ...profile, ...updates, updated_at: new Date().toISOString() };

    if (!supabase) {
      console.warn('⚠️  Supabase not available, updating localStorage only');
      const allProfiles = JSON.parse(localStorage.getItem('profiles') || '{}');
      allProfiles[profile.id] = updatedProfile;
      localStorage.setItem('profiles', JSON.stringify(allProfiles));
      localStorage.setItem('currentProfile', JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
      return { error: null };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        console.error('❌ Error updating profile in Supabase:', error);
        console.warn('⚠️  Saving to localStorage as fallback');
        const allProfiles = JSON.parse(localStorage.getItem('profiles') || '{}');
        allProfiles[profile.id] = updatedProfile;
        localStorage.setItem('profiles', JSON.stringify(allProfiles));
      } else {
        console.log('✅ Profile updated successfully');
      }

      localStorage.setItem('currentProfile', JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
      return { error: null };
    } catch (error) {
      console.error('❌ Update profile error:', error);
      console.warn('⚠️  Saving to localStorage as fallback');
      const allProfiles = JSON.parse(localStorage.getItem('profiles') || '{}');
      allProfiles[profile.id] = updatedProfile;
      localStorage.setItem('profiles', JSON.stringify(allProfiles));
      localStorage.setItem('currentProfile', JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
      return { error: null };
    }
  };

  const refreshProfile = async () => {
    if (!profile) return;

    if (!supabase) {
      const storedProfile = localStorage.getItem('currentProfile');
      if (storedProfile) {
        setProfile(JSON.parse(storedProfile));
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .maybeSingle();

      if (data && !error) {
        setProfile(data);
        localStorage.setItem('currentProfile', JSON.stringify(data));
      } else {
        const storedProfile = localStorage.getItem('currentProfile');
        if (storedProfile) {
          setProfile(JSON.parse(storedProfile));
        }
      }
    } catch (error) {
      const storedProfile = localStorage.getItem('currentProfile');
      if (storedProfile) {
        setProfile(JSON.parse(storedProfile));
      }
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
