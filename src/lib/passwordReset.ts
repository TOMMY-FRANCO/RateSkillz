import { supabase } from './supabase';

/**
 * Request a password reset
 */
export const requestPasswordReset = async (email: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> => {
  try {
    const { data, error } = await supabase.rpc('request_password_reset', {
      p_email: email.trim().toLowerCase()
    });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Failed to request password reset'
      };
    }

    return {
      success: true,
      message: data.message
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Verify a reset token
 */
export const verifyResetToken = async (token: string): Promise<{
  valid: boolean;
  error?: string;
  email?: string;
  user_id?: string;
}> => {
  try {
    const { data, error } = await supabase.rpc('verify_reset_token', {
      p_token: token
    });

    if (error) {
      return {
        valid: false,
        error: error.message
      };
    }

    if (!data || !data.valid) {
      return {
        valid: false,
        error: data?.error || 'Invalid token'
      };
    }

    return {
      valid: true,
      email: data.email,
      user_id: data.user_id
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Failed to verify token'
    };
  }
};

/**
 * Reset password with token
 */
export const resetPassword = async (token: string, newPassword: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          new_password: newPassword
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to reset password'
      };
    }

    return {
      success: true
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};
