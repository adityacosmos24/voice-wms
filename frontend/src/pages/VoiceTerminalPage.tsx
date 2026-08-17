import { useState } from 'react';
import { Mic, Square, Check, X, Loader2 } from 'lucide-react';
import { useVoice } from '../hooks/useVoice';
import { useSocketEvent } from '../hooks/useSocket';
import { Button } from '../components/common/Button';
import { cn } from '../components/common/Button';
import { commandService } from '../services/api';

const DEV_SESSION_ID = 'session-123';
const DEV_USER_ID = '3d387cc0-ea7d-4180-a611-e6e737158be8'; 

export function VoiceTerminalPage() {
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoice(DEV_SESSION_ID);
  const [confirmationRequest, setConfirmationRequest] = useState<any>(null);

  // Listen for confirmation requests
  useSocketEvent('confirmation:required', (data) => {
    setConfirmationRequest(data);
  });

  useSocketEvent('command:status_change', (data) => {
    if (data.status === 'executed' || data.status === 'rejected') {
      setConfirmationRequest(null);
    }
  });

  const handleConfirm = async () => {
    if (!confirmationRequest?.commandId) return;
    try {
      await commandService.confirm(confirmationRequest.commandId, DEV_USER_ID);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!confirmationRequest?.commandId) return;
    try {
      await commandService.reject(confirmationRequest.commandId, DEV_USER_ID, 'Operator cancelled');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Voice Terminal</h1>
        <p className="text-slate-400 text-sm">Push to talk interface for operators.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        
        {/* Main Mic Button */}
        <div className="relative group">
          {/* Animated rings when recording */}
          {isRecording && (
            <>
              <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-[-20px] rounded-full border border-amber-500/20 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
            </>
          )}

          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={cn(
              "relative w-48 h-48 rounded-full flex flex-col items-center justify-center gap-4 transition-all duration-300 shadow-2xl overflow-hidden",
              isRecording 
                ? "bg-amber-500 text-slate-900 scale-95" 
                : "bg-slate-800 text-amber-500 hover:bg-slate-700 hover:scale-105 border-4 border-slate-700 hover:border-amber-500/50"
            )}
          >
            {/* Background grain */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>

            {isProcessing ? (
              <Loader2 className="w-16 h-16 animate-spin" />
            ) : isRecording ? (
              <Square className="w-16 h-16 fill-current" />
            ) : (
              <Mic className="w-16 h-16" />
            )}
            
            <span className="font-semibold tracking-wide uppercase text-sm">
              {isProcessing ? 'Processing...' : isRecording ? 'Recording...' : 'Hold to Speak'}
            </span>
          </button>
        </div>

        {/* Confirmation Overlay */}
        {confirmationRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
              
              <div className="flex items-center gap-3 mb-6 text-amber-500">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Mic className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Confirmation Required</h3>
              </div>
              
              <p className="text-slate-300 mb-8 text-lg font-medium leading-relaxed bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                {confirmationRequest.prompt}
              </p>
              
              <div className="flex gap-4">
                <Button variant="secondary" className="flex-1 py-6 text-base" onClick={handleReject}>
                  <X className="w-5 h-5 mr-2" />
                  Cancel
                </Button>
                <Button variant="primary" className="flex-1 py-6 text-base shadow-lg shadow-amber-500/20" onClick={handleConfirm}>
                  <Check className="w-5 h-5 mr-2" />
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
