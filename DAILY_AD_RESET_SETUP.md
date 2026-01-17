# Daily Ad Reset System - Setup Guide

## Overview

The daily ad reset system automatically resets all users' ad viewing status at midnight GMT every day. This allows users to watch one ad per day for coins.

## How It Works

1. **24-Hour Rolling Window**: Users can watch an ad after 24 hours from their last view
2. **Midnight GMT Reset**: At 00:00 GMT daily, ALL users' ad viewing status is reset
3. **Dual Protection**: Users get the earlier of: 24 hours since last view OR midnight GMT reset

## System Components

### 1. Database Function: `reset_daily_ad_views()`
- Resets all users' `last_ad_view_date` to NULL
- Logs execution to `admin_security_log`
- Returns count of users reset

### 2. Edge Function: `daily-ad-reset`
- **URL**: `https://niurjxqttyaxmjrladrs.supabase.co/functions/v1/daily-ad-reset`
- **Method**: POST or GET
- **Authentication**: None required (public endpoint)
- **Response**: JSON with reset stats and timestamp

### 3. Frontend Check: `can_watch_ad_today()`
- Returns whether user can watch ad
- Provides countdown timer (hours/minutes remaining)
- Shows next available time

## Setting Up Automatic Daily Execution

### Option 1: Cron-Job.org (Free)

1. Go to [cron-job.org](https://cron-job.org)
2. Create free account
3. Click "Create cronjob"
4. Configure:
   - **Title**: Daily Ad Reset
   - **URL**: `https://niurjxqttyaxmjrladrs.supabase.co/functions/v1/daily-ad-reset`
   - **Schedule**: Every day at 00:00 GMT
   - **Request Method**: GET or POST
   - **Headers**: None required
5. Save and enable

### Option 2: EasyCron (Free tier available)

1. Sign up at [easycron.com](https://www.easycron.com)
2. Create new cron job
3. Set:
   - **URL**: `https://niurjxqttyaxmjrladrs.supabase.co/functions/v1/daily-ad-reset`
   - **Cron Expression**: `0 0 * * *` (midnight GMT)
   - **Request Type**: GET or POST
   - **Custom Headers**: None required
4. Activate

### Option 3: GitHub Actions (Free for public repos)

Create `.github/workflows/daily-ad-reset.yml`:

```yaml
name: Daily Ad Reset

on:
  schedule:
    - cron: '0 0 * * *'  # Runs at 00:00 GMT daily
  workflow_dispatch:  # Allows manual trigger

jobs:
  reset-ads:
    runs-on: ubuntu-latest
    steps:
      - name: Call Reset Endpoint
        run: |
          curl -X GET "https://niurjxqttyaxmjrladrs.supabase.co/functions/v1/daily-ad-reset"
```

No secrets needed - the endpoint is public.

### Option 4: Manual Testing

Test the reset anytime by running:

```bash
curl "https://niurjxqttyaxmjrladrs.supabase.co/functions/v1/daily-ad-reset"
```

Or with POST:

```bash
curl -X POST "https://niurjxqttyaxmjrladrs.supabase.co/functions/v1/daily-ad-reset"
```

## Verifying Execution

### Check Logs

Query the admin security log:

```sql
SELECT
  event_type,
  severity,
  details->>'users_reset' as users_reset,
  details->>'message' as message,
  created_at
FROM admin_security_log
WHERE event_type = 'daily_ad_reset'
ORDER BY created_at DESC
LIMIT 10;
```

### Expected Response

Successful reset returns:

```json
{
  "success": true,
  "users_reset": 6,
  "users_checked": 6,
  "reset_time": "2026-01-17T00:00:00.123456+00:00",
  "message": "Successfully reset 6 users",
  "timestamp": "2026-01-17T00:00:00.234Z",
  "gmt_time": "17/01/2026, 00:00:00"
}
```

## Security

- Edge function is public (no authentication required)
- This is safe because:
  - The operation is idempotent (running multiple times has same effect)
  - Only resets ad viewing dates (no sensitive data exposed)
  - All executions are logged to `admin_security_log` with timestamp
  - No data is returned that could be exploited
- Only the edge function (with service role) can call `reset_daily_ad_views()`

## Troubleshooting

### Reset Didn't Run
- Check cron service is active and configured for 00:00 GMT
- Verify URL is correct: `https://niurjxqttyaxmjrladrs.supabase.co/functions/v1/daily-ad-reset`
- Test manually with curl to confirm endpoint works
- Check `admin_security_log` for error entries

### Users Still Can't Watch Ads
- 24-hour rolling window still applies
- Check user's `last_ad_view_date` timestamp
- Verify reset function executed successfully

### Manual Reset
If you need to reset immediately:

```bash
curl "https://niurjxqttyaxmjrladrs.supabase.co/functions/v1/daily-ad-reset"
```

## Migration History

- `20260117034700_fix_ad_viewing_24_hour_interval_and_auto_reset.sql` - Added 24-hour check
- `20260117040000_remove_pg_cron_and_improve_reset_system.sql` - Removed broken pg_cron
- `20260117040100_add_daily_reset_event_types_to_security_log.sql` - Added logging support
- `20260117040200_add_info_severity_to_security_log.sql` - Added info severity

## Support

For issues with the daily reset system, check:
1. Edge function deployment status
2. Admin security logs for errors
3. Cron service execution history
4. User's `last_ad_view_date` values
