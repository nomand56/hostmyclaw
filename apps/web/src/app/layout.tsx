import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HostMyClaw',
  description: 'Managed AI Assistants Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
