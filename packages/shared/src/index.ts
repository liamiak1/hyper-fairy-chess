// Re-export all game types and logic
export * from './game/types';
export * from './game/pieces/pieceDefinitions';
export * from './game/board/boardUtils';
export * from './game/board/topology';
export * from './game/board/moveGeneration';
export * from './game/rules/draft';
export * from './game/rules/placement';
export * from './game/rules/moveExecution';
export * from './game/rules/checkDetection';
export * from './game/rules/gameEndDetection';
export * from './game/rules/castling';
export * from './game/rules/promotion';
export * from './game/rules/freeze';

// 3-player GreenChess mode

// Re-export protocol types
export * from './protocol';
