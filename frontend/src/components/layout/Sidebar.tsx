import { Mic, LayoutDashboard, Settings } from 'lucide-react';
import { cn } from '../common/Button';

export function Sidebar({ currentPath, onNavigate }: { currentPath: string; onNavigate: (path: string) => void }) {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Voice Terminal', path: '/terminal', icon: Mic },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl flex flex-col h-screen shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 text-amber-500">
          <Mic className="h-6 w-6" />
          <span className="font-bold text-lg tracking-tight text-white">Voice WMS</span>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;
          
          return (
            <button
              key={item.name}
              onClick={() => onNavigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive 
                  ? 'bg-amber-500/10 text-amber-500 shadow-sm ring-1 ring-amber-500/20' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive ? 'text-amber-500' : 'text-slate-500')} />
              {item.name}
            </button>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50 ring-1 ring-white/5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white font-bold text-sm">
            RK
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-medium text-slate-200">Rajesh Kumar</span>
            <span className="text-xs text-slate-500">Admin • Metro DC</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
