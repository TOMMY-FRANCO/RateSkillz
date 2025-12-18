import { supabase } from './supabase';

export interface UsernameValidation {
  valid: boolean;
  error?: string;
}

export interface UsernameChangeAbility {
  can_change: boolean;
  days_remaining: number;
  is_first_change: boolean;
  error?: string;
}

export interface UsernameChangeResult {
  success: boolean;
  error?: string;
  new_username?: string;
  old_username?: string;
}

export function validateUsernameFormat(username: string): UsernameValidation {
  if (!username || username.trim().length === 0) {
    return { valid: false, error: 'Username cannot be empty' };
  }

  if (username.length > 16) {
    return { valid: false, error: 'Username must be 16 characters or less' };
  }

  if (/^[_.]/.test(username) || /[_.]$/.test(username)) {
    return { valid: false, error: 'Username cannot start or end with underscore or period' };
  }

  const underscoreCount = (username.match(/_/g) || []).length;
  const periodCount = (username.match(/\./g) || []).length;

  if (underscoreCount > 1) {
    return { valid: false, error: 'Username can only contain one underscore' };
  }

  if (periodCount > 1) {
    return { valid: false, error: 'Username can only contain one period' };
  }

  if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, one underscore, and one period' };
  }

  return { valid: true };
}

export async function checkUsernameAvailable(username: string, currentUserId?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_username_available', {
      p_username: username.toLowerCase(),
      p_user_id: currentUserId || null
    });

    if (error) {
      console.error('Error checking username availability:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false;
  }
}

export async function canChangeUsername(userId: string): Promise<UsernameChangeAbility> {
  try {
    const { data, error } = await supabase.rpc('can_change_username', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error checking username change ability:', error);
      return {
        can_change: false,
        days_remaining: 999,
        is_first_change: false,
        error: 'Failed to check username change ability'
      };
    }

    return data;
  } catch (error) {
    console.error('Error checking username change ability:', error);
    return {
      can_change: false,
      days_remaining: 999,
      is_first_change: false,
      error: 'Failed to check username change ability'
    };
  }
}

export async function changeUsername(userId: string, newUsername: string): Promise<UsernameChangeResult> {
  try {
    const { data, error } = await supabase.rpc('change_username', {
      p_user_id: userId,
      p_new_username: newUsername
    });

    if (error) {
      console.error('Error changing username:', error);
      return {
        success: false,
        error: error.message || 'Failed to change username'
      };
    }

    return data;
  } catch (error: any) {
    console.error('Error changing username:', error);
    return {
      success: false,
      error: error.message || 'Failed to change username'
    };
  }
}

export async function getUsernameHistory(userId: string) {
  try {
    const { data, error } = await supabase
      .from('username_history')
      .select('*')
      .eq('user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching username history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching username history:', error);
    return [];
  }
}

export function displayUsername(username: string): string {
  return username ? username.toUpperCase() : '';
}

export function normalizeUsername(username: string): string {
  return username ? username.toLowerCase().trim() : '';
}
