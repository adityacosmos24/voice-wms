import axios from 'axios';

// Development API URL (NestJS default)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const commandService = {
  getFeed: async (params?: Record<string, any>) => {
    const response = await api.get('/commands', { params });
    return response.data;
  },
  
  getDetail: async (id: string) => {
    const response = await api.get(`/commands/${id}`);
    return response.data;
  },
  
  submitText: async (sessionId: string, text: string) => {
    const response = await api.post('/commands/text', { sessionId, text });
    return response.data;
  },
  
  submitVoice: async (sessionId: string, audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    formData.append('sessionId', sessionId);
    
    const response = await api.post('/commands/voice', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  confirm: async (id: string, userId: string) => {
    const response = await api.post(`/commands/${id}/confirm`, { userId });
    return response.data;
  },
  
  reject: async (id: string, userId: string, reason?: string) => {
    const response = await api.post(`/commands/${id}/reject`, { userId, reason });
    return response.data;
  },
  
  revertAction: async (actionId: string, userId: string) => {
    const response = await api.post(`/actions/${actionId}/revert`, { userId });
    return response.data;
  },
};
