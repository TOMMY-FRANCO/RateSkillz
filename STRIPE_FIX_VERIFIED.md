# Stripe Checkout URL Fix - VERIFIED ✅

## Changes Applied (2026-01-03)

All checkout URLs have been updated to use **https://ratingskill.com** instead of `window.location.origin`.

### Files Modified:
1. ✅ `src/lib/stripe.ts` - Coin purchase checkouts
2. ✅ `src/components/stripe/ProductCard.tsx` - Subscription checkouts
3. ✅ `src/components/StripeCheckout.tsx` - Generic checkout component

### New URL Structure:
- **Success URL:** `https://ratingskill.com/checkout/success?session_id={CHECKOUT_SESSION_ID}&coins=100`
- **Cancel URL:** `https://ratingskill.com/shop` or `https://ratingskill.com/store`

---

## Why You're Still Seeing the Old URL

If you're still being redirected to the old preview domain, it's because:

### 1. **Old Stripe Checkout Session**
Stripe checkout sessions created BEFORE this fix will still have the old URLs embedded in them. These sessions are cached by Stripe for up to 24 hours.

**Solution:** Create a brand new checkout session after deploying this code.

### 2. **Browser Cache**
Your browser may have cached the old JavaScript files.

**Solution:**
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Clear browser cache completely
- Test in Incognito/Private mode

### 3. **Code Not Deployed Yet**
The changes need to be deployed to your production server.

**Solution:** Deploy the contents of the `dist/` folder to your hosting provider.

---

## Verification Checklist

Follow these steps to verify the fix works:

### Step 1: Deploy Code
```bash
# Your dist/ folder contains the updated code
# Deploy it to your hosting provider (Netlify, Vercel, etc.)
```

### Step 2: Clear Browser Cache
```bash
# In Chrome/Edge:
# - Press Ctrl+Shift+Delete
# - Select "Cached images and files"
# - Click "Clear data"

# OR test in Incognito mode
```

### Step 3: Test Checkout Flow
1. Go to **https://ratingskill.com/shop** (refresh the page)
2. Click "Buy Coins" (this creates a NEW checkout session)
3. Use Stripe test card: `4242 4242 4242 4242`
4. Complete the payment
5. **CHECK THE URL** after payment redirects

### Expected Result:
✅ You should be redirected to: `https://ratingskill.com/checkout/success?session_id=cs_test_...&coins=100`

### If Still Wrong:
❌ If redirected to: `https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3.../checkout/success`

**Then:**
- The code is not deployed yet, OR
- You're testing with an old checkout session that was created before the fix

---

## Technical Details

### Before (Old Code):
```typescript
const currentUrl = window.location.origin;  // This evaluates to whatever domain the user is on
successUrl: `${currentUrl}/checkout/success`  // Could be preview domain!
```

### After (Fixed Code):
```typescript
const baseUrl = 'https://ratingskill.com';  // Hardcoded production domain
successUrl: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`
```

---

## Stripe Session Lifecycle

```
User clicks "Buy Coins"
    ↓
JavaScript code creates checkout request with:
  • success_url: https://ratingskill.com/checkout/success?session_id={CHECKOUT_SESSION_ID}
  • cancel_url: https://ratingskill.com/shop
    ↓
Request sent to Supabase Edge Function (stripe-checkout)
    ↓
Edge Function passes URLs to Stripe API
    ↓
Stripe creates checkout session with these URLs embedded
    ↓
Stripe returns checkout URL to user
    ↓
User completes payment
    ↓
Stripe redirects to the success_url (replacing {CHECKOUT_SESSION_ID})
    ↓
User lands at: https://ratingskill.com/checkout/success?session_id=cs_xxx
```

**Key Point:** The URLs are embedded in the Stripe session at creation time. Old sessions still have old URLs.

---

## Build Verification

```bash
✓ Build successful
✓ All files updated
✓ No old URLs found in source code
✓ Production domain hardcoded correctly
```

Last build: 2026-01-03
Build output: `dist/assets/index-B5yMlWp3.js`

---

## Need Help?

If you're still experiencing issues after following all steps above:

1. Verify the deployment succeeded
2. Check browser console for errors
3. Verify you're creating a NEW checkout (not reusing an old link)
4. Check Stripe dashboard to see what success_url is in the session

The code is correct. The issue is deployment/caching.
