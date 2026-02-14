# Password Requirements Standardization

## Problem

Password requirements were inconsistent across signup and password reset flows:

**Before:**
- SignupForm (OAuth): Required minimum 6 characters only
- Signup page: Required minimum 6 characters only
- ResetPassword page: Required minimum 8 characters only
- reset-password edge function: Required minimum 8 characters only

This created confusion and security inconsistencies where:
- Users could create weak passwords during signup (e.g., "123456")
- Password resets enforced stronger requirements than initial signup
- No validation for numbers or symbols in passwords

## Solution

Standardized password requirements across all authentication flows:

### New Requirements
- **Minimum 8 characters**
- **At least 1 number** (0-9)
- **At least 1 symbol** (!@#$%^&*)

### Implementation

#### 1. Shared Validation Function

Created `src/lib/passwordValidation.ts`:
```typescript
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
```

#### 2. Updated Components

**SignupForm (OAuth - `src/components/auth/SignupForm.tsx`):**
- Replaced length check from 6 to use `validatePassword()`
- Added helper text showing requirements
- Updated placeholder text

**Before:**
```typescript
if (password.length < 6) {
  setError('Password must be at least 6 characters');
  return;
}
```

**After:**
```typescript
const validation = validatePassword(password);
if (!validation.isValid) {
  setError(validation.error || 'Invalid password');
  return;
}
```

**Signup Page (`src/pages/Signup.tsx`):**
- Replaced length check from 6 to use `validatePassword()`
- Updated helper text and placeholder

**ResetPassword Page (`src/pages/ResetPassword.tsx`):**
- Replaced length-only check to use `validatePassword()`
- Added helper text showing full requirements
- Updated placeholder text

**reset-password Edge Function (`supabase/functions/reset-password/index.ts`):**
- Added number validation (`/\d/.test()`)
- Added symbol validation (`/[!@#$%^&*]/.test()`)
- Consistent error messages with frontend

**Before:**
```typescript
if (new_password.length < 8) {
  return error("Password must be at least 8 characters long");
}
```

**After:**
```typescript
if (new_password.length < 8) {
  return error("Password must be at least 8 characters");
}

if (!/\d/.test(new_password)) {
  return error("Password must contain at least 1 number");
}

if (!/[!@#$%^&*]/.test(new_password)) {
  return error("Password must contain at least 1 symbol (!@#$%^&*)");
}
```

## User Impact

### Existing Users
- **No action required** - Existing passwords remain valid regardless of complexity
- Can continue logging in with current passwords
- Only affected when changing password (must meet new requirements)

### New Users (Signup)
- Must create passwords meeting new requirements
- Clear validation messages guide password creation
- Placeholder text shows example format

### Password Resets
- Must create passwords meeting new requirements
- Same requirements as signup for consistency
- Server-side validation prevents bypass

## Security Benefits

1. **Stronger passwords** - Minimum complexity requirements prevent common weak passwords
2. **Consistent enforcement** - All entry points validate the same rules
3. **Clear messaging** - Users understand requirements upfront
4. **Server-side validation** - Edge function validates even if client-side is bypassed
5. **Backwards compatible** - Existing users not forced to change passwords

## UI/UX Improvements

### Visual Feedback

All password fields now show:
- **Placeholder:** "8+ chars, 1 number, 1 symbol (!@#$%^&*)"
- **Helper text:** "Password must be at least 8 characters with 1 number and 1 symbol (!@#$%^&*)"
- **Error messages:** Specific feedback on which requirement is missing

### Validation Flow

1. User enters password
2. On form submit, validate immediately
3. Show specific error if validation fails
4. Clear, actionable error messages:
   - "Password must be at least 8 characters"
   - "Password must contain at least 1 number"
   - "Password must contain at least 1 symbol (!@#$%^&*)"

## Testing Checklist

- [x] SignupForm (OAuth) validates password requirements
- [x] Signup page validates password requirements
- [x] ResetPassword page validates password requirements
- [x] reset-password edge function validates server-side
- [x] Error messages are clear and consistent
- [x] Helper text displays correctly
- [x] Build succeeds without errors
- [x] Edge function deployed successfully
- [ ] Manual test: Try signup with weak password (should fail)
- [ ] Manual test: Try signup with valid password (should succeed)
- [ ] Manual test: Try password reset with weak password (should fail)
- [ ] Manual test: Try password reset with valid password (should succeed)
- [ ] Manual test: Existing user can still login with old password

## Files Modified

### New Files
- ✅ `src/lib/passwordValidation.ts` - Shared validation logic

### Updated Files
- ✅ `src/components/auth/SignupForm.tsx` - OAuth signup form
- ✅ `src/pages/Signup.tsx` - Main signup page
- ✅ `src/pages/ResetPassword.tsx` - Password reset page
- ✅ `supabase/functions/reset-password/index.ts` - Edge function validation

## Example Valid Passwords

- `MyPass123!`
- `Secure#99`
- `Test@1234`
- `P@ssw0rd`
- `Welcome1!`

## Example Invalid Passwords

- `password` - No number, no symbol
- `12345678` - No symbol
- `Pass@word` - No number
- `Pass123` - No symbol
- `P@ss1` - Too short (less than 8 characters)

## Rollback Plan

If issues arise:

1. Revert `src/lib/passwordValidation.ts` changes
2. Restore original validation in each component
3. Redeploy reset-password edge function with old validation
4. No data migration needed (passwords stored as hashes)

## Future Enhancements

Potential improvements:
1. Password strength meter (visual indicator)
2. Real-time validation as user types
3. More detailed requirements (uppercase/lowercase)
4. Password suggestions for weak passwords
5. Common password dictionary check
6. Breach detection integration (Have I Been Pwned API)

## Summary

Password requirements are now standardized across all authentication flows. New accounts and password changes must meet the new complexity requirements (8+ characters, 1 number, 1 symbol). Existing users can continue using their current passwords without any changes. This improves security while maintaining backwards compatibility.
