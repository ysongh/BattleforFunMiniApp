<artifact identifier="claude-md-file" type="application/vnd.ant.code" language="markdown" title="claude.md">
# BattleforFunMiniApp - Game Documentation
Project Overview
BattleforFunMiniApp is a turn-based strategy game inspired by Advance Wars, built with React, TypeScript, and Tailwind CSS. The game features a grid-based battlefield where players command units to defeat their opponent. The game now includes an AI computer player with three difficulty levels.
Table of Contents

Game Features
Technical Stack
Game Mechanics
AI Implementation
Project Structure
Installation
How to Play
API Reference
Future Enhancements

Game Features
Core Features

Turn-Based Gameplay: Players alternate turns to move units and attack
Grid-Based Movement: 10x10 battlefield with strategic positioning
Multiple Unit Types: Infantry, Tanks, Artillery, and APCs with unique stats
Health System: Units have HP, attack, and defense values
Movement and Attack Ranges: Each unit type has specific movement and attack capabilities
Visual Feedback: Health bars, unit selection highlighting, and possible move indicators
City Capture & Funds: Infantry can capture neutral/enemy cities; capturing awards $1000 to the player
Counter-Attack System: Close-range enemies (Infantry, Tank) retaliate when attacked; counter-damage scales with the defender's remaining health

AI Features

Single-Player Mode: Play against a computer opponent
Three Difficulty Levels:

Easy: Random decision-making
Medium: Prioritizes attacks and basic targeting
Hard: Advanced target selection and strategic positioning


Automated Turn Execution: AI automatically moves and attacks during its turn
Intelligent Targeting: AI prioritizes weak enemies and optimal positioning

Technical Stack

Frontend Framework: React 18+
Language: TypeScript
Styling: Tailwind CSS
Routing: React Router
Icons: Tabler Icons
Build Tool: Vite (assumed)

Game Mechanics
Unit System
Each unit has the following properties:
typescriptinterface Unit {
  id: string;              // Unique identifier
  name: string;            // Display name
  type: string;            // Unit type (Infantry, Tank, etc.)
  x: number;              // Grid X position (0-9)
  y: number;              // Grid Y position (0-9)
  player: string;         // 'red' or 'blue'
  attack: number;         // Attack power
  defense: number;        // Defense value
  max_hp: number;         // Maximum health points
  current_hp: number;     // Current health points
  moveRange: number;      // How far the unit can move
  attackRange: number;    // How far the unit can attack
  img: string;            // Unit image path
  hasMoved: boolean;      // Movement status this turn
  hasAttacked: boolean;   // Attack status this turn
}
Movement Rules

Manhattan Distance: Movement is calculated using Manhattan distance (|dx| + |dy|)
Range Limit: Units cannot move beyond their moveRange value
Collision Detection: Units cannot move onto occupied tiles
One Move Per Turn: Each unit can move once per turn
Grid Boundaries: Movement is restricted to the 10x10 grid

Combat System

Damage Calculation:

```typescript
damage = max(0, attacker.attack - (defender.defense + terrain_defense_bonus))
// clamped to: max(10, damage), capped at defender.health
```

2. **Counter-Attack**: When a close-range enemy (`attackRange === 1`) survives a hit and the attacker is adjacent (distance ≤ 1), it immediately retaliates:

```typescript
counterDamage = max(1, round(calculateDamage(defender, attacker, attackerTerrain) * (defender.health / 100)))
```
Artillery (`attackRange === 3`) never counter-attacks.

3. **Attack Range**: Attacks follow the same Manhattan distance calculation as movement

4. **Turn Sequence**:
   - Move unit (optional)
   - Attack enemy (optional, triggers counter-attack if close range)
   - End turn

5. **Unit Elimination**: Units with 0 HP are removed from the battlefield

### Economy System

- **Starting Funds**: Each player begins with $1000
- **City Capture**: Sending an Infantry unit onto a City tile and using the Capture action awards **$1000** upon full capture (progress reaches 20)
- **Spending Funds**: Funds are spent to produce new units from owned city factories (`handleBuyUnit` in `Game.tsx`)

### Win Conditions

- **Victory**: Eliminate all enemy units
- **Defeat**: Lose all your units (including via counter-attack)

## AI Implementation

