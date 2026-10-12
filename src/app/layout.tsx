import type { Metadata, Viewport } from "next";
import { Host_Grotesk, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "@/components/toast";
import "./globals.css";

const grotesk = Host_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Trace: every requirement, traced", template: "%s | Trace" },
  description:
    "The workspace for student software teams. Stories, tasks, commits, decisions and the people behind them, tied into one thread.",
  applicationName: "Trace",
  openGraph: {
    title: "Trace: every requirement, traced",
    description: "Who did what, why it was decided, and what's left. For student software teams and their mentors.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eeebe4" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0a" },
  ],
  viewportFit: "cover",
};

// Runs before paint so a saved theme never flashes the other one.
const themeScript = `try{var t=localStorage.getItem("trace-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${grotesk.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
