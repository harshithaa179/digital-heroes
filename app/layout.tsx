import type { Metadata } from "next";
import { Space_Grotesk, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import QuickNav from "@/components/QuickNav";

const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Digital Heroes",
  description: "Play. Win. Give. Every score supports a cause you love.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${space.variable} ${instrument.variable} ${mono.variable}`}>
      <body>
        {children}
        <QuickNav />
      </body>
    </html>
  );
}