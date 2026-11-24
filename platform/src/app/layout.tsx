import type { Metadata, Viewport } from 'next';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'مركز الوسيط – منصة المحاضرات الجامعية', template: '%s | مركز الوسيط' },
  description: 'محاضرات فيديو منظمة لطلاب الرياضيات حسب السنة والقسم والمادة، مع أساتذة مركز الوسيط.',
  applicationName: 'مركز الوسيط',
};

export const viewport: Viewport = {
  themeColor: '#0b6b57',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
