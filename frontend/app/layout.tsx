import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Spectral } from "next/font/google";

import { SwCleanup } from "@/components/sw-cleanup";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./globals.css";

const heading = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"]
});

const body = Spectral({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "WriterLoop AI",
  description: "Upload any document and get intelligent feedback loops to improve your writing.",
  applicationName: "WriterLoop AI"
};

export const viewport: Viewport = {
  themeColor: "#157a6e"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body className="font-[var(--font-body)]">
        <SwCleanup />
        {children}
      </body>
    </html>
  );
}
