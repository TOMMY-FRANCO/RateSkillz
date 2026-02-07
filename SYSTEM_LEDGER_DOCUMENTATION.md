# System Ledger and Monthly Distribution Documentation

## Overview

The System Ledger provides a comprehensive audit trail for all pool-to-pool transfers in the RatingSkill coin economy. This ensures complete transparency and integrity verification for all resource pool operations.

## New Resource Pools

Three new pools have been added to the system:

### 1. Infrastructure_Reserve
- **Starting Balance**: 100,000 coins
- **Purpose**: Source pool for monthly distributions
- **Type**: Infrastructure reserve
- **Usage**: Automatically deducts 4,000 coins monthly for operational costs

### 2. Coder_Credits
- **Starting Balance**: 0 coins
- **Purpose**: Development and coder compensation
- **Type**: Operational
- **Usage**: Receives 2,000 coins monthly from Infrastructure_Reserve
- **Restrictions**: Locked within app ecosystem - NO external transfers or withdrawals allowed

### 3. Monthly_Infrastructure_Cost
- **Starting Balance**: 0 coins
- **Purpose**: Monthly infrastructure and operational expenses
- **Type**: Operational
- **Usage**: Receives 2,000 coins monthly from Infrastructure_Reserve

## System Ledger Table

The `system_ledger` table tracks all pool-to-pool transfers with the following information:

### Columns
- `id`: Unique identifier (UUID)
- `source_pool`: Name of the pool coins are transferred from
- `destination_pool`: Name of the pool coins are transferred to
- `amount`: Number of coins transferred (must be positive)
- `reason`: Transfer reason (MONTHLY_DISTRIBUTION, MANUAL_TRANSFER, SYSTEM_DISTRIBUTION)
- `transfer_date`: Timestamp of the transfer
- `notes`: Additional notes about the transfer
- `created_at`: Record creation timestamp

### Key Features
- All transfers are logged automatically
- Provides complete audit trail
- Enables integrity verification
- Supports historical analysis

## Monthly Distribution System

### How It Works

The monthly distribution is executed via the `execute_monthly_distribution()` function:

1. **Verification**: Checks if distribution already ran this month
2. **Balance Check**: Verifies Infrastructure_Reserve has at least 4,000 coins
3. **Atomic Operations** (all succeed or all fail):
   - Deduct 4,000 coins from Infrastructure_Reserve
   - Add 2,000 coins to Coder_Credits
   - Add 2,000 coins to Monthly_Infrastructure_Cost
4. **Ledger Recording**: Logs both transfers to system_ledger
5. **Timestamp Update**: Updates pool timestamps

### Safety Features

- **One Distribution Per Month**: Prevents duplicate distributions in the same calendar month
- **Atomic Transactions**: All three operations complete together or none complete
- **Automatic Rollback**: If any operation fails, all changes are automatically rolled back
- **Error Handling**: Returns detailed error messages if distribution fails
- **Retry Logic**: Can be safely retried if it fails

### Usage

#### From Admin UI
1. Navigate to Admin Coin Pool Dashboard
2. Scroll to "Monthly Distribution" section
3. Click "Execute Distribution" button
4. Confirm the action
5. View results in the distribution result panel

#### Programmatically
```sql
SELECT execute_monthly_distribution();
```

#### Response Format
```json
{
  "success": true,
  "distribution_date": "2026-02-07T00:00:00Z",
  "total_distributed": 4000.00,
  "transfers": [
    {
      "ledger_id": "uuid-here",
      "from": "Infrastructure_Reserve",
      "to": "Coder_Credits",
      "amount": 2000.00
    },
    {
      "ledger_id": "uuid-here",
      "from": "Infrastructure_Reserve",
      "to": "Monthly_Infrastructure_Cost",
      "amount": 2000.00
    }
  ],
  "new_infrastructure_balance": 96000.00
}
```

### Error Responses

#### Already Executed This Month
```json
{
  "success": false,
  "error": "Monthly distribution already executed for this month",
  "executed_at": "2026-02-07T00:00:00Z"
}
```

#### Insufficient Balance
```json
{
  "success": false,
  "error": "Insufficient balance in Infrastructure_Reserve",
  "required": 4000.00,
  "available": 1000.00
}
```

## Pool Integrity Verification

### What It Does

The `verify_pool_integrity()` function compares current pool balances against system_ledger entries to detect any discrepancies.

### How It Works

For each active pool:
1. Calculate total inflow (where pool is destination)
2. Calculate total outflow (where pool is source)
3. Calculate net ledger change (inflow - outflow)
4. Compare current balance vs net ledger change
5. Flag any discrepancies

### Pool Status Types

#### SYNCED
- Pool balance matches ledger records exactly
- No discrepancies detected
- Example: Coder_Credits after receiving monthly distribution

#### INITIAL_BALANCE
- Pool has balance but no ledger entries
- Expected for pools created with initial allocations
- Example: Infrastructure_Reserve with starting 100,000 coins

#### DISCREPANCY_DETECTED
- Pool balance doesn't match ledger records
- Requires investigation
- Could indicate unlogged transactions or data corruption

### Usage

#### From Admin UI
1. Navigate to Admin Coin Pool Dashboard
2. Scroll to "Pool Integrity Verification" section
3. Click "Verify Integrity" button
4. Review detailed report for each pool

#### Programmatically
```sql
SELECT verify_pool_integrity();
```

