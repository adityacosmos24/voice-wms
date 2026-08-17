import { useState, useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { VoiceTerminalPage } from './pages/VoiceTerminalPage';
import { useSocketStore } from './services/socket';

// Hardcoded dev user (Rajesh Kumar - Admin)
const DEV_USER_ID = '3d387cc0-ea7d-4180-a611-e6e737158be8'; 

function App() {
  const [currentPath, setCurrentPath] = useState('/');
  const connectSocket = useSocketStore((state) => state.connect);
  const disconnectSocket = useSocketStore((state) => state.disconnect);

  useEffect(() => {
    // In a real app, this happens after login
    connectSocket(DEV_USER_ID);
    return () => disconnectSocket();
  }, [connectSocket, disconnectSocket]);

  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <DashboardPage />;
      case '/terminal':
        return <VoiceTerminalPage />;
      case '/settings':
        return (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-slate-500 flex flex-col items-center gap-4">
              <span className="text-4xl">⚙️</span>
              <p>Settings coming in v2</p>
            </div>
          </div>
        );
      default:
        return <DashboardPage />;
    }
  };

  return (
    <Layout currentPath={currentPath} onNavigate={setCurrentPath}>
      {renderPage()}
    </Layout>
  );
}

export default App;
