# Progressive Web App (PWA) Setup

Your RatingSkill application is now configured as a **Progressive Web App** with full offline support and native app-like experience!

## Features Enabled

### 1. Standalone Display Mode
- **Full-screen launch**: No browser chrome (address bar, search bar, back button)
- **Native app experience**: Launches like a native app when added to home screen
- **Immersive interface**: Maximum screen real estate for your content

### 2. Offline Support
- **Service Worker**: Automatically caches assets for offline access
- **Smart Caching**: Uses Workbox for intelligent caching strategies
  - Static assets (JS, CSS, HTML): Cached automatically
  - Images: Cache-first strategy with 30-day expiration
  - API calls: Network-first with 5-minute cache fallback
  - Google Fonts: Cached for 1 year

### 3. App Icons
- **Multiple sizes**: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
- **Maskable icons**: Optimized for Android adaptive icons
- **iOS support**: Apple touch icons configured

### 4. Install Prompt
- **Smart timing**: Shows after 3 seconds on first visit
- **Dismissible**: Users can dismiss and be reminded after 7 days
- **User-friendly**: Beautiful UI with clear call-to-action

## Files Created/Modified

### New Files
- `/public/manifest.json` - PWA manifest with app metadata
- `/public/icon.svg` - Vector icon source
- `/public/icon-*.png` - Generated app icons (8 sizes)
- `/src/components/PWAInstallPrompt.tsx` - Install prompt component
- `PWA_SETUP.md` - This documentation

### Modified Files
- `/vite.config.ts` - Added vite-plugin-pwa configuration
- `/index.html` - Added manifest link and iOS meta tags
- `/src/App.tsx` - Added PWAInstallPrompt component
- `/src/index.css` - Added slide-up animation
- `/package.json` - Added vite-plugin-pwa dependency

## How to Test

### Desktop (Chrome/Edge)
1. Run `npm run dev` or deploy to production
2. Open DevTools → Application → Manifest (verify manifest loads)
3. Click "Install" button in address bar
4. App will open in standalone window

### Mobile (Android)
1. Open app in Chrome
2. Wait for install prompt or tap "Add to Home Screen" in menu
3. Confirm installation
4. App icon appears on home screen
5. Tap to launch in full-screen mode

### Mobile (iOS/Safari)
1. Open app in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. Confirm installation
5. App icon appears on home screen
6. Tap to launch in standalone mode

## Testing Offline Support

1. Open app in browser
2. Navigate to several pages
3. Open DevTools → Application → Service Workers
4. Check "Offline" checkbox
5. Refresh page - cached content still works!
6. Navigate between pages - previously visited pages load

## Customization

### Update App Icons
Replace `/public/icon-*.png` files with your custom icons. Maintain the same sizes:
```bash
# Example using ImageMagick
convert your-icon.png -resize 192x192 icon-192x192.png
convert your-icon.png -resize 512x512 icon-512x512.png
# ... repeat for all sizes
```

### Modify App Name/Colors
Edit `/vite.config.ts` and `/public/manifest.json`:
- `name` - Full app name
- `short_name` - Short name (12 chars max)
- `theme_color` - Browser theme color
- `background_color` - Splash screen background

### Adjust Cache Strategy
Edit `/vite.config.ts` workbox configuration:
- `runtimeCaching` - Add/modify cache strategies
- `globPatterns` - Change which files to precache
- `maximumFileSizeToCacheInBytes` - Adjust size limit

## Production Deployment

The PWA is automatically built with `npm run build`. Generated files in `/dist`:
- `sw.js` - Service worker
- `manifest.webmanifest` - Manifest file
- `registerSW.js` - Registration script
- All icon files

**Important**: Serve over HTTPS for service workers to work!

## Browser Support

- ✅ Chrome/Edge (Android & Desktop) - Full support
- ✅ Safari (iOS) - Full support with meta tags
- ✅ Firefox - Full support
- ✅ Samsung Internet - Full support
- ⚠️ Opera - Partial support

## Additional Features

### Shortcuts
Quick actions configured in manifest:
- Dashboard
- Friends
- Leaderboard

Users can long-press app icon to access these shortcuts.

### Orientation Lock
App is locked to portrait orientation for optimal mobile experience.

### Viewport Coverage
Uses `viewport-fit=cover` for safe area support on devices with notches.

## Troubleshooting

### Install prompt doesn't show
- Clear browser cache and service worker
- Wait 3 seconds after page load
- Check DevTools console for errors
- Ensure served over HTTPS (or localhost)

### Service worker not updating
- Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
- Clear site data in DevTools → Application
- Update version in manifest or vite config

### Icons not displaying
- Verify icon files exist in `/public` directory
- Check console for 404 errors
- Ensure icon paths in manifest are correct

## Next Steps

1. **Test thoroughly** on various devices and browsers
2. **Customize icons** with your branding
3. **Monitor performance** using Lighthouse PWA audit
4. **Add splash screens** for iOS (optional)
5. **Implement push notifications** (optional)

## Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Manifest Generator](https://www.simicart.com/manifest-generator.html/)

---

Your app is now a fully-featured PWA ready for production deployment!
