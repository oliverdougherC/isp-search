import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { publicEnv } from '@/lib/public-env';

import './globals.css';

export const metadata: Metadata = {
  title: publicEnv().NEXT_PUBLIC_APP_NAME,
  description:
    'Address-level US internet provider discovery with explicit provenance. Foundation build; live search is not yet available.',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <p className="site-name">{publicEnv().NEXT_PUBLIC_APP_NAME}</p>
          <p className="site-env">environment: {publicEnv().NEXT_PUBLIC_APP_ENV}</p>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <p>
            Source:{' '}
            <a href="https://github.com/oliverdougherC/isp-search">
              github.com/oliverdougherC/isp-search
            </a>
            {' · '}Licensed under Apache-2.0.
          </p>
        </footer>
      </body>
    </html>
  );
}
