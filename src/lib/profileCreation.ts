import { supabase } from './supabase';

const PROFILE_COLUMNS = 'id, username, full_name, email, avatar_url, avatar_position, bio, position, number, team, height, weight, overall_rating, created_at, updated_at, last_active, terms_accepted_at, username_customized, gender, age, findable_by_school, hide_from_leaderboard, coin_balance, friend_count, is_verified, is_manager, is_admin, is_banned, profile_views_count, has_social_badge, manager_wins';

export interface ProfileCreationResult {
  success: boolean;
  profile?: any;
  errors: string[];
  warnings: string[];
}

export async function checkProfileExists(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[ProfileCheck] Error:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('[ProfileCheck] Exception:', error);
    return false;
  }
}

export async function createCompleteProfile(
  userId: string,
  email: string,
  username?: string,
  fullName?: string,
  age?: number | null
): Promise<ProfileCreationResult> {
  const result: ProfileCreationResult = {
    success: false,
    errors: [],
    warnings: []
  };

  console.log('[ProfileCreation] Creating profile');

  try {
    const generatedUsername = username?.toLowerCase() ||
      email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '').substring(0, 16) ||
      `user${userId.substring(0, 8)}`;

    // Determine privacy defaults based on age
    const isMinor = age !== null && age !== undefined && age >= 11 && age < 18;
    const hideFromLeaderboard = isMinor;
    const findableBySchool = !isMinor;

    console.log('[1/5] Creating profile record...');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        username: generatedUsername,
        email: email,
        full_name: fullName || '',
        age: age,
        username_customized: false,
        username_change_count: 0,
        coin_balance: 0,
        overall_rating: 50,
        profile_views_count: 0,
        hide_from_leaderboard: hideFromLeaderboard,
        findable_by_school: findableBySchool
      })
      .select()
      .single();

    if (profileError) {
      if (profileError.code === '23505') {
        console.log('[1/5] ✓ Profile already exists (conflict), fetching...');
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('id', userId)
          .single();

        if (existingProfile) {
          result.profile = existingProfile;
        }
      } else {
        console.error('[1/5] ✗ Error creating profile:', profileError);
        result.errors.push(`Profile creation failed: ${profileError.message}`);
        return result;
      }
    } else {
      console.log('[1/5] ✓ Profile created successfully');
      result.profile = profileData;
    }

    console.log('[2/5] Creating user stats (player ratings)...');
    const { error: statsError } = await supabase
      .from('user_stats')
      .insert({
        user_id: userId,
        pac: 50,
        sho: 50,
        pas: 50,
        dri: 50,
        def: 50,
        phy: 50,
        overall: 50,
        rating_count: 0
      });

    if (statsError && statsError.code !== '23505') {
      console.warn('[2/5] ⚠ Error creating user stats:', statsError);
      result.warnings.push('Player stats creation failed');
    } else {
      console.log('[2/5] ✓ User stats created');
    }

    console.log('[3/5] Creating card ownership...');
    const { error: cardError } = await supabase
      .from('card_ownership')
      .insert({
        card_user_id: userId,
        owner_id: userId,
        original_owner_id: userId,
        current_price: 20.00,
        base_price: 20.00,
        is_listed_for_sale: false,
        times_traded: 0
      });

    if (cardError && cardError.code !== '23505') {
      console.warn('[3/5] ⚠ Error creating card ownership:', cardError);
      result.warnings.push('Card ownership creation failed');
    } else {
      console.log('[3/5] ✓ Card ownership created');
    }

    console.log('[4/5] Creating social links...');
    const { error: socialError } = await supabase
      .from('social_links')
      .insert({
        user_id: userId
      });

    if (socialError && socialError.code !== '23505') {
      console.warn('[4/5] ⚠ Error creating social links:', socialError);
      result.warnings.push('Social links creation failed');
    } else {
      console.log('[4/5] ✓ Social links created');
    }

    console.log('[5/5] Creating user presence...');
    const { error: presenceError } = await supabase
      .from('user_presence')
      .insert({
        user_id: userId
      });

    if (presenceError && presenceError.code !== '23505') {
      console.warn('[5/5] ⚠ Error creating user presence:', presenceError);
      result.warnings.push('User presence creation failed');
    } else {
      console.log('[5/5] ✓ User presence created');
    }

    if (result.profile) {
      result.success = true;
      console.log('[ProfileCreation] Profile creation completed');
    } else {
      result.errors.push('Profile record was not created');
    }

  } catch (error: any) {
    console.error('========================================');
    console.error('✗ FATAL ERROR in profile creation:', error);
    console.error('========================================');
    result.errors.push(error.message || 'Unknown error occurred');
  }

  return result;
}

export async function waitForProfile(
  userId: string,
  maxAttempts: number = 20,
  delayMs: number = 500
): Promise<any | null> {
  console.log(`[WaitForProfile] Waiting for profile creation (max ${maxAttempts} attempts)...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, delayMs));

    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error(`[WaitForProfile] Error on attempt ${attempt}/${maxAttempts}:`, error);
      if (attempt === maxAttempts) {
        throw new Error(`Failed to fetch profile: ${error.message}`);
      }
      continue;
    }

    if (data) {
      console.log(`[WaitForProfile] ✓ Profile found (attempt ${attempt}/${maxAttempts})`);
      return data;
    }

    console.log(`[WaitForProfile] ⏳ Still waiting... (${attempt}/${maxAttempts})`);
  }

  console.error('[WaitForProfile] ✗ Profile not found after max attempts');
  return null;
}

export async function ensureProfileExists(
  userId: string,
  email: string,
  username?: string,
  fullName?: string,
  age?: number | null
): Promise<any> {
  console.log('[EnsureProfile] Checking if profile exists...');

  const exists = await checkProfileExists(userId);

  if (exists) {
    console.log('[EnsureProfile] ✓ Profile already exists, fetching...');
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single();

    // If profile exists but age was provided and different, update it
    if (age !== null && age !== undefined && data && data.age !== age) {
      console.log('[EnsureProfile] Updating age for existing profile...');
      await supabase
        .from('profiles')
        .update({ age })
        .eq('id', userId);
      data.age = age;
    }

    return data;
  }

  console.log('[EnsureProfile] Profile does not exist, waiting for trigger...');
  const profileFromTrigger = await waitForProfile(userId, 15, 500);

  if (profileFromTrigger) {
    // If profile was created by trigger but age was provided, update it
    if (age !== null && age !== undefined && profileFromTrigger.age !== age) {
      console.log('[EnsureProfile] Updating age for trigger-created profile...');
      await supabase
        .from('profiles')
        .update({ age })
        .eq('id', userId);
      profileFromTrigger.age = age;
    }
    return profileFromTrigger;
  }

  console.warn('[EnsureProfile] Trigger did not create profile, creating manually...');
  const result = await createCompleteProfile(userId, email, username, fullName, age);

  if (!result.success || !result.profile) {
    throw new Error(
      result.errors.length > 0
        ? result.errors.join(', ')
        : 'Failed to create profile'
    );
  }

  return result.profile;
}
