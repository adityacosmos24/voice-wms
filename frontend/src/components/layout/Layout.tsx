import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Layout({ children, currentPath, onNavigate }: { children: ReactNode; currentPath: string; onNavigate: (path: string) => void }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar currentPath={currentPath} onNavigate={onNavigate} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-auto bg-slate-900/30 relative">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
          {children}
        </main>
      </div>
    </div>
  );
}
