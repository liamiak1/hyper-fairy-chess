# Hyper Fairy Chess - Project Planning Document

## Project Overview

**Hyper Fairy Chess** is a web-based, point-buy chess system featuring pieces from multiple chess variants. Players draft armies against a preset or random point budget using simultaneous blind selection, then battle on standard or non-standard boards.

---

## Core Concepts

### Point-Buy System
- Each piece type has a point cost based on its power/mobility
- Players receive a budget (preset amounts, or random within a range)
- **Simultaneous blind drafting**: both players secretly build their armies, then reveal
- Mandatory pieces: Each side must have exactly one King (cost: 0 points, always included)

### Tier & Slot System
Pieces are divided into 3 tiers, and boards define **slots** that limit how many of each tier can be drafted:

| Board Size | Pawn Slots (Tier 1) | Piece Slots (Tier 2) | Royalty Slots (Tier 3) |
|------------|---------------------|----------------------|------------------------|
| 8x8        | 8                   | 6                    | 2                      |
| 10x8       | 10                  | 8                    | 2                      |
| 10x10      | 10                  | 8                    | 2                      |

*Note: The King is mandatory and doesn't consume a Royalty slot. Slots may be left empty if desired—players are not required to fill all slots.*

### Victory Points
Each piece has both a **Cost** (to draft) and **Victory Points** (for stalemate resolution):
- If the game ends in stalemate, the player with more Victory Points remaining wins
- If VP totals are equal in stalemate, the game is a **draw**
- Some pieces have asymmetric Cost/VP (e.g., Immobilizer costs 45 but is worth 160 VP)
- Allows strategic trade-offs: cheap utility pieces vs. high-VP targets
- Note: Jester has **negative VP (-15)**, making it a liability in stalemates!

---

## Piece Roster (Playtested Values)

### Tier 1: Pawns
| Piece | Cost | VP | Movement |
|-------|------|-----|----------|
| Pawn | 10 | 10 | Forward 1 (2 from start), captures diagonally forward |
| Shogi Pawn | 12 | 12 | Forward 1 only (no double move), captures forward |
| Peasant | 13 | 13 | Moves/captures 1 square orthogonally or diagonally forward |
| Boxer | 25 | 25 | Slides orthogonally; captures 1 square diagonally |
| Soldier | 34 | 34 | Moves/captures 1 square in any of 8 directions |
| Fool | 27 | 27 | Moves like Shogi Pawn; **cannot be captured**; promotes only to Jester |

