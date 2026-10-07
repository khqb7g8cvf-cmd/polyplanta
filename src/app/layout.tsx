import type { Metadata, Viewport } from 'next';
import { Montserrat, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const disp = Montserrat({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-disp', display: 'swap' });
const body = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = { title: 'Polyamsa · Control de planta', description: 'Reporte de turno, operadores, paros, mantenimiento e inventario de resina.' };
export const viewport: Viewport = { themeColor: '#032251', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${disp.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
