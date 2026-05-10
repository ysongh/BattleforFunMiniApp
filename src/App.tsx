import { HashRouter, Route, Routes } from 'react-router-dom';

import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import Game2 from "./pages/Game2";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/game"
          element={<Game />} />
        <Route
          path="/game2"
          element={<Game2 />} />
        <Route
          path="/"
          element={<Lobby />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
