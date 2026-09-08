import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sankalpacademy.student',
  appName: 'Sankalp Academy',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
