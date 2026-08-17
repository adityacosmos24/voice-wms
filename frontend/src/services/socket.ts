import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

interface SocketStore {
  socket: Socket | null;
  connected: boolean;
  connect: (userId: string) => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketStore>((set, get) => ({
  socket: null,
  connected: false,
  
  connect: (userId: string) => {
    if (get().socket) return;
    
    const newSocket = io(SOCKET_URL, {
      query: { userId },
      transports: ['websocket'],
    });
    
    newSocket.on('connect', () => set({ connected: true }));
    newSocket.on('disconnect', () => set({ connected: false }));
    
    set({ socket: newSocket });
  },
  
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },
}));
