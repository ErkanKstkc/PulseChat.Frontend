import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'PulseChat | Gerçek Zamanlı Mesajlaşma Platformu',
  description: 'Yüksek eşzamanlı, düşük gecikmeli kurumsal mesajlaşma sistemi.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="h-full dark">
      <body className="h-full bg-[#090c11] text-gray-100 flex flex-col antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
