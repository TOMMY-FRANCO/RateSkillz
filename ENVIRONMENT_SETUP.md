# Environment Variables Setup Guide

This guide explains all environment variables required for RatingSkill and how to configure them.

## Quick Start

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Fill in the required Supabase credentials (see below)

3. Start the development server:
   ```bash
   npm run dev
   ```

---

## Client-Side Environment Variables

These variables are used in the frontend application and should be set in your `.env` file.

### Required Variables

#### `VITE_SUPABASE_URL`
**Description**: Your Supabase project URL
**Where to get it**: [Supabase Dashboard](https://app.supabase.com) → Project → Settings → API
**Format**: `https://your-project-id.supabase.co`
**Used by**: Database client, Edge Functions calls
**Example**:
```env
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
```

#### `VITE_SUPABASE_ANON_KEY`
**Description**: Your Supabase anonymous (public) key
**Where to get it**: [Supabase Dashboard](https://app.supabase.com) → Project → Settings → API
**Security**: Safe to expose in client code (protected by RLS policies)
**Used by**: Authentication, database operations, Edge Functions authorization
**Example**:
```env
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### `VITE_APP_URL`
**Description**: The public URL where your application is hosted
**Used by**: QR code generation, share links, OAuth redirects, email links
**Development**: `http://localhost:5173`
**Production**: Your actual domain (e.g., `https://ratingskill.com`)
**Example**:
```env
# Development
VITE_APP_URL=http://localhost:5173

# Production
VITE_APP_URL=https://ratingskill.com
```

### Optional Variables

#### `VITE_RECAPTCHA_SITE_KEY`
**Description**: Google reCAPTCHA v3 site key for bot protection
**Where to get it**: [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
**Used by**: Signup form (`src/pages/Signup.tsx`)
**Required for**: Bot protection during user registration
**If not set**: Signup will work but without reCAPTCHA verification
**Example**:
```env
VITE_RECAPTCHA_SITE_KEY=6LdfIkssAAAAAFQsvEgAtoKEFo2qTFTmR77N7bOa
```

**How to set up**:
1. Go to https://www.google.com/recaptcha/admin
2. Register a new site with reCAPTCHA v3
3. Add your domain(s): `localhost` for development, `ratingskill.com` for production
4. Copy the "Site Key" to `VITE_RECAPTCHA_SITE_KEY`
5. Copy the "Secret Key" to server-side `RECAPTCHA_SECRET_KEY` (see below)

---

## Server-Side Environment Variables

These variables are used in Supabase Edge Functions and should be configured in the Supabase Dashboard, **not** in your `.env` file.

### How to Set Server-Side Variables

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Edge Functions** → **Secrets**
4. Click **Add Secret**
5. Enter the secret name and value
6. Click **Save**

### Auto-Provisioned Variables

These are automatically available in all Edge Functions. You don't need to configure them.

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Admin key with full database access (⚠️ NEVER expose in frontend!)
- `SUPABASE_DB_URL`: Direct PostgreSQL connection string

### Optional Server-Side Variables

#### `STRIPE_SECRET_KEY`
**Description**: Your Stripe secret API key
**Where to get it**: [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
**Used by**: `stripe-checkout` and `stripe-webhook` Edge Functions
**Required for**: Processing coin purchases via Stripe
**Format**: Starts with `sk_test_` (test mode) or `sk_live_` (production)
**Example**:
```
sk_test_51Hw3...
```

**How to set up**:
1. Go to https://dashboard.stripe.com/apikeys
2. Copy the "Secret key" (reveals when you click "Reveal test key")
3. In Supabase Dashboard → Edge Functions → Secrets
4. Add secret: `STRIPE_SECRET_KEY` = `sk_test_...`

#### `STRIPE_WEBHOOK_SECRET`
**Description**: Webhook signing secret for verifying Stripe events
**Where to get it**: [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
**Used by**: `stripe-webhook` Edge Function
**Required for**: Processing payment confirmations securely
**Format**: Starts with `whsec_`
**Example**:
```
whsec_abc123...
```

**How to set up**:
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter URL: `https://your-project-id.supabase.co/functions/v1/stripe-webhook`
4. Select events: `checkout.session.completed`, `payment_intent.succeeded`
5. Copy the "Signing secret"
6. In Supabase Dashboard → Edge Functions → Secrets
7. Add secret: `STRIPE_WEBHOOK_SECRET` = `whsec_...`

#### `RECAPTCHA_SECRET_KEY`
**Description**: Google reCAPTCHA v3 secret key for server-side verification
**Where to get it**: [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin) (same place as site key)
**Used by**: `signup-verification` Edge Function
**Required for**: Server-side validation of reCAPTCHA tokens
**Pair with**: `VITE_RECAPTCHA_SITE_KEY` (client-side)
**Example**:
```
6LdfIkssAAAAAA1B2C3D4E5F6G7H8I9J0K
```

**How to set up**:
1. When you create a reCAPTCHA site, you get both a site key and secret key
2. Site key goes in `.env` as `VITE_RECAPTCHA_SITE_KEY`
3. Secret key goes in Supabase Dashboard → Edge Functions → Secrets
4. Add secret: `RECAPTCHA_SECRET_KEY` = `6L...`

#### `RESEND_API_KEY`
**Description**: Resend API key for sending transactional emails
**Where to get it**: [Resend Dashboard](https://resend.com/api-keys)
**Used by**: `password-reset-email` Edge Function
**Required for**: Sending password reset emails
**Format**: Starts with `re_`
**Alternative**: Use Supabase's built-in email service
**Example**:
```
re_abc123def456...
```

**How to set up**:
1. Create account at https://resend.com
2. Go to API Keys
3. Click "Create API Key"
4. Copy the key
5. In Supabase Dashboard → Edge Functions → Secrets
6. Add secret: `RESEND_API_KEY` = `re_...`

---

## Configuration Checklists

### Minimum Setup (Required)
- [ ] `VITE_SUPABASE_URL` (from Supabase Dashboard)
- [ ] `VITE_SUPABASE_ANON_KEY` (from Supabase Dashboard)
- [ ] `VITE_APP_URL` (your app URL)

### Recommended Setup
- [ ] `VITE_RECAPTCHA_SITE_KEY` (bot protection)
- [ ] `RECAPTCHA_SECRET_KEY` (server-side verification)

### Full Feature Setup
- [ ] `STRIPE_SECRET_KEY` (enable payments)
- [ ] `STRIPE_WEBHOOK_SECRET` (payment confirmations)
- [ ] `RESEND_API_KEY` (password reset emails)

---

## Feature Matrix

| Feature | Required Variables | Optional Variables |
|---------|-------------------|-------------------|
| Basic app functionality | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY`<br>`VITE_APP_URL` | - |
| User authentication | ✅ Included in basic | - |
| Profile management | ✅ Included in basic | - |
| Bot protection | - | `VITE_RECAPTCHA_SITE_KEY`<br>`RECAPTCHA_SECRET_KEY` |
| Coin purchases | - | `STRIPE_SECRET_KEY`<br>`STRIPE_WEBHOOK_SECRET` |
| Password reset emails | - | `RESEND_API_KEY` |
| QR code sharing | `VITE_APP_URL` | - |
| Social sharing | `VITE_APP_URL` | - |

---

## Environment-Specific Configurations

### Development (.env)
```env
VITE_SUPABASE_URL=https://your-dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-dev-anon-key
VITE_APP_URL=http://localhost:5173
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

**Server-side (Supabase Dashboard)**:
- Use Stripe test mode keys (`sk_test_...`)
- Use reCAPTCHA test keys if available
- Use Resend test domain

### Production
```env
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-prod-anon-key
VITE_APP_URL=https://ratingskill.com
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

**Server-side (Supabase Dashboard)**:
- Use Stripe live mode keys (`sk_live_...`)
- Use production reCAPTCHA keys
- Use Resend production domain

---

## Troubleshooting

### Error: "Invalid API key"
**Cause**: Incorrect Supabase credentials
**Solution**:
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
2. Check they match your Supabase Dashboard → Settings → API
3. Restart dev server: `npm run dev`

### Error: "Failed to fetch" or CORS errors
**Cause**: Incorrect `VITE_SUPABASE_URL`
**Solution**:
1. Ensure URL includes `https://` protocol
2. Ensure URL ends with `.supabase.co` (no trailing slash)
3. Restart dev server

### Stripe payments not working
**Cause**: Missing or incorrect Stripe configuration
**Solution**:
1. Verify `STRIPE_SECRET_KEY` is set in Supabase Dashboard → Edge Functions → Secrets
2. Verify Stripe product price IDs in `src/stripe-config.ts` match your Stripe Dashboard
3. Check webhook is configured if using live payments

### reCAPTCHA not appearing
**Cause**: Missing site key or incorrect domain
**Solution**:
1. Verify `VITE_RECAPTCHA_SITE_KEY` is set in `.env`
2. In reCAPTCHA admin, add your domain (localhost for dev, actual domain for prod)
3. Restart dev server

### Password reset emails not sending
**Cause**: Missing Resend API key or incorrect configuration
**Solution**:
1. Verify `RESEND_API_KEY` is set in Supabase Dashboard → Edge Functions → Secrets
2. Verify your email domain is verified in Resend
3. Check Edge Function logs in Supabase Dashboard

### QR codes showing "undefined" URL
**Cause**: Missing or incorrect `VITE_APP_URL`
**Solution**:
1. Verify `VITE_APP_URL` is set in `.env`
2. Ensure it matches your actual app URL (no trailing slash)
3. Restart dev server

---

## Security Best Practices

### DO ✅
1. **Keep `.env` file secret**: Never commit it to version control (it's in `.gitignore`)
2. **Use different keys per environment**: Separate dev and production credentials
3. **Rotate keys regularly**: Change credentials periodically for security
4. **Use environment variables**: Never hardcode secrets in source code
5. **Limit key permissions**: Use the minimum required permissions for each key

### DON'T ❌
1. **Don't expose service role key**: NEVER use `SUPABASE_SERVICE_ROLE_KEY` in frontend code
2. **Don't commit secrets**: Never commit `.env` or hardcoded credentials
3. **Don't share keys**: Don't send credentials via email or chat
4. **Don't use production keys in development**: Keep environments separate
5. **Don't log secrets**: Avoid logging API keys or tokens

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Google reCAPTCHA v3 Guide](https://developers.google.com/recaptcha/docs/v3)
- [Resend Documentation](https://resend.com/docs)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

## Getting Help

If you encounter issues:

1. Check this documentation first
2. Review the troubleshooting section
3. Check Supabase Edge Function logs
4. Review browser console for client-side errors
5. Verify all required environment variables are set
6. Ensure you've restarted the dev server after changing `.env`

For Supabase-specific issues:
- [Supabase Support](https://supabase.com/support)
- [Supabase Community Discord](https://discord.supabase.com)
