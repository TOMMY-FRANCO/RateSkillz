export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      error: 'Password must be at least 8 characters'
    };
  }

  if (!/\d/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least 1 number'
    };
  }

  if (!/[!@#$%^&*]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least 1 symbol (!@#$%^&*)'
    };
  }

  return {
    isValid: true
  };
}

export function getPasswordRequirements(): string {
  return 'Password must be at least 8 characters with 1 number and 1 symbol (!@#$%^&*)';
}
