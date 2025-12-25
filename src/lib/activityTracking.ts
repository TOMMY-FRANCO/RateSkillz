import { supabase } from './supabase';

export async function updateUserActivity(userId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('update_last_activity', {
      user_id: userId,
    });

    if (error) {
      console.error('Error updating user activity:', error);
    }
  } catch (error) {
    console.error('Failed to update user activity:', error);
  }
}

export async function trackActivity(userId: string | undefined): Promise<void> {
  if (!userId) return;

  await updateUserActivity(userId);
}
