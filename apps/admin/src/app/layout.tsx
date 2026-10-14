import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Opskl Admin Portal — Marketplace Governance',
  description: 'Operations, Escrow, and Verification Command Center for Opskl India',
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
