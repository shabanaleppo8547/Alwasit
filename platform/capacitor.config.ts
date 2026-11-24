import type { CapacitorConfig } from '@capacitor/cli';

// التطبيق يفتح المنصة المنشورة مباشرة (نفس الخادم ونفس الحسابات والصلاحيات).
// رابط المنصة يُمرَّر عند البناء: APP_URL=https://… npx cap sync android
const appUrl = process.env.APP_URL ?? 'https://example.invalid';

const config: CapacitorConfig = {
  appId: 'com.alwasit.platform',
  appName: 'مركز الوسيط',
  webDir: 'mobile/www',
  server: {
    url: appUrl,
    cleartext: false,
    errorPath: 'index.html',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
