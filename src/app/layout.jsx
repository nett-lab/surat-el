import { Plus_Jakarta_Sans } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import './globals.css';

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'e-Surat — Manajemen Surat Elektronik',
    template: '%s | e-Surat',
  },
  description: 'Sistem manajemen surat elektronik multi-instansi untuk surat masuk, disposisi, nota dinas, dan arsip.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning className={fontSans.variable}>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
