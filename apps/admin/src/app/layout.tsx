import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Opskl Admin',
  description: 'Operations, verification, and compliance console for Opskl',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
