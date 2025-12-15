import { BOARD_WIDTH, BOARD_HEIGHT } from './constants.js';

/**
 * Game Board
 * Manages the game grid, piece placement, line clearing, and collision detection
 */
export class Board {
    constructor() {
        this.grid = Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0));
    }
    
    isValidPosition(piece, x, y) {
        const shape = piece.getShape();
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    const bx = x + px, by = y + py;
                    if (bx < 0 || bx >= BOARD_WIDTH || by >= BOARD_HEIGHT) return false;
                    if (by >= 0 && this.grid[by][bx]) return false;
                }
            }
        }
        return true;
    }
    
    placePiece(piece, x, y) {
        const shape = piece.getShape();
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    const bx = x + px, by = y + py;
                    if (by >= 0) this.grid[by][bx] = piece.color;
                }
            }
        }
    }
    
    clearLines() {
        const linesToClear = [];
        for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
            if (this.grid[y].every(cell => cell !== 0)) linesToClear.push(y);
        }
        const clearedIndices = [...linesToClear];
        for (const line of linesToClear) {
            this.grid.splice(line, 1);
            this.grid.unshift(Array(BOARD_WIDTH).fill(0));
        }
        return { count: linesToClear.length, indices: clearedIndices };
    }
    
    getGhostY(piece, x, startY) {
        let y = startY;
        while (this.isValidPosition(piece, x, y + 1)) y++;
        return y;
    }
    
    isGameOver() {
        return this.grid[0].some(cell => cell !== 0);
    }
}

