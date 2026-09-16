import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./admin.css";

// Admin typography is inherited from the canonical dashboard-template
// contract (Inter), not from the public client's Plus Jakarta Sans/Rajdhani
// tokens - see DESIGN.md "Admin typography değerleri dashboard-template
// sözleşmesinden miras alınır."
const inter = Inter({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-admin-inter" });

export const metadata: Metadata = { title: "Starter Kurumsal Admin" };

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
