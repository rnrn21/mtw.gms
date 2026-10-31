import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mind Theory Works",
  description: "세션 사이의 성장을 이어가는 코칭 공간",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-app font-sans text-text-main">
        {children}
      </body>
    </html>
  );
}
