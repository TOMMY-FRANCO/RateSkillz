# Cache Cleanup Memory Leak Fix

## Issue
The `MemoryCache` class in `src/lib/cache.ts` started a cleanup interval (`setInterval`) in the constructor that ran every 60 seconds to remove expired cache entries. However, this interval was never stopped, causing memory leaks in two scenarios:

1. **Development (Hot Module Reloading)**: When Vite hot-reloads modules during development, the old interval continues running even after the module is reloaded, creating multiple intervals
2. **Testing**: In test environments where modules are loaded/unloaded, intervals persist
3. **Browser Tab Close**: The interval would only stop when the JavaScript runtime is destroyed, but proper cleanup is better practice

## Root Cause
```typescript
// In constructor - starts interval
constructor() {
  this.cache = new Map();
  this.cleanupInterval = null;
  this.startCleanup(); // ← Starts interval but never stopped
}

private startCleanup(): void {
  this.cleanupInterval = setInterval(() => {
    // Cleanup expired entries
  }, 60000); // Runs every minute
}

stopCleanup(): void {
  if (this.cleanupInterval) {
    clearInterval(this.cleanupInterval);
    this.cleanupInterval = null;
  }
}
```

The `stopCleanup()` method existed but was never called anywhere.

## Solution
Added two cleanup mechanisms after the singleton instantiation:

### 1. Window Unload Cleanup (Production)
```typescript
// Cleanup interval when the application/window unloads
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    cache.stopCleanup();
  });
}
```
- Stops the interval when the browser tab/window closes
- Ensures proper cleanup in production
- Guards with `typeof window` check for server-side rendering compatibility

### 2. Hot Module Reloading Cleanup (Development)
```typescript
// Hot module reloading cleanup for development
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cache.stopCleanup();
  });
}
```
- Stops the interval when Vite hot-reloads the module
- Prevents multiple intervals from accumulating during development
- Only runs in development mode (Vite's HMR API)

## Benefits

### Before Fix
- ❌ Cleanup interval never stopped
- ❌ Memory leaks during hot module reloading
- ❌ Multiple intervals could run simultaneously
- ❌ Potential performance degradation over time

### After Fix
- ✅ Interval stops when tab/window closes
- ✅ Interval stops during hot module reloading
- ✅ Only one interval runs at a time
- ✅ Proper resource cleanup
- ✅ Better development experience

## Testing
The fix was verified by:
1. ✅ Build passes successfully
2. ✅ No TypeScript errors
3. ✅ Cache functionality unchanged
4. ✅ Proper cleanup in development (hot reload tested)
5. ✅ Proper cleanup in production (beforeunload tested)

## Technical Details

### Why This Pattern Works
1. **Singleton Pattern**: There's only one `MemoryCache` instance (`cache`) in the entire application
2. **Module-Level Cleanup**: The cleanup handlers are registered at module load time, right after the singleton is created
3. **Event-Driven**: Uses browser events (`beforeunload`) and Vite HMR API (`import.meta.hot.dispose`) to trigger cleanup
4. **Defensive**: Guards with existence checks (`typeof window`, `import.meta.hot`)

### Memory Leak Prevention
- **Without Fix**: Each hot reload creates a new interval but old intervals keep running → N intervals after N reloads
- **With Fix**: Each hot reload stops the old interval before creating a new one → Always 1 interval

### Performance Impact
- **Negligible**: The cleanup handlers add minimal overhead (two event listeners)
- **Benefit**: Prevents unbounded memory growth from accumulated intervals
- **Cache Performance**: Unchanged - caching behavior remains identical

## Related Files
- `src/lib/cache.ts` - Fixed file (lines 120-132)

## Future Considerations
If we add testing with Jest/Vitest, consider:
1. Adding explicit cleanup in test afterEach hooks
2. Providing a test utility to reset the cache singleton
3. Mocking the interval in tests to avoid timing issues

## Verification Commands
```bash
# Build the project
npm run build

# Check for memory leaks in dev mode
npm run dev
# Make changes to trigger hot reload
# Open browser dev tools > Memory > Take heap snapshot
# Verify only one cleanup interval exists
```
