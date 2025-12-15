// Game Constants
export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const CELL_SIZE = 32;
export const VIRTUAL_WIDTH = BOARD_WIDTH * CELL_SIZE;
export const VIRTUAL_HEIGHT = BOARD_HEIGHT * CELL_SIZE;

// Tetromino Definitions
export const TETROMINOES = {
    I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: [0, 255, 255] },
    O: { shape: [[1,1],[1,1]], color: [255, 255, 0] },
    T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: [128, 0, 128] },
    S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: [0, 255, 0] },
    Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: [255, 0, 0] },
    J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: [0, 0, 255] },
    L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: [255, 165, 0] }
};

// Wall Kick Data for Rotation
export const WALL_KICKS = {
    JLSTZ: {
        0: [[-1,0], [-1,1], [0,-2], [-1,-2]],
        1: [[1,0], [1,-1], [0,2], [1,2]],
        2: [[1,0], [1,1], [0,-2], [1,-2]],
        3: [[-1,0], [-1,-1], [0,2], [-1,2]]
    },
    I: {
        0: [[-2,0], [1,0], [-2,-1], [1,2]],
        1: [[-1,0], [2,0], [-1,2], [2,-1]],
        2: [[2,0], [-1,0], [2,1], [-1,-2]],
        3: [[1,0], [-2,0], [1,-2], [-2,1]]
    },
    O: { 0: [[0,0]], 1: [[0,0]], 2: [[0,0]], 3: [[0,0]] }
};

// Scoring Values
export const SCORE_VALUES = {
    SINGLE: 100,
    DOUBLE: 300,
    TRIPLE: 500,
    TETRIS: 800,
    SOFT_DROP: 1,
    HARD_DROP: 2
};

