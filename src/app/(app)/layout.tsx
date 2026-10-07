import { DataProvider } from '@/lib/data';
import AppShell from '@/components/AppShell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <DataProvider><AppShell>{children}</AppShell></DataProvider>;
}
