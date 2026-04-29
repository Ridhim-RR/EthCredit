import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: 'swap',
});

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
});

export const metadata = {
  title: "EthCredit | Autonomous Bond & Credit Agents",
  description: "Next-generation credit scoring and bond automation powered by 0G Network and Uniswap.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        <nav>
          <div className="logo">
            <span style={{ fontSize: '1.8rem' }}>⚡</span> EthCredit
          </div>
          <div className="nav-links">
            <a href="/">Dashboard</a>
            <a href="/agents">Agents</a>
            <a href="/swap">Swap</a>
            <a href="/vault">Vault</a>
          </div>
          <button className="btn-primary">Connect Wallet</button>
        </nav>
        {children}
      </body>
    </html>
  );
}
