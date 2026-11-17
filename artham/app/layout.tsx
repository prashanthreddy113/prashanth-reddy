import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SITE } from "@/lib/config.ts";
import "./globals.css";

export const metadata: Metadata = {
  title: `${SITE.name} – Understand any document in your language`,
  description:
    "Take a photo of a hospital bill, rental agreement, loan letter or government notice and get a simple explanation in Telugu, Hindi, Tamil, English and more. See hidden charges, deadlines and what to do next.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: `${SITE.name} – Understand any document in your language`,
    description: "Simple explanations of confusing papers in Telugu, Hindi, Tamil and more. 2 documents free.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#14171c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="wrap header-row">
            <Link href="/" className="brand" aria-label={`${SITE.name} home`}>
              <Logo />
              <span>{SITE.name}</span>
            </Link>
            <nav className="nav" aria-label="Main">
              <Link href="/#how">How it works</Link>
              <Link href="/#pricing">Pricing</Link>
              <Link href="/contact">Contact</Link>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="wrap footer-grid">
            <div>
              <div className="brand brand-footer">
                <Logo />
                <span>{SITE.name}</span>
              </div>
              <p className="muted small">
                {SITE.name} explains documents in simple words. It is not legal, medical or financial advice. For
                important decisions, please talk to a qualified professional.
              </p>
            </div>
            <nav className="footer-links" aria-label="Legal">
              <Link href="/terms">Terms of use</Link>
              <Link href="/privacy">Privacy policy</Link>
              <Link href="/refunds">Refunds &amp; cancellation</Link>
              <Link href="/contact">Contact us</Link>
            </nav>
          </div>
          <div className="wrap small muted copyright">
            © {year} {SITE.businessName || SITE.name}. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="3" width="18" height="24" rx="3" fill="var(--brand)" />
      <path d="M9 10h10M9 14h10M9 18h6" stroke="var(--on-brand)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="23" cy="23" r="7" fill="var(--accent)" />
      <path d="M20 23.2l2 2 4-4.2" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
