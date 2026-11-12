import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.houshyar.ai',
  appName: 'Houshyar AI',
  webDir: 'dist',
  android: {
    allowMixedContent: false
  }
};

export default config;
