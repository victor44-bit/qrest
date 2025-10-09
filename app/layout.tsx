export const dynamic = "force-dynamic";
// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Qrest",
  description: "Collaborative idea chains",
};

const ThemeInit = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `
(function () {
  var KEY = 'qrest_theme'; // 'light' | 'dark' | 'system'
  var html = document.documentElement;

  function apply(theme) {
    var t = theme;
    if (!t || t === 'system') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    html.classList.toggle('dark', t === 'dark');
  }

  try {
    var stored = localStorage.getItem(KEY);
    apply(stored);

    var mql = window.matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener?.('change', function () {
      if ((localStorage.getItem(KEY) || 'system') === 'system') apply('system');
    });

    window.addEventListener('storage', function (e) {
      if (e.key === KEY) apply(e.newValue);
    });
  } catch (e) {}
})();
`,
    }}
  />
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        {/* Favicons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <ThemeInit />
      </head>
      <body className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-dark-bg dark:text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
