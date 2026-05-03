import { Space_Mono } from "next/font/google";
import "./globals.css";

const mono = Space_Mono({
  weight: ['400', '700'],
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata = {
  title: "EthCredit | Autonomous Bond & Credit Agents",
  description: "Next-generation credit scoring and bond automation powered by 0G Network and Uniswap.",
};

import Navbar from "@/components/Navbar";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={mono.variable}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
