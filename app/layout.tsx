import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scratch & Claim",
  description: "Complete missions, scratch a card, and request a manual withdrawal after KYC review."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=Syne:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans text-white antialiased">{children}</body>
    </html>
  );
}
