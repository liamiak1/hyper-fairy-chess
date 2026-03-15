import { useState, useCallback } from 'react';
import type { PlayerColor } from '@hyper-fairy-chess/shared';
import { Game } from './components/Game';
import { MainMenu } from './components/MainMenu';
import { OnlineGame } from './components/OnlineGame';
import { ProfilePage } from './components/ProfilePage';
import { ResetPasswordForm } from './components/ResetPasswordForm';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider } from './context/AuthContext';
import './App.css';

type GameMode = 'menu' | 'local' | 'ai' | 'online' | 'profile';

function getResetToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('reset_token');
}

function clearResetToken() {
  const url = new URL(window.location.href);
  url.searchParams.delete('reset_token');
  window.history.replaceState({}, '', url.toString());
}

function AppContent() {
  const [mode, setMode] = useState<GameMode>('menu');
  const [aiColor, setAiColor] = useState<PlayerColor>('black');
  const [resetToken, setResetToken] = useState<string | null>(() => getResetToken());

  const handleAIPlay = useCallback(() => {
    setAiColor(Math.random() < 0.5 ? 'black' : 'white');
    setMode('ai');
  }, []);

  if (resetToken) {
    return (
      <div className="app">
        <ResetPasswordForm
          token={resetToken}
          onDone={() => {
            clearResetToken();
            setResetToken(null);
          }}
        />
      </div>
    );
  }

  if (mode === 'menu') {
    return (
      <div className="app">
        <MainMenu
          onLocalPlay={() => setMode('local')}
          onAIPlay={handleAIPlay}
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

  if (mode === 'ai') {
    return (
      <div className="app">
        <Game aiColor={aiColor} />
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
