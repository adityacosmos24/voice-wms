import { CommandStatus, EventType } from '../../types';
import { cn } from './Button';

export function StatusBadge({ status, className }: { status: CommandStatus | EventType | string; className?: string }) {
  const getStatusColor = () => {
    switch (status) {
      case CommandStatus.EXECUTED:
      case EventType.EXECUTED:
      case EventType.AUTO_APPROVED:
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      
      case CommandStatus.REJECTED:
      case EventType.REJECTED:
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      
      case CommandStatus.PENDING_CONFIRMATION:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      
      case CommandStatus.REVERTED:
      case EventType.REVERTED:
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getLabel = () => {
    return status.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider',
        getStatusColor(),
        className
      )}
    >
      {getLabel()}
    </span>
  );
}
