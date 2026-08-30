import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'capy control plane',
    template: '%s · capy',
  },
  description: 'turn robot failures into inspectable evidence, evaluated capabilities, and memo-less USDC settlement.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
