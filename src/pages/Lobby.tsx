import { useState } from 'react';

// Types
interface Player {
  id: string;
  name: string;
  faction: 'Red' | 'Blue' | 'Yellow' | 'Green' | null;
  ready: boolean;
}

interface MapTemplate {
  id: string;
  name: string;
  size: string;
  terrain: string;
  description: string;
  thumbnail: string;
}

interface GameSettings {
  startingFunds: number;
  fogOfWar: boolean;
  turnTimeLimit: number; // In seconds, 0 means no limit
  mapId: string;
}

const Lobby = ({ }) => {
  // Sample map templates
  const mapTemplates: MapTemplate[] = [
    {
      id: "map1",
      name: "Green Plains",
      size: "10×10",
      terrain: "Balanced",
      description: "A beginner-friendly map with open plains and minimal obstacles.",
      thumbnail: "/api/placeholder/120/80"
    },
    {
      id: "map2",
      name: "Mountain Pass",
      size: "12×12",
      terrain: "Mountainous",
      description: "Mountains divide the map, creating choke points for strategic battles.",
      thumbnail: "/api/placeholder/120/80"
    },
    {
      id: "map3",
      name: "Archipelago",
      size: "15×15",
      terrain: "Islands",
      description: "Several islands connected by bridges. Naval units excel here.",
      thumbnail: "/api/placeholder/120/80"
    },
    {
      id: "map4",
      name: "Urban Warfare",
      size: "10×10",
      terrain: "City",
      description: "City blocks provide cover and strategic capture points.",
      thumbnail: "/api/placeholder/120/80"
    }
  ];

  // Game state
  const [players, setPlayers] = useState<Player[]>([
    { id: "p1", name: "Player 1", faction: null, ready: false },
    { id: "p2", name: "Player 2", faction: null, ready: false },
  ]);
  
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    startingFunds: 10000,
    fogOfWar: false,
    turnTimeLimit: 0,
    mapId: mapTemplates[0].id
  });
  
  const [chatMessages, setChatMessages] = useState<{sender: string, text: string}[]>([
    { sender: "System", text: "Welcome to the game lobby! Select your faction and map to begin." },
  ]);
  
  const [chatInput, setChatInput] = useState("");
  const [selectedMap, setSelectedMap] = useState<string>(mapTemplates[0].id);
  const [isHost, setIsHost] = useState(true); // First player is host by default

  // Actions
  const handleNameChange = (playerId: string, name: string) => {
    setPlayers(players.map(p => p.id === playerId ? { ...p, name } : p));
  };

  const handleFactionChange = (playerId: string, faction: 'Red' | 'Blue' | 'Yellow' | 'Green' | null) => {
    // Check if faction is already taken
    const isFactionTaken = players.some(p => p.id !== playerId && p.faction === faction);
    
    if (isFactionTaken) {
      addChatMessage("System", "This faction is already taken!");
      return;
    }
    
    setPlayers(players.map(p => p.id === playerId ? { ...p, faction } : p));
  };

  const handleReadyToggle = (playerId: string) => {
    setPlayers(players.map(p => p.id === playerId ? { ...p, ready: !p.ready } : p));
  };

  const handleMapChange = (mapId: string) => {
    setSelectedMap(mapId);
    setGameSettings({ ...gameSettings, mapId });
  };

  const handleSettingChange = (setting: keyof GameSettings, value: any) => {
    setGameSettings({ ...gameSettings, [setting]: value });
  };

  const addChatMessage = (sender: string, text: string) => {
    setChatMessages([...chatMessages, { sender, text }]);
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      addChatMessage("Player 1", chatInput.trim());
      setChatInput("");
    }
  };

  const handleStartGame = () => {
    // Check if all players are ready and have selected factions
    const allPlayersReady = players.every(p => p.ready && p.faction);
    
    if (!allPlayersReady) {
      addChatMessage("System", "All players must be ready and have selected a faction!");
      return;
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6">Game Lobby</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Players */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-4">Players</h2>
            
            <div className="space-y-4">
              {players.map(player => (
                <div key={player.id} className="border rounded-lg p-3">
                  <div className="flex justify-between mb-2">
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => handleNameChange(player.id, e.target.value)}
                      className="border rounded px-2 py-1 w-full mr-2"
                      placeholder="Enter name..."
                    />
                    <button
                      className={`px-3 py-1 rounded ${player.ready ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
                      onClick={() => handleReadyToggle(player.id)}
                    >
                      {player.ready ? 'Ready' : 'Not Ready'}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    {(['Red', 'Blue', 'Yellow', 'Green'] as const).map(faction => (
                      <button
                        key={faction}
                        className={`h-10 rounded-md ${player.faction === faction ? 'ring-2 ring-black' : ''}`}
                        style={{ backgroundColor: faction.toLowerCase() }}
                        onClick={() => handleFactionChange(player.id, faction)}
                        aria-label={`Select ${faction} faction`}
                      />
                    ))}
                  </div>
                </div>
              ))}
              
              <button className="bg-blue-500 text-white px-4 py-2 rounded w-full">
                Add AI Player
              </button>
            </div>
          </div>
          
          {/* Middle column - Game Settings */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-4">Game Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-1">Starting Funds</label>
                <select 
                  className="w-full border rounded px-3 py-2"
                  value={gameSettings.startingFunds}
                  onChange={(e) => handleSettingChange('startingFunds', parseInt(e.target.value))}
                  disabled={!isHost}
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
                  disabled={!isHost}
                />
                <label htmlFor="fogOfWar">Fog of War</label>
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Turn Time Limit</label>
                <select 
                  className="w-full border rounded px-3 py-2"
                  value={gameSettings.turnTimeLimit}
                  onChange={(e) => handleSettingChange('turnTimeLimit', parseInt(e.target.value))}
                  disabled={!isHost}
                >
                  <option value={0}>No Limit</option>
                  <option value={60}>60 seconds</option>
                  <option value={120}>2 minutes</option>
                  <option value={300}>5 minutes</option>
                </select>
              </div>
              
              {isHost && (
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded w-full mt-6"
                  onClick={handleStartGame}
                >
                  Start Game
                </button>
              )}
            </div>
          </div>
          
          {/* Right column - Map Selection & Chat */}
          <div className="space-y-6">
            {/* Map Selection */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4">Map Selection</h2>
              
              <div className="grid grid-cols-2 gap-3">
                {mapTemplates.map(map => (
                  <div
                    key={map.id}
                    className={`border rounded cursor-pointer p-2 ${selectedMap === map.id ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => isHost && handleMapChange(map.id)}
                  >
                    <img src={map.thumbnail} alt={map.name} className="w-full h-20 object-cover bg-gray-200 mb-2" />
                    <h3 className="font-medium">{map.name}</h3>
                    <div className="text-xs text-gray-600">{map.size} • {map.terrain}</div>
                  </div>
                ))}
              </div>
              
              {selectedMap && (
                <div className="mt-3 text-sm text-gray-700">
                  {mapTemplates.find(m => m.id === selectedMap)?.description}
                </div>
              )}
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