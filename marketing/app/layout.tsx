import type { Metadata } from "next";
import { Lora, Jost, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Refyne - Your HubSpot data. Finally clean.",
  description: "Refyne normalizes formats, removes duplicates, and fixes data quality issues automatically - so your team always works from a single source of truth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${lora.variable} ${jost.variable} ${jetbrainsMono.variable}`}>
      <body className="font-jost bg-bg text-text antialiased">
        {children}
      </body>
    </html>
  );
}
