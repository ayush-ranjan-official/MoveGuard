import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "MoveGuard | AI-Powered DeFi Security for Movement",
  description:
    "Real-time DeFi exploit prevention with AI-powered threat detection. Pay-per-block protection and instant bug bounty payouts on Movement blockchain.",
  keywords: [
    "DeFi security",
    "Movement blockchain",
    "exploit prevention",
    "AI threat detection",
    "bug bounty",
    "smart contract security",
  ],
  authors: [{ name: "MoveGuard Team" }],
  openGraph: {
    title: "MoveGuard | AI-Powered DeFi Security",
    description:
      "Real-time DeFi exploit prevention with AI-powered threat detection on Movement blockchain.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-background`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
