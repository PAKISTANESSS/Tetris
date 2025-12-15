import { TETROMINOES, WALL_KICKS } from './constants.js';

/**
 * Tetromino Piece
 * Handles piece rotation, shape transformations, and wall kicks
 */
export class Piece {
    constructor(type) {
        this.type = type;
        this.data = TETROMINOES[type];
        this.color = this.data.color;
        this.rotation = 0;
        this.shape = this.data.shape;
    }
    
    getShape() {
        return this.rotatedShape();
    }
    
    rotatedShape() {
        let rotated = this.shape;
        for (let i = 0; i < this.rotation % 4; i++) {
            rotated = this.rotate90(rotated);
        }
        return rotated;
    }
    
    rotate90(matrix) {
        const rows = matrix.length, cols = matrix[0].length;
        const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                rotated[c][rows - 1 - r] = matrix[r][c];
            }
        }
        return rotated;
    }
    
    rotate(direction, board, x, y) {
        const oldRotation = this.rotation;
        this.rotation = (this.rotation + direction + 4) % 4;
        const kickData = this.type === 'I' ? WALL_KICKS.I : this.type === 'O' ? WALL_KICKS.O : WALL_KICKS.JLSTZ;
        const kicks = kickData[oldRotation];
        for (const [dx, dy] of kicks) {
            const nx = x + dx, ny = y + dy;
            if (board.isValidPosition(this, nx, ny)) {
                return { x: nx, y: ny, success: true };
            }
        }
        this.rotation = oldRotation;
        return { x, y, success: false };
    }
}