#### Response Format
```json
{
  "sync_date": "2026-02-07T04:23:27Z",
  "pools_checked": 7,
  "pools_with_issues": 0,
  "total_discrepancy": 0.00,
  "overall_status": "HEALTHY",
  "pool_details": [
    {
      "pool_name": "Coder_Credits",
      "current_balance": 2000.00,
      "ledger_inflow": 2000.00,
      "ledger_outflow": 0.00,
      "net_ledger_change": 2000.00,
      "discrepancy": 0.00,
      "status": "SYNCED",
      "notes": "Pool is properly synced with ledger"
    }
  ]
}
```

## Manual Pool Transfers

For administrative purposes, pools can be manually transferred using the `transfer_between_pools()` function.

### Usage

```sql
SELECT transfer_between_pools(
  'Source_Pool_Name',
  'Destination_Pool_Name',
  1000.00,
  'MANUAL_TRANSFER',
  'Optional notes about why this transfer was made'
);
```

### Features
- Validates both pools exist
- Checks source pool has sufficient balance
- Atomic operation with automatic rollback on failure
- Automatically logs to system_ledger
- Updates pool timestamps

## System Ledger History

View recent ledger entries using the `get_system_ledger_history()` function.

### Usage

```sql
-- Get last 50 entries
SELECT * FROM get_system_ledger_history(50, 0);

-- Get next 50 entries (pagination)
SELECT * FROM get_system_ledger_history(50, 50);
```

### From Admin UI
The System Ledger History section automatically displays the 50 most recent transfers with:
- Transfer amount
- Source and destination pools
- Transfer reason
- Date and time
- Additional notes

## Security and Permissions

### Row Level Security (RLS)
- System ledger is protected by RLS
- Only admins can view ledger entries
- System functions can insert entries automatically
- All access attempts are logged

### Admin Requirements
All functions require admin privileges:
- `execute_monthly_distribution()`
- `verify_pool_integrity()`
- `transfer_between_pools()`
- `get_system_ledger_history()`

### Audit Trail
- All admin access is logged to `admin_access_log`
- All pool operations are logged to `system_ledger`
- Timestamps recorded for all actions
- Complete traceability for compliance

## Coder_Credits Restrictions

**IMPORTANT**: Coder_Credits are locked within the app ecosystem

### Restrictions
- ❌ NO external withdrawals
- ❌ NO transfers to external accounts
- ❌ NO conversion to fiat currency
- ✅ Can be used for internal app features
- ✅ Tracked in system ledger
- ✅ Transparent allocation and usage

### Purpose
These coins are intended solely for:
- Developer compensation
- Code bounties
- Internal development incentives
- Platform maintenance costs

## Monitoring and Maintenance

### Daily Tasks
1. Review system ledger for unusual activity
2. Check pool integrity status
3. Monitor distribution success/failure

### Monthly Tasks
1. Execute monthly distribution on the 1st
2. Verify distribution was successful
3. Run integrity check after distribution
4. Review Infrastructure_Reserve balance
5. Document any manual transfers

### Quarterly Tasks
1. Full audit of all pool balances
2. Review ledger history for patterns
3. Verify total coin supply matches records
4. Archive old ledger entries if needed

## Troubleshooting

### Distribution Fails
1. Check Infrastructure_Reserve balance
2. Verify no distribution ran this month
3. Review error message in response
4. Retry after fixing the issue
5. Contact system administrator if problem persists

### Integrity Check Shows Issues
1. Note which pools have discrepancies
2. Review system ledger for those pools
3. Check for unlogged manual operations
4. Compare against transaction history
5. Document findings for investigation

### Unexpected Balances
1. Run integrity verification
2. Review recent ledger entries
3. Check admin access logs
4. Verify no unauthorized transfers
5. Escalate to technical team if needed

## Database Functions Reference

### execute_monthly_distribution()
- **Returns**: jsonb with success status and transfer details
- **Parameters**: None
- **Frequency**: Once per month
- **Security**: Admin only

### verify_pool_integrity()
- **Returns**: jsonb with comprehensive integrity report
- **Parameters**: None
- **Frequency**: As needed
- **Security**: Admin only

### transfer_between_pools(source, destination, amount, reason, notes)
- **Returns**: jsonb with transfer confirmation
- **Parameters**:
  - `source_pool`: text (pool name)
  - `destination_pool`: text (pool name)
  - `amount`: numeric (coins to transfer)
  - `reason`: text (optional, default: 'MANUAL_TRANSFER')
  - `notes`: text (optional)
- **Security**: Admin only

### get_system_ledger_history(limit, offset)
- **Returns**: Table of ledger entries
- **Parameters**:
  - `limit`: integer (default: 100)
  - `offset`: integer (default: 0)
- **Security**: Admin only

## Migration Information

**Migration File**: `create_coder_credits_system_and_monthly_distribution.sql`

**Created**:
- system_ledger table
- Infrastructure_Reserve pool (100,000 coins)
- Coder_Credits pool (0 coins)
- Monthly_Infrastructure_Cost pool (0 coins)
- All required functions
- RLS policies
- Indexes for performance

**Backward Compatible**: Yes - existing pools and functionality unchanged

## Support

For questions or issues with the System Ledger:
1. Check this documentation first
2. Review admin dashboard for status
3. Run integrity verification
4. Contact technical support with:
   - Error messages
   - Ledger entries involved
   - Expected vs actual behavior
   - Steps to reproduce
