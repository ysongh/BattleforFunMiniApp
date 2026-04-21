import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import LocationPicker from '../components/LocationPicker';

interface GameSettings {
  startingFunds: number;
  fogOfWar: boolean;
  turnTimeLimit: number; // In seconds, 0 means no limit
  mapSize: 10 | 20 | 30;
}

type AIDifficulty = 'easy' | 'medium' | 'hard';

const Lobby = ({ }) => {
  const navigate = useNavigate();

  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');

  const [gameSettings, setGameSettings] = useState<GameSettings>({
    startingFunds: 10000,
    fogOfWar: false,
    turnTimeLimit: 0,
    mapSize: 10,
  });

  const [chatMessages, setChatMessages] = useState<{sender: string, text: string}[]>([
    { sender: "System", text: "Welcome! Pick a battle location and difficulty, then hit Start Game." },
  ]);

  const [chatInput, setChatInput] = useState("");
  // Battle location — click the map or pick a preset. Defaults to Central Park, NYC.
  const [battleLocation, setBattleLocation] = useState<[number, number]>([-73.9712, 40.7831]);

  const handleSettingChange = (setting: keyof GameSettings, value: any) => {
    setGameSettings({ ...gameSettings, [setting]: value });
  };

  const addChatMessage = (sender: string, text: string) => {
    setChatMessages([...chatMessages, { sender, text }]);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      addChatMessage("Player 1", chatInput.trim());
      setChatInput("");
    }
  };

  const handleStartGame = () => {
    navigate('/game', {
      state: {
        isAIEnabled: true,
        aiDifficulty,
        battleLocation,
        mapSize: gameSettings.mapSize,
      },
    });
  };

  return (
    <div className="bg-gray-100 min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6">Game Lobby</h1>

        <Link to="/game2">
          Game 2
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Opponent */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-4">Opponent</h2>

            <p className="text-sm text-gray-600 mb-3">
              You play as <span className="font-semibold text-red-600">Red</span> against an AI opponent (<span className="font-semibold text-blue-600">Blue</span>).
            </p>

            <label className="block text-gray-700 mb-2">AI Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as const).map(level => (
                <button
                  key={level}
                  className={`px-3 py-2 text-sm rounded capitalize ${aiDifficulty === level ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                  onClick={() => setAiDifficulty(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Middle column - Game Settings */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-4">Game Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-1">Map Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {([10, 20, 30] as const).map(size => (
                    <button
                      key={size}
                      className={`px-3 py-2 text-sm rounded ${gameSettings.mapSize === size ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                      onClick={() => handleSettingChange('mapSize', size)}
                    >
                      {size}×{size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Starting Funds</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={gameSettings.startingFunds}
                  onChange={(e) => handleSettingChange('startingFunds', parseInt(e.target.value))}
                >
                  <option value={5000}>5,000 (Low)</option>
                  <option value={10000}>10,000 (Standard)</option>
                  <option value={20000}>20,000 (High)</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="fogOfWar"
                  checked={gameSettings.fogOfWar}
                  onChange={(e) => handleSettingChange('fogOfWar', e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="fogOfWar">Fog of War</label>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Turn Time Limit</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={gameSettings.turnTimeLimit}
                  onChange={(e) => handleSettingChange('turnTimeLimit', parseInt(e.target.value))}
                >
                  <option value={0}>No Limit</option>
                  <option value={60}>60 seconds</option>
                  <option value={120}>2 minutes</option>
                  <option value={300}>5 minutes</option>
                </select>
              </div>

              <button
                className="bg-green-600 text-white px-4 py-2 rounded w-full mt-6"
                onClick={handleStartGame}
              >
                Start Game
              </button>
            </div>
          </div>

          {/* Right column - Battle Location & Chat */}
          <div className="space-y-6">
            {/* Battle Location */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4">Battle Location</h2>
              <LocationPicker value={battleLocation} onChange={setBattleLocation} />
            </div>

            {/* Chat */}
            <div className="bg-white rounded-lg shadow p-4 flex flex-col h-64">
              <h2 className="text-xl font-semibold mb-2">Chat</h2>

              <div className="flex-1 overflow-y-auto mb-3 space-y-2">
                {chatMessages.map((msg, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-semibold">{msg.sender}: </span>
                    <span>{msg.text}</span>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendChat} className="flex">
                <input
                  type="text"
                  className="flex-1 border rounded-l px-3 py-2"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded-r"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