### Tier 2: Pieces
| Piece | Cost | VP | Movement |
|-------|------|-----|----------|
| Catapult | 2 | 2 | Leaps (2,0) orthogonally (like Dabbaba) |
| Lancer | 8 | 8 | Leaps (2,2) diagonally (like Alfil) |
| Chamberlain | 18 | 18 | Leaps (2,0)/(0,2); can swap with adjacent King |
| Courtesan | 22 | 22 | Moves 1 diagonally; leaps (2,2) |
| Thief | 29 | 29 | Leaps (2,2) or (3,3); moves diagonally to capture |
| Knight | 31 | 31 | Standard L-shape (2,1) leap |
| Herald | 0 | 32 | Moves like Knight; **freezes adjacent enemies** |
| Bishop | 34 | 34 | Diagonal slider |
| Pontiff | 47 | 47 | Diagonal slider; can bounce off board edges |
| Rook | 50 | 50 | Orthogonal slider |
| Dragon Horse | 56 | 56 | Diagonal slider + 1 square orthogonally |
| Dragon | 64 | 64 | Orthogonal slider + 1 square diagonally |
| Chameleon | 67 | 67 | Queen movement; **captures like the piece it captures** |
| Coordinator | 69 | 69 | Queen movement; captures pieces on squares sharing rank/file with King |
| Long Leaper | 78 | 78 | Queen movement; captures by jumping over enemy (checker-style) |
| Inquisitor | 0 | 80 | Bishop movement; **freezes adjacent enemies** |
| Immobilizer | 45 | 160 | Queen movement; **freezes adjacent enemies** (doesn't capture) |

### Tier 3: Royalty
| Piece | Cost | VP | Movement |
|-------|------|-----|----------|
| King | 0 | 0 | Standard king (1 square any direction); **mandatory** |
| Phantom King | 0 | 0 | King movement; can swap with adjacent friendly pieces |
| Withdrawer | 34 | 34 | Queen movement; captures by moving directly away from adjacent enemy |
| Jester | 0 | -15 | Queen movement; **cannot be captured**; worth negative VP! |
| Queen | 95 | 95 | Standard queen (orthogonal + diagonal slider) |
| Fairy Queen | 130 | 130 | Queen + Knight movement |
| Regent | 155 | 155 | Queen + Knight; transforms when any allied queen-type is captured |

### Other
| Piece | Cost | VP | Notes |
|-------|------|-----|-------|
| Mercenary | 0 | 5 | Starts on a5 (white) or h4 (black); special neutral piece |

*Values from physical playtesting. See CSV files for graphical movement diagrams.*

### Additional Pieces (Estimated Values - Not Yet Playtested)

These pieces are mechanically distinct from the playtested roster and can be added for variety:

#### Tier 2 Additions
| Piece | Est. Cost | Est. VP | Movement | Origin |
|-------|-----------|---------|----------|--------|
| Archbishop | 65 | 65 | Bishop + Knight combined | Capablanca Chess |
| Chancellor | 80 | 80 | Rook + Knight combined | Capablanca Chess |
| Nightrider | 50 | 50 | Repeating knight moves in a line (can make multiple L-jumps) | Fairy Chess |
| Camel | 20 | 20 | (3,1) leap - extended knight variant | Fairy Chess |
| Zebra | 22 | 22 | (3,2) leap - extended knight variant | Fairy Chess |
| Giraffe | 18 | 18 | (4,1) leap | Fairy Chess |
| Grasshopper | 20 | 20 | Slides like Queen but must hop over exactly one piece, landing just beyond | Fairy Chess |
| Cannon | 40 | 40 | Slides orthogonally; captures by hopping over exactly one piece (screen) | Xiangqi |
| Vao | 35 | 35 | Slides diagonally; captures by hopping over exactly one piece (diagonal cannon) | Fairy Chess |
| Wazir | 12 | 12 | 1 square orthogonally only | Shatranj |
| Ferz | 12 | 12 | 1 square diagonally only | Shatranj |

*Note: These values are rough estimates based on component movements. Playtesting required for balance.*

### Board Options

#### Standard
- **8x8** - Traditional chess board

#### Extended
- **10x8** - Capablanca chess (extra files for Archbishop/Chancellor)
- **10x10** - Grand Chess

#### Non-Standard (Future)
- **Cylindrical (wrap-around)**
- **Non-Rectangular**
- **Rectangular with cut-outs (ala Stratego boards)
- **Custom dimensions**

---

## Game Flow

```
1. SETUP PHASE
   ├── Select board type (8x8, 10x8, 10x10)
   ├── Set point budget (preset / random / custom)
   ├── Select available piece pool (or use all)
   └── Choose time controls (optional)

2. DRAFT PHASE (Simultaneous Blind)
   ├── Each player secretly selects pieces within budget and slot limits
   ├── Both selections revealed simultaneously
   └── Validate legal army compositions

3. PLACEMENT PHASE
   ├── MVP Mode: Alternating placement
   │   ├── White places one piece on their back ranks
   │   ├── Black places one piece on their back ranks
   │   ├── Alternate until all pieces placed
   │   └── (Player with more pieces continues alone if needed)
   │
   └── Future Mode: Simultaneous blind placement with reveal

4. PLAY PHASE
   ├── White moves first
   ├── Standard turn-based play
   ├── Check/checkmate/stalemate rules apply
   └── Track Victory Points for stalemate resolution

5. END GAME
   ├── Checkmate → Winner
   ├── Stalemate → Compare Victory Points (higher wins; equal = draw)
   ├── Resignation / Timeout
   └── Record game for replay/analysis
```

---

## Technical Architecture

### Recommended Stack

**Frontend:**
- TypeScript + React
- Canvas or SVG for board rendering
- State management: React Context or Zustand

**Backend (for multiplayer):**
- Node.js with Express or Fastify
- WebSocket (Socket.io) for real-time play
- SQLite or PostgreSQL for game persistence

**AI Opponent:**
- Initially: Simple minimax with alpha-beta pruning
- Piece-square tables adapted for fairy pieces
- Future: More sophisticated evaluation, possibly neural network

### Project Structure (Proposed)
```
hyper_fairy_chess/
├── src/
│   ├── components/     # React UI components
│   ├── game/           # Core game logic
│   │   ├── pieces/     # Piece definitions and movement
│   │   ├── board/      # Board state and validation
│   │   ├── rules/      # Game rules engine
│   │   └── ai/         # AI opponent logic
│   ├── draft/          # Draft/army building system
│   ├── multiplayer/    # Online play infrastructure
│   └── utils/          # Helpers and utilities
├── server/             # Backend for multiplayer
├── public/             # Static assets
├── tests/              # Test suites
└── docs/               # Documentation
```

---

## Play Modes

### 1. Local Hot-Seat
- Two players on same device
- Simple turn alternation
- No network required
- **Priority: MVP**

### 2. Online Multiplayer
- Matchmaking or private rooms
- WebSocket-based real-time sync
- Game state persistence
- Reconnection handling
- **Priority: Post-MVP**

### 3. AI Opponent
- Multiple difficulty levels
- Configurable thinking time
- Works offline
- **Priority: MVP (basic), Enhanced post-MVP**

---

## MVP Scope (Minimum Viable Product)

### Must Have
- [ ] 8x8 board with standard rendering
- [ ] Tier system UI (8 pawn slots, 6 piece slots, 2 royalty slots)
- [ ] **Tier 1 MVP pieces**: Pawn, Shogi Pawn, Soldier
- [ ] **Tier 2 MVP pieces**: Knight, Bishop, Rook, Dragon, Chameleon
- [ ] **Tier 3 MVP pieces**: King, Queen, Fairy Queen
- [ ] Point-buy draft with simultaneous blind reveal
- [ ] Victory Points tracking for stalemate resolution
- [ ] Basic move validation and check detection
- [ ] Checkmate/stalemate detection (with VP winner)
- [ ] Local hot-seat play
- [ ] Simple AI opponent (random legal moves or basic evaluation)
- [ ] Rules reference panel (edge cases, piece movements, etc.)

### Should Have (MVP+)
- [ ] Rule lookup pop-up (click piece to see movement/abilities)
- [ ] **Additional Tier 1**: Peasant, Boxer, Fool
- [ ] **Additional Tier 2**: Rook, Pontiff, Dragon Horse, Coordinator, Long Leaper, Immobilizer, Inquisitor, Herald, Chamberlain, Courtesan, Thief, Catapult, Lancer
- [ ] **Additional Tier 3**: Withdrawer, Jester, Regent, Phantom King
- [ ] Freezing mechanics (Immobilizer, Inquisitor, Herald)
- [ ] Piece promotion options for pawn-types
- [ ] Move history and undo
- [ ] Game save/load
- [ ] Mercenary (neutral piece)

### Could Have (Post-MVP)
- [ ] Online multiplayer
- [ ] 10x8 and 10x10 boards (with adjusted slot counts)
- [ ] Stronger AI with piece-value-aware evaluation
- [ ] Game replay viewer
- [ ] Sound effects and animations
- [ ] Piece play statistics (detect under/over-valued pieces based on win rates)
- [ ] Custom piece designer
- [ ] Import/export army configurations

### Won't Have (Out of Scope)
- Hexagonal or circular boards
- Mobile native apps
- Tournament/ranking systems

---

## Balance Considerations

### Point Value Calibration
Point values will need iterative tuning. Initial approach:
1. Start with classical piece values as baseline, multiplied by ten to enable fine tuning while maintaining integer values
2. Estimate fairy piece values from their component movements
3. Playtest extensively
4. Adjust based on win rates when pieces are included

### Draft Constraints (Optional Rules)
- Minimum pawn count?
- Maximum of X copies per piece type?
- Required piece diversity?

---

## Established Rulings (from Playtesting)

### Movement & Capturing
- **Long Leapers** cannot jump over Jesters or Fools
- **Fools** cannot be jumped over by any piece; Knights/Knight-like pieces need both paths blocked
- **Chameleons** capture like the piece they're capturing (including en passant, knight moves for knights/fairy queens, bouncing for pontiffs)
- **Chameleons** do not freeze friendly Heralds; if adjacent to freezing enemy, Chameleon freezes that enemy instead
- **Chamberlains** can capture on both leap squares AND move-only squares (but only move to capture squares when capturing)
- **Coordinators** only capture when they move (moving the King doesn't trigger captures)
- **Withdrawers** capture by moving directly away from an adjacent enemy piece

### Freezing Mechanics
- **Immobilizers, Inquisitors, Heralds** freeze adjacent enemy pieces
- Freezing the enemy King does NOT cause stalemate if they have other legal moves
- **Jesters** cannot be frozen
- **Chamberlains** and Kings can swap to escape immobilization (if Chamberlain can move)

### Special Pieces
- **Fools/Jesters** cannot be captured
- **Phantom Kings** can swap with adjacent friendly pieces (but not with Fools; can swap with Jesters)
- **Phantom Kings** can move pawn-type pieces backward; this doesn't count as the pawn moving
- **Regents** transform when any allied queen-type piece is lost (must take one)

### Pawn Rules
- **En Passant**: Any pawn-type piece that can double-move on its first turn can be captured en passant by any pawn-type piece, as if it had only moved one square
- **Double-move eligibility**: If a pawn-type hasn't moved AND is on 1st/2nd rank, it can double-move (Phantom King moving it to 3rd rank removes this)
- **Shogi Pawns**: No double-move; no drop mechanic; cannot be captured en passant and cannot capture en passant

### Pawn Promotion
- **Standard promotion**: When a pawn-type reaches the far rank, it promotes to any **capturing piece** currently in the game (excluding Kings and non-capturing pieces like Immobilizer)
- **Fool exception**: Fools can only promote to Jester

### Castling
Certain pieces have the **can-castle** characteristic, allowing them to participate in castling:
- **Royal pieces that can castle**: King, Regent, Phantom King
- **Pieces with can-castle**: Rook, Dragon, Chamberlain

**Castling rules:**
- Move an unmoved royal 2 squares toward an unmoved can-castle piece
- The can-castle piece moves to the other side of the royal
- Cannot castle if starting adjacent
- Cannot castle from, into, or through check
- Both pieces must be unmoved

### Mercenary
- Starts on a5 (white) or h4 (black)
- Neutral piece with special starting position

---

## Resolved Design Questions

1. **Starting Position**: Free placement on back ranks
   - **MVP mode**: Alternating placement, one piece at a time, white goes first. If one player has more pieces, they continue placing until complete.
   - **Future mode**: Simultaneous blind placement with reveal

2. **Pawn Promotion**: Promote to any **capturing piece** in the current game (excludes Kings and non-capturing pieces like Immobilizer). Fools can only promote to Jester.

3. **Stalemate Resolution**:
   - Player with more remaining Victory Points wins
   - If VP totals are equal, the game is a **draw**
   - Leftover draft points have no effect on stalemate

4. **Slot Flexibility**: Players may leave slots empty if they purchase fewer pieces of a type than slots available for that tier.

---

## Development Phases

### Phase 1: Foundation
- Project setup (TypeScript, React, build tooling)
- Core game state representation
- Board rendering
- Orthodox piece movement

### Phase 2: Extended Pieces
- Implement Tier 1/2/3 piece movements (from playtested roster)
- Piece selection/configuration system with slot limits
- Movement validation for all pieces
- Special mechanics: freezing, uncapturable pieces, Chameleon captures

### Phase 3: Draft System
- Point budget system
- Army building UI
- Simultaneous blind reveal mechanism

### Phase 4: Game Rules
- Check/checkmate detection
- Stalemate and draw conditions
- Win condition handling

### Phase 5: AI Opponent
- Move generation
- Position evaluation
- Search algorithm (minimax/alpha-beta)

### Phase 6: Polish & Multiplayer
- UI/UX improvements
- Online multiplayer infrastructure
- Testing and balance tuning

---

## Resources & References

### Project Data Files
- `Fairy Chess Points - Pieces by tier.csv` - Playtested point values and victory points
- `Fairy Chess Points - Moves.csv` - Graphical movement diagrams for all pieces
- `Fairy Chess Points - Rulings.csv` - Edge case rulings from physical playtesting

### Chess Variants
- [Chess Variants Pages](https://www.chessvariants.com/)
- [Fairy Chess Pieces](https://en.wikipedia.org/wiki/Fairy_chess_piece)
- [Capablanca Chess](https://en.wikipedia.org/wiki/Capablanca_chess)

### Technical
- [chess.js](https://github.com/jhlywa/chess.js) - Inspiration for move generation
- [Stockfish](https://stockfishchess.org/) - Reference for AI concepts
- [Lichess](https://lichess.org/) - Open source chess UI reference

---

## Next Steps

1. **Review this document** - Add/modify any concepts
2. **Finalize MVP scope** - Confirm which fairy pieces to include first
3. **Set up project** - Initialize repository, tooling, folder structure
4. **Begin Phase 1** - Core game state and board rendering

---

*Document created: 2026-02-25*
*Status: Draft - Awaiting Review*
