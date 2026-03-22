import type { Metadata } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import { AgentProvider } from '@/context/AgentContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { UserProfileProvider } from '@/context/UserProfileContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import './globals.css';

const THEME_STORAGE_KEY = 'paisatax-theme';

const themeInitScript = `
  (function() {
    try {
      var storedTheme = window.localStorage.getItem('${THEME_STORAGE_KEY}');
      var theme = storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (error) {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.style.colorScheme = 'light';
    }
  })();
`;

export const metadata: Metadata = {
  title: 'PaisaTax — AI Tax Filing',
  description: 'Chat-first federal tax filing with uploads, guided questions, and PDF export.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <AuthProvider>
            <UserProfileProvider>
              <AgentProvider>
                <ProtectedRoute>{children}</ProtectedRoute>
              </AgentProvider>
            </UserProfileProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
