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
      console.error('Error updating activity:', error);
      const updatedProfile = { ...profile, last_active: new Date().toISOString() };
      localStorage.setItem('currentProfile', JSON.stringify(updatedProfile));
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      const storedProfile = localStorage.getItem('currentProfile');
      if (storedProfile) {
        const profileData = JSON.parse(storedProfile);

        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profileData.id)
            .maybeSingle();

          if (data && !error) {
            setProfile(data);
            setUser({ id: data.id });
            setSession({ user: { id: data.id } });
            localStorage.setItem('currentProfile', JSON.stringify(data));
          } else {
            setProfile(profileData);
            setUser({ id: profileData.id });
            setSession({ user: { id: profileData.id } });
          }
        } catch (error) {
          console.error('Error loading profile:', error);
          setProfile(profileData);
          setUser({ id: profileData.id });
          setSession({ user: { id: profileData.id } });
        }
      }
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
    try {
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      let profileData: Profile;

      if (existingProfile && !fetchError) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ last_active: new Date().toISOString() })
          .eq('id', existingProfile.id);

        if (updateError) console.error('Error updating last_active:', updateError);

        profileData = { ...existingProfile, last_active: new Date().toISOString() };
      } else {
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
          console.error('Error creating profile:', insertError);
          const localId = Date.now().toString();
          profileData = { id: localId, ...newProfile };
          const allProfiles = JSON.parse(localStorage.getItem('profiles') || '{}');
          allProfiles[localId] = profileData;
          localStorage.setItem('profiles', JSON.stringify(allProfiles));
        } else {
          profileData = insertedProfile;
        }
      }

      localStorage.setItem('currentProfile', JSON.stringify(profileData));
      setProfile(profileData);
      setUser({ id: profileData.id });
      setSession({ user: { id: profileData.id } });

      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);

      const allProfiles = JSON.parse(localStorage.getItem('profiles') || '{}');
      let profileData = Object.values(allProfiles).find(
        (p: any) => p.username === username
      ) as Profile | undefined;

      if (!profileData) {
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

    try {
      const updatedProfile = { ...profile, ...updates, updated_at: new Date().toISOString() };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        console.error('Error updating profile in Supabase:', error);
        const allProfiles = JSON.parse(localStorage.getItem('profiles') || '{}');
        allProfiles[profile.id] = updatedProfile;
        localStorage.setItem('profiles', JSON.stringify(allProfiles));
      }

      localStorage.setItem('currentProfile', JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
      return { error: null };
    } catch (error) {
      console.error('Update profile error:', error);
      const updatedProfile = { ...profile, ...updates, updated_at: new Date().toISOString() };
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
      console.error('Error refreshing profile:', error);
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
