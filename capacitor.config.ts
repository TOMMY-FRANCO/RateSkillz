import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ratingskill.app',
  appName: 'RatingSkill',
  webDir: 'dist',
  server: {
    url: 'https://ratingskill.com',
    cleartext: false,
  },
  android: {
    backgroundColor: '#0f172a',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
