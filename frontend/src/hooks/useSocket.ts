import { useEffect } from 'react';
import { useSocketStore } from '../services/socket';

export function useSocketEvent(event: string, callback: (data: any) => void) {
  const socket = useSocketStore((state) => state.socket);

  useEffect(() => {
    if (!socket) return;

    socket.on(event, callback);

    return () => {
      socket.off(event, callback);
    };
  }, [socket, event, callback]);
}
