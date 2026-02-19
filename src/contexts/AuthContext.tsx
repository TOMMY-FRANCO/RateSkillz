import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { ensureProfileExists } from '../lib/profileCreation';
import { reconcileUserBalance } from '../lib/balanceReconciliation';
import { reconcileCoinPool } from '../lib/coinPoolReconciliation';
import { requestNotificationPermission } from '../lib/messageNotifications';
import { clearAppBadge } from '../lib/appBadge';

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
  gender?: string;
  age?: number;
  findable_by_school?: boolean;
  hide_from_leaderboard?: boolean;
  secondary_school_id?: string;
  college_id?: string;
  university_id?: string;
  coin_balance?: number;
  friend_count?: number;
  is_verified?: boolean;
  is_manager?: boolean;
  is_admin?: boolean;
  is_banned?: boolean;
  profile_views_count?: number;
  has_social_badge?: boolean;
  manager_wins?: number;
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
  signUp: (email: string, password: string, username: string, fullName: string, recaptchaToken: string, age?: number | null) => Promise<{ error: Error | null }>;
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
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadUserSession = async (session: any, isInitialLoad = false) => {
      try {
        if (!session?.user) {
          if (mounted) {
            setUser(null);
            setSession(null);
            setProfile(null);
          }
          return;
        }

        console.log('[Session] Loading user session');

        if (mounted) {
          setUser({ id: session.user.id });
          setSession({ user: { id: session.user.id } });
        }

        // Handle OAuth provider metadata
        const isOAuthUser = session.user.app_metadata?.provider &&
          ['google', 'discord', 'facebook'].includes(session.user.app_metadata.provider);

        let username = session.user.user_metadata?.username ||
          session.user.user_metadata?.preferred_username ||
          session.user.user_metadata?.name?.toLowerCase().replace(/\s+/g, '_') ||
          session.user.email?.split('@')[0]?.toLowerCase() || 'user';

        let fullName = session.user.user_metadata?.full_name ||
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name || '';

        // Record OAuth account if this is an OAuth login
        if (isOAuthUser) {
          try {
            const provider = session.user.app_metadata.provider;
            const providerUserId = session.user.user_metadata?.provider_id ||
              session.user.user_metadata?.sub ||
              session.user.id;

            // Check if OAuth account already exists
            const { data: existingOAuth } = await supabase
              .from('oauth_accounts')
              .select('id')
              .eq('user_id', session.user.id)
              .eq('provider', provider)
              .maybeSingle();

            if (!existingOAuth) {
              // Record the OAuth account
              await supabase.from('oauth_accounts').insert({
                user_id: session.user.id,
                provider,
                provider_user_id: providerUserId,
                email: session.user.email,
                provider_data: {
                  avatar_url: session.user.user_metadata?.avatar_url,
                  full_name: fullName,
                  username: username,
                  ...session.user.user_metadata,
                },
              });
              console.log('[Session] OAuth account recorded');
            }
          } catch (oauthError) {
            console.error('[Session] Error recording OAuth account:', oauthError);
          }
        }

        let retries = 3;
        let profileData = null;

        while (retries > 0 && !profileData) {
          try {
            profileData = await ensureProfileExists(
              session.user.id,
              session.user.email || '',
              username,
              fullName
            );

            if (profileData) break;
          } catch (error: any) {
            console.error(`[Session] Profile load attempt failed (${4 - retries}/3):`, error);
            retries--;

            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }

        if (mounted) {
          if (profileData) {
            setProfile(profileData);
            console.log('[Session] Profile loaded successfully');

            // Request notification permission on first login
            setTimeout(() => {
              requestNotificationPermission().catch(error => {
                console.error('[Session] Notification permission request failed:', error);
              });
            }, 1000);

            // Defer reconciliation to after initial render for faster startup
            setTimeout(() => {
              // Reconcile balance on app load to fix any discrepancies
              reconcileUserBalance(session.user.id).catch(error => {
                console.error('[Session] Balance reconciliation failed:', error);
              });

              // Reconcile coin pool on app load to fix any pool discrepancies
              reconcileCoinPool().catch(error => {
                console.error('[Session] Pool reconciliation failed:', error);
              });
            }, 2000);
          } else {
            console.warn('[Session] Could not load profile after retries');
          }
        }
      } catch (error) {
        console.error('[Session] Error loading profile:', error);
      } finally {
        if (isInitialLoad && mounted) {
          setLoading(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUserSession(session, true);
    }).catch((error) => {
      console.error('[Session] Failed to get session:', error);
      if (mounted) {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        loadUserSession(session, false);
      }
    });

    return () => {
      mounted = false;
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

  const signUp = async (email: string, password: string, username: string, fullName: string, recaptchaToken: string, age?: number | null) => {
    if (!supabase) {
      return { error: new Error('Supabase not configured') };
    }

    setLoading(true);

    try {
      // Check username uniqueness first (fast client-side check)
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(`Database error: ${checkError.message}`);
      }

      if (existingProfile) {
        return { error: new Error('Username already taken. Please choose a different username.') };
      }

      // Run signup verification if recaptchaToken is available
      let clientIp: string | null = null;
      if (recaptchaToken) {
        try {
          const verificationResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signup-verification`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({ email, recaptchaToken }),
            }
          );

          if (verificationResponse.ok) {
            const verificationData = await verificationResponse.json();
            clientIp = verificationData.clientIp || null;
            if (!verificationData.success) {
              throw new Error(verificationData.error || 'Verification failed');
            }
          }
        } catch (verifyErr: any) {
          // Only throw verification errors that are explicit rejections (rate limit, email taken, etc.)
          if (verifyErr.message && (
            verifyErr.message.includes('Too many signup') ||
            verifyErr.message.includes('already registered')
          )) {
            throw verifyErr;
          }
          // Otherwise, proceed without verification (network issues, CORS, etc.)
        }
      }

      // Create the auth account
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
        throw signUpError;
      }

      if (!authData.user) {
        throw new Error('Account creation failed. Please try again.');
      }

      const userId = authData.user.id;
      const normalizedUsername = username.toLowerCase();
      const isMinor = age !== null && age !== undefined && age >= 11 && age < 18;

      // Directly insert the profile row immediately after auth creation
      let profileData: any = null;
      const { data: insertedProfile, error: profileInsertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: normalizedUsername,
          email: email,
          full_name: fullName || '',
          coin_balance: 0,
          age: age ?? null,
          username_customized: true,
          username_change_count: 0,
          overall_rating: 50,
          profile_views_count: 0,
          hide_from_leaderboard: isMinor,
          findable_by_school: !isMinor,
        })
        .select()
        .maybeSingle();

      if (profileInsertError) {
        if (profileInsertError.code === '23505') {
          // Profile already exists (possibly created by a DB trigger), fetch it
          const { data: existingData } = await supabase
            .from('profiles')
            .select('id, username, full_name, email, avatar_url, avatar_position, bio, position, number, team, height, weight, overall_rating, created_at, updated_at, last_active, terms_accepted_at, username_customized, gender, age, findable_by_school, hide_from_leaderboard, coin_balance, friend_count, is_verified, is_manager, is_admin, is_banned, profile_views_count, has_social_badge, manager_wins')
            .eq('id', userId)
            .maybeSingle();
          profileData = existingData;
        } else {
          // Profile insert failed after auth was created - return clear error
          return {
            error: new Error(
              'Your account was created but profile setup failed. Please try signing in — your account exists.'
            ),
          };
        }
      } else {
        profileData = insertedProfile;
      }

      if (!profileData) {
        return {
          error: new Error(
            'Your account was created but profile setup failed. Please try signing in — your account exists.'
          ),
        };
      }

      // Create secondary records in background (non-blocking)
      Promise.allSettled([
        supabase.from('user_stats').insert({
          user_id: userId, pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50, overall: 50, rating_count: 0,
        }),
        supabase.from('card_ownership').insert({
          card_user_id: userId, owner_id: userId, original_owner_id: userId,
          current_price: 20.00, base_price: 20.00, is_listed_for_sale: false, times_traded: 0,
        }),
        supabase.from('social_links').insert({ user_id: userId }),
        supabase.from('user_presence').insert({ user_id: userId }),
      ]).catch(() => {});

      // Increment IP signup count if available
      if (clientIp && clientIp !== 'unknown') {
        supabase.rpc('increment_signup_count', { p_ip_address: clientIp }).catch(() => {});
      }

      setUser({ id: userId });
      setSession({ user: { id: userId } });
      setProfile(profileData);

      return { error: null };
    } catch (error: any) {
      let errorMessage = 'Failed to create account. Please try again.';

      if (
        error.message?.includes('already registered') ||
        error.message?.includes('already been registered') ||
        error.message?.includes('User already registered')
      ) {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (error.message?.includes('Invalid email') || error.message?.includes('valid email')) {
        errorMessage = 'Please enter a valid email address.';
      } else if (
        error.message?.includes('Password should be') ||
        error.message?.includes('password') ||
        error.message?.includes('Password')
      ) {
        errorMessage = 'Password is too short. Please use at least 8 characters.';
      } else if (error.message?.includes('Username already taken')) {
        errorMessage = error.message;
      } else if (error.message?.includes('Too many signup')) {
        errorMessage = 'Too many signup attempts. Please try again tomorrow.';
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
    console.log('[SignIn] Starting sign-in process');

    try {
      console.log('[SignIn] Authenticating...');
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

      console.log('[SignIn] Authentication successful');
      console.log('[SignIn] Loading profile...');
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

      console.log('[SignIn] Profile loaded');
      console.log('[SignIn] Updating activity...');
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

      setUser({ id: authData.user.id });
      setSession({ user: { id: authData.user.id } });
      setProfile({ ...profileData, last_active: now });

      console.log('[SignIn] Sign-in completed successfully');

      return { error: null };
    } catch (error: any) {
      console.error('[SignIn] Sign-in failed');

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
    clearAppBadge();
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!profile || !supabase) return { error: new Error('No user logged in') };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
      } else {
        const updatedProfile = { ...profile, ...updates };
        setProfile(updatedProfile);
      }
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
        .select('id, username, full_name, email, avatar_url, avatar_position, bio, position, number, team, height, weight, overall_rating, created_at, updated_at, last_active, terms_accepted_at, username_customized, gender, age, findable_by_school, hide_from_leaderboard, coin_balance, friend_count, is_verified, is_manager, is_admin, is_banned, profile_views_count, has_social_badge, manager_wins')
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
