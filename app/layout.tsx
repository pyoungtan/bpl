import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

const jbmono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
});

export const metadata: Metadata = {
  title: "Trailweight",
  description:
    "백패킹 장비를 정리하고 트립별로 챙긴 기록을 남기는 무게 관리 앱.",
  applicationName: "Trailweight",
  // Home-screen app tags written by hand: Next's appleWebApp always emits
  // apple-mobile-web-app-status-bar-style (falling back to "default"), which
  // pins a white status bar. Without that tag iOS tints the bar from
  // theme-color, kept in sync with the app's own light/dark choice.
  other: {
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Trailweight",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1e" },
  ],
};

const themeScript = `
(function() {
  try {
    var pref = 'system';
    var raw = localStorage.getItem('bpl-v5');
    if (raw) { var s = JSON.parse(raw).state; if (s && s.theme) pref = s.theme; }
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', dark ? '#1c1c1e' : '#ffffff');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${inter.variable} ${newsreader.variable} ${jbmono.variable}`}
    >
      <body className="min-h-dvh bg-bg font-sans text-label antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