### Architecture

The AI logic lives in `src/lib/ai.ts` and exposes a single pure function `computeAIAction()` that returns an action (attack or move) without touching React state. The Game component calls it on an interval and applies the returned action to state.

```
Game.tsx: tryAIAction() (useCallback)
└── ai.ts: computeAIAction(context)
    ├── Find available Blue units (not on cooldown)
    ├── Find all Red units
    ├── Pick unit (difficulty-based selection)
    ├── Try attack first (difficulty-based targeting)
    └── Fall back to move toward nearest enemy
    └── Returns { type, unit, newGrid } or null
```

### AI Functions

#### 1. `playAITurn()`
**Purpose**: Main entry point for AI turn execution

**Logic**:
- Checks if AI has any units available
- Selects the best unit to move
- Executes the move and attack sequence
- Ends turn if no valid moves available

#### 2. `selectUnitToMove(aiUnits: Unit[]): Unit | null`
**Purpose**: Chooses which unit should be moved based on difficulty level

**Easy Mode**:
- Randomly selects any available unit
- No strategic consideration

**Medium Mode**:
- Prioritizes units that can attack enemies
- Falls back to random selection if no attacks available

**Hard Mode**:
- Prioritizes units that can attack weak enemies (HP ≤ 30)
- Secondary priority: units that can attack any enemy
- Tertiary: any available unit

#### 3. `findAttackTargets(unit: Unit): Unit[]`
**Purpose**: Identifies all enemy units within attack range

**Logic**:
- Filters units by:
  - Player is 'red' (enemy)
  - Current HP > 0 (alive)
  - Distance ≤ unit's attack range

#### 4. `calculateBestMovePosition(unit: Unit): {x, y} | null`
**Purpose**: Determines the optimal position to move the unit

**Logic**:
1. If enemies are in attack range, don't move
2. Find the closest enemy unit
3. Calculate all valid move positions
4. Select the move that minimizes distance to closest enemy

#### 5. `executeAIMove(unit: Unit)`
**Purpose**: Executes the complete move sequence for a unit

**Sequence**:
1. Select the unit
2. Calculate best move position
3. Move the unit (with 1s delay for visibility)
4. Check for attack opportunities
5. Execute attack if possible
6. Continue to next unit or end turn

#### 6. `executeAIAttack(unit: Unit, targets: Unit[])`
**Purpose**: Performs an attack on the weakest available target

**Logic**:
1. Find target with lowest current HP
2. Calculate damage
3. Display attack modal
4. Confirm attack after 1s delay
5. Check if more units need to move
6. End turn if all units have acted

### Helper Functions

#### `calculateDistance(unit1: Unit, unit2: Unit): number`
Returns the Manhattan distance between two units.

#### `isPositionFree(x: number, y: number, excludeUnitId: string): boolean`
Checks if a grid position is unoccupied (excluding a specific unit).

### AI Timing

The AI uses strategic delays to make actions visible to the player:

- **Turn Start**: 1000ms delay before AI begins
- **After Move**: 1000ms delay before checking for attacks
- **Attack Execution**: 1000ms delay before confirming attack
- **Between Units**: 500ms delay before moving to next unit

### Difficulty Customization

Players can change AI difficulty at any time using the in-game controls. The difficulty affects:

1. **Unit Selection Strategy**
2. **Target Prioritization**
3. **Move Calculation** (future enhancement)

