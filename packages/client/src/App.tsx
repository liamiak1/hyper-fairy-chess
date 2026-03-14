import { useState } from 'react';
import { Game } from './components/Game';
import { MainMenu } from './components/MainMenu';
import { OnlineGame } from './components/OnlineGame';
import { ProfilePage } from './components/ProfilePage';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider } from './context/AuthContext';
import './App.css';

type GameMode = 'menu' | 'local' | 'online' | 'profile';

function AppContent() {
  const [mode, setMode] = useState<GameMode>('menu');

  if (mode === 'menu') {
    return (
      <div className="app">
        <MainMenu
          onLocalPlay={() => setMode('local')}
          onOnlinePlay={() => setMode('online')}
          onProfile={() => setMode('profile')}
        />
      </div>
    );
  }

  if (mode === 'local') {
    return (
      <div className="app">
        <Game />
      </div>
    );
  }

  if (mode === 'profile') {
    return (
      <div className="app">
        <ProfilePage onBack={() => setMode('menu')} />
      </div>
    );
  }

  // Online mode - wrap in SocketProvider
  return (
    <div className="app">
      <SocketProvider>
        <OnlineGame onBack={() => setMode('menu')} />
      </SocketProvider>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
