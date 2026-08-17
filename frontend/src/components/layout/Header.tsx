import { Bell, Search } from 'lucide-react';
import { useSocketStore } from '../../services/socket';
import { cn } from '../common/Button';

export function Header() {
  const connected = useSocketStore((state) => state.connected);

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl px-8 flex items-center justify-between shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-96 hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search commands, SKUs, locations..." 
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5">
            {connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
            <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", connected ? "bg-green-500" : "bg-red-500")}></span>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {connected ? 'Connected' : 'Offline'}
          </span>
        </div>
        
        <button className="relative text-slate-400 hover:text-slate-200 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500"></span>
        </button>
      </div>
    </header>
  );
}