## Project Structure
```
src/
├── pages/
│   └── Game.tsx              # Main game component (UI, state, event handlers)
├── lib/
│   ├── ai.ts                # AI decision logic (computeAIAction)
│   ├── combat.ts            # Damage calculation, win condition checks
│   ├── constants.ts         # Game constants, unit stats, terrain definitions
│   ├── grid.ts              # Grid generation, movement/attack range, terrain helpers
│   └── units.ts             # Unit factory (createUnit, generateId)
├── types/
│   └── game.ts              # Type definitions (Unit, Tile, Terrain, etc.)
├── components/
│   └── [UI components]       # Game UI components
└── styles/
    └── [CSS files]           # Game styling
Installation
Prerequisites

Node.js 16+
npm or yarn

Setup Steps

Clone the repository:

bash   git clone https://github.com/ysongh/BattleforFunMiniApp.git
   cd BattleforFunMiniApp

Install dependencies:

bash   npm install

Run the development server:

bash   npm run dev

Build for production:

bash   npm run build
How to Play
Player Turn (Red)

Select a Unit: Click on one of your red units
Move: Click on a highlighted tile to move there
Attack: After moving, click on a red-highlighted enemy to attack
Confirm/Cancel: Use the attack modal to confirm or cancel attacks
End Turn: Click "End Turn" when finished

AI Turn (Blue)

The AI automatically takes its turn when it's the blue player's turn
Watch as the AI:

Selects units
Moves them strategically
Attacks your units


The AI will automatically end its turn when finished

Strategy Tips

Positioning: Use your units' movement range to control the battlefield
Focus Fire: Concentrate attacks on single enemies to eliminate them
Defense: Higher defense units should lead the assault
Range: Use Artillery's longer attack range to your advantage — Artillery never triggers counter-attacks
HP Management: Retreat wounded units and bring fresh ones forward
City Control: Capture cities with Infantry to earn $1000 and fund new unit production
Counter-Attack Awareness: Attacking a healthy close-range enemy will hurt back — weaken them with Artillery first

API Reference
Component Props
The Game component doesn't accept props as it manages all state internally.
Key State Variables
typescriptconst [units, setUnits] = useState<Unit[]>([]);
const [player, setPlayer] = useState<string>('red');
const [selectedUnit, setSelectedUnit] = useState<{index: number, canMove: boolean} | null>(null);
const [attack, setAttack] = useState<{attacker: Unit, defender: Unit, damage: number} | null>(null);
const [isAITurn, setIsAITurn] = useState<boolean>(false);
const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
Main Functions
handleChangeTurn()
Switches the active player and resets unit states.
showPossibleMoves(unitIndex: number): {x: number, y: number}[]
Returns an array of valid move positions for a unit.
showPossibleAttacks(unitIndex: number): {x: number, y: number, unit: Unit}[]
Returns an array of valid attack targets for a unit.
handleUnitClick(unitIndex: number)
Handles unit selection by the player.
handleCellClick(x: number, y: number)
Handles grid cell clicks for movement and attacks.
confirmAttack()
Executes the selected attack and updates unit HP.
cancelAttack()
Cancels the attack confirmation modal.
Future Enhancements
Gameplay Features

Terrain System: ✅ Implemented (Plain, Mountain, Forest, City, Road with movement costs and defense bonuses)
Unit Production: ✅ Implemented (buy units from owned city factories using funds)
Resource Management: ✅ Implemented (earn $1000 per city captured; spend funds on unit production)
Fog of War: Hide enemy units outside vision range
Special Abilities: Add unique abilities for each unit type
Multiple Maps: Create different battlefield layouts

AI Improvements

Predictive Analysis: AI considers player's potential moves
Defensive Positioning: AI protects weak units
Tactical Retreat: AI moves wounded units to safety
Formation Strategy: AI maintains unit formations
Objective-Based AI: AI captures strategic points

Technical Enhancements

Animations: Add smooth movement and attack animations
Sound Effects: Add audio feedback for actions
Multiplayer: Add online multiplayer support
Save/Load: Implement game state persistence
Replay System: Record and playback matches
Tutorial Mode: Interactive tutorial for new players

UI/UX Improvements

Unit Info Panel: Display detailed unit stats on hover
Action Queue: Show planned actions before execution
Battle Predictions: Show attack damage before confirming
Mobile Optimization: Improve touch controls for mobile devices
Accessibility: Add keyboard controls and screen reader support

Contributing
Contributions are welcome! Please follow these steps:

Fork the repository
Create a feature branch (git checkout -b feature/amazing-feature)
Commit your changes (git commit -m 'Add amazing feature')
Push to the branch (git push origin feature/amazing-feature)
Open a Pull Request

License
[Add your license information here]
Credits

Original Game Concept: Advance Wars (Intelligent Systems)
Development: BattleforFunMiniApp Team
AI Implementation: Enhanced with Claude AI assistance

Support
For issues, questions, or suggestions:

GitHub Issues: https://github.com/ysongh/BattleforFunMiniApp/issues
Email: [Contact Email]


Version: 1.2.0
Last Updated: April 2026
</artifact>