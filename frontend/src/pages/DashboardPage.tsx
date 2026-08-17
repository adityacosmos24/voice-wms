import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Filter, RotateCcw } from 'lucide-react';
import { commandService } from '../services/api';
import { useSocketEvent } from '../hooks/useSocket';
import type { Command } from '../types';
import { CommandStatus } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';

export function DashboardPage() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    const fetchCommands = async () => {
      try {
        const data = await commandService.getFeed();
        setCommands(data.items || []);
      } catch (err) {
        console.error('Failed to fetch feed', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCommands();
  }, []);

  // Listen for new commands from socket
  useSocketEvent('command:new', (newCommand: Command) => {
    setCommands((prev) => [newCommand, ...prev]);
  });

  // Listen for status changes
  useSocketEvent('command:status_change', ({ commandId, status }: { commandId: string, status: CommandStatus }) => {
    setCommands((prev) => 
      prev.map((cmd) => cmd.id === commandId ? { ...cmd, status } : cmd)
    );
  });

  const handleRevert = async (actionId: string) => {
    try {
      // In a real app, we'd get this from auth context. Using dummy admin.
      const userId = '3d387cc0-ea7d-4180-a611-e6e737158be8';
      await commandService.revertAction(actionId, userId);
    } catch (err) {
      alert('Failed to revert: ' + (err as any)?.response?.data?.message || String(err));
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Command Feed</h1>
          <p className="text-slate-400 text-sm">Real-time audit log of all warehouse operations.</p>
        </div>
        
        <Button variant="secondary" className="gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase font-medium border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Transcript / Intent</th>
                <th className="px-6 py-4">Confidence</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {commands.map((cmd) => (
                <tr key={cmd.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                    {format(new Date(cmd.createdAt), 'HH:mm:ss')}
                    <div className="text-xs text-slate-500 mt-0.5">{format(new Date(cmd.createdAt), 'MMM d')}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-200 mb-1 line-clamp-1" title={cmd.transcript || 'N/A'}>
                      "{cmd.transcript || 'Unknown'}"
                    </div>
                    {cmd.parsedIntent && (
                      <div className="text-xs text-amber-500/80 font-mono">
                        {cmd.parsedIntent.intent}({Object.entries(cmd.parsedIntent.entities || {}).map(([k,v]) => `${k}:${v}`).join(', ')})
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {cmd.sttConfidence !== undefined ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${cmd.sttConfidence > 0.85 ? 'bg-green-500' : 'bg-amber-500'}`} 
                            style={{ width: `${cmd.sttConfidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{(cmd.sttConfidence * 100).toFixed(0)}%</span>
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={cmd.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-slate-500 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={cmd.status !== CommandStatus.EXECUTED}
                      onClick={() => handleRevert(cmd.id)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Revert
                    </Button>
                  </td>
                </tr>
              ))}
              
              {commands.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No commands found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
