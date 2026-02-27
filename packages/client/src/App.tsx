import { useState } from 'react';
import { Game } from './components/Game';
import { MainMenu } from './components/MainMenu';
import { OnlineGame } from './components/OnlineGame';
import { SocketProvider } from './context/SocketContext';
import './App.css';

type GameMode = 'menu' | 'local' | 'online';

function App() {
  const [mode, setMode] = useState<GameMode>('menu');

  if (mode === 'menu') {
    return (
      <div className="app">
        <MainMenu
          onLocalPlay={() => setMode('local')}
          onOnlinePlay={() => setMode('online')}
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

  // Online mode - wrap in SocketProvider
  return (
    <div className="app">
      <SocketProvider>
        <OnlineGame onBack={() => setMode('menu')} />
      </SocketProvider>
    </div>
  );
}

export default App;
