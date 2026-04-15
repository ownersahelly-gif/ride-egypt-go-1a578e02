import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.massar.app',
  appName: 'Massar',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    appendedInfoPlist: `
      <key>NSCameraUsageDescription</key>
      <string>Massar needs access to your camera to take a profile photo.</string>
      <key>NSPhotoLibraryUsageDescription</key>
      <string>Massar needs access to your photo library to choose a profile photo.</string>
      <key>NSLocationWhenInUseUsageDescription</key>
      <string>Massar needs your location to show nearby pickup points and track your shuttle in real time.</string>
      <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
      <string>Massar needs your location in the background to share live location with passengers during active rides.</string>
      <key>NSMicrophoneUsageDescription</key>
      <string>Massar needs microphone access for voice calls with your driver or passengers.</string>
      <key>FirebaseAppDelegateProxyEnabled</key>
      <false/>
    `,
  },
};

export default config;
