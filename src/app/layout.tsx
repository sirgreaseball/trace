import type { Metadata, Viewport } from "next";
import { Onest, Reddit_Mono } from "next/font/google";
import { Island } from "@/components/island";
import "./globals.css";

const sans = Onest({ variable: "--font-onest", subsets: ["latin", "latin-ext"] });
const mono = Reddit_Mono({ variable: "--font-reddit-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Trace: every requirement, traced", template: "%s · Trace" },
  description:
    "The workspace for student software teams. Stories, tasks, commits and decisions, traced to the people who did the work.",
  applicationName: "Trace",
  openGraph: {
    title: "Trace: every requirement, traced",
    description: "Who built it, why it was decided, and what's left. For student software teams and their mentors.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f5" },
    { media: "(prefers-color-scheme: dark)", color: "#08080c" },
  ],
  viewportFit: "cover",
};

// Runs before paint so a saved theme never flashes the other one.
const themeScript = `try{var t=localStorage.getItem("trace-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Island />
      </body>
    </html>
  );
}
