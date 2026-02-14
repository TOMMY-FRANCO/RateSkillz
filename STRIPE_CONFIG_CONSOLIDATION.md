# Stripe Configuration Consolidation

## Overview
Consolidated all Stripe product and price configurations into a single source of truth: `stripe-config.ts`

## Problem
Previously, Stripe price IDs were defined in multiple locations:
- `stripe-config.ts` had one set of products (different Stripe account/test data)
- `lib/stripe.ts` had hardcoded price IDs in a `priceMap` object

This created confusion and made it difficult to manage Stripe products across the application.

## Solution

### Single Source of Truth: `stripe-config.ts`

All Stripe products and price IDs are now defined in `src/stripe-config.ts`:

```typescript
export const STRIPE_COIN_PRODUCTS: StripeProduct[] = [
  {
    id: 'coin_starter',
    priceId: 'price_1Spet513eRaZbd3FIFVEtQpE',
    name: '100 Coins',
    description: 'Starter pack',
    price: 1.00,
    coins: 100,
    currency: 'gbp',
    currencySymbol: '£',
    mode: 'payment'
  },
  {
    id: 'coin_value',
    priceId: 'price_1Spevl13eRaZbd3Ftn2r6yvv',
    name: '300 Coins',
    description: 'Most popular value pack',
    price: 2.00,
    coins: 300,
    currency: 'gbp',
    currencySymbol: '£',
    mode: 'payment'
  }
];
```

### Updated Import Pattern

`lib/stripe.ts` now imports from the centralized config:

```typescript
import { getCoinProductByAmount } from '../stripe-config';

function getCoinPriceId(coins: number, priceGBP: number): string {
  const product = getCoinProductByAmount(coins);

  if (!product) {
    throw new Error(
      `No Stripe product configured for ${coins} coins at £${priceGBP}. ` +
      'Please update STRIPE_COIN_PRODUCTS in src/stripe-config.ts'
    );
  }

  return product.priceId;
}
```

## Benefits

1. **Single Source of Truth**: All Stripe configuration in one place
2. **Easier Maintenance**: Update price IDs in one location
3. **Type Safety**: TypeScript interfaces ensure consistency
4. **Better Error Messages**: Clear guidance on where to update configs
5. **Price Validation**: Warns if price mismatch detected
6. **Scalability**: Easy to add new coin packages or products

## Current Stripe Products

### Coin Packages
- **100 Coins** (£1.00): `price_1Spet513eRaZbd3FIFVEtQpE`
- **300 Coins** (£2.00): `price_1Spevl13eRaZbd3Ftn2r6yvv`

## How to Add New Products

1. Add new product to `STRIPE_COIN_PRODUCTS` in `src/stripe-config.ts`:
   ```typescript
   {
     id: 'coin_mega',
     priceId: 'price_XXXXXXXXXXXXX', // From Stripe Dashboard
     name: '1000 Coins',
     description: 'Mega value pack',
     price: 5.00,
     coins: 1000,
     currency: 'gbp',
     currencySymbol: '£',
     mode: 'payment'
   }
   ```

2. Add corresponding package to `COIN_PACKAGES` in `src/lib/coins.ts`:
   ```typescript
   { id: 'mega', price: 5.00, coins: 1000 }
   ```

3. The Shop page will automatically display the new package

## Helper Functions

### Available in `stripe-config.ts`:

- **`getProductById(id: string)`**: Find product by internal ID
- **`getProductByPriceId(priceId: string)`**: Find product by Stripe Price ID
- **`getCoinProductByAmount(coins: number)`**: Find coin product by coin amount

## Files Modified

- ✅ `src/stripe-config.ts` - Centralized configuration
- ✅ `src/lib/stripe.ts` - Updated to import from config
- ✅ Removed duplicate/test price IDs
- ✅ Added validation and error handling

## Migration Complete

All Stripe references now point to the single source of truth in `stripe-config.ts`. No breaking changes to existing functionality.
