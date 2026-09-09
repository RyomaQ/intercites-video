import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const gliker = localFont({
  src: "../fonts/gliker-regular.ttf",
  variable: "--font-gliker",
});

export const metadata: Metadata = {
  title: "Intercité — Online Access",
  description: "Download the Intercité film with your activation code.",
  icons: {
    icon: "/favicon-intercites.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${gliker.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
