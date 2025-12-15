import { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE, VIRTUAL_WIDTH, VIRTUAL_HEIGHT, SCORE_VALUES } from './constants.js';
import { Renderer } from './renderer.js';
import { Board } from './board.js';
import { Piece } from './piece.js';
import { BagRandomizer } from './randomizer.js';
import { InputManager } from './input.js';
import { AudioManager } from './audio.js';
import { HapticsManager } from './haptics.js';

/**
 * Main Game Class
 * Orchestrates all game systems and manages game state
 */
export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.nextCanvas = document.getElementById('nextCanvas');
        this.renderer = new Renderer(this.canvas);
        
        const nextSize = 4 * CELL_SIZE;
        this.nextRenderer = new Renderer(this.nextCanvas, nextSize, nextSize);
        
        this.board = new Board();
        this.inputManager = new InputManager();
        this.audioManager = new AudioManager();
        this.hapticsManager = new HapticsManager();
        this.randomizer = new BagRandomizer();
        
        this.currentPiece = null;
        this.nextPiece = null;
        this.pieceX = 0;
        this.pieceY = 0;
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropTimer = 0;
        this.dropInterval = 1000;
        this.gameState = 'menu';
        this.clearedLines = [];
        this.clearedLinesData = null;
        this.clearAnimationTime = 0;
        
        this.setupUI();
        this.nextPiece = new Piece(this.randomizer.next());
        
        if (this.gameState === 'playing') {
            this.spawnPiece();
        }
        
        console.log('WebGL setup check:');
        console.log('- Program:', this.renderer.program ? 'OK' : 'FAILED');
        console.log('- aPos:', this.renderer.aPos);
        console.log('- aTex:', this.renderer.aTex);
        console.log('- Canvas size:', this.canvas.width, 'x', this.canvas.height);
        console.log('- Virtual size:', VIRTUAL_WIDTH, 'x', VIRTUAL_HEIGHT);
        
        this.gameLoop();
    }
    
    setupUI() {
        document.getElementById('muteBtn').addEventListener('click', () => {
            const muted = this.audioManager.toggleMute();
            document.getElementById('muteBtn').textContent = muted ? '🔇' : '🔊';
            document.getElementById('muteBtn').classList.toggle('muted', muted);
        });
        
        const overlay = document.getElementById('gameOverlay');
        let clickTimeout = null;
        overlay.addEventListener('click', () => {
            if (clickTimeout) return;
            clickTimeout = setTimeout(() => { clickTimeout = null; }, 300);
            
            if (this.gameState === 'menu' || this.gameState === 'gameover') {
                this.startGame();
            } else if (this.gameState === 'paused') {
                this.resumeGame();
            }
        });
        
        this.updateHUD();
    }
    
    spawnPiece() {
        if (this.nextPiece) {
            this.currentPiece = this.nextPiece;
        } else {
            this.currentPiece = new Piece(this.randomizer.next());
        }
        this.nextPiece = new Piece(this.randomizer.next());
        const shape = this.currentPiece.getShape();
        this.pieceX = Math.floor((BOARD_WIDTH - shape[0].length) / 2);
        this.pieceY = 0;
        if (!this.board.isValidPosition(this.currentPiece, this.pieceX, this.pieceY)) {
            this.gameOver();
        }
    }
    
    handleInput() {
        if (this.inputManager.isJustPressed('mute')) {
            const muted = this.audioManager.toggleMute();
            document.getElementById('muteBtn').textContent = muted ? '🔇' : '🔊';
            document.getElementById('muteBtn').classList.toggle('muted', muted);
        }
        
        if (this.gameState !== 'playing') {
            if (this.inputManager.isJustPressed('space')) {
                if (this.gameState === 'menu' || this.gameState === 'gameover') {
                    this.startGame();
                }
            }
            
            if (this.inputManager.isJustPressed('pause') && this.gameState === 'paused') {
                this.resumeGame();
                return;
            }
            return;
        }
        
        if (this.inputManager.isJustPressed('left')) {
            if (this.board.isValidPosition(this.currentPiece, this.pieceX - 1, this.pieceY)) {
                this.pieceX--;
                this.audioManager.playMove();
            }
        }
        if (this.inputManager.isJustPressed('right')) {
            if (this.board.isValidPosition(this.currentPiece, this.pieceX + 1, this.pieceY)) {
                this.pieceX++;
                this.audioManager.playMove();
            }
        }
        if (this.inputManager.isJustPressed('rotate')) {
            const result = this.currentPiece.rotate(1, this.board, this.pieceX, this.pieceY);
            if (result.success) {
                this.pieceX = result.x;
                this.pieceY = result.y;
                this.audioManager.playRotate();
            }
        }
        if (this.inputManager.isJustPressed('down')) {
            if (this.board.isValidPosition(this.currentPiece, this.pieceX, this.pieceY + 1)) {
                this.pieceY++;
                this.score += SCORE_VALUES.SOFT_DROP;
                this.updateHUD();
            }
        }
        if (this.inputManager.isJustPressed('space')) {
            const dropY = this.board.getGhostY(this.currentPiece, this.pieceX, this.pieceY);
            const dropDistance = dropY - this.pieceY;
            this.pieceY = dropY;
            this.score += dropDistance * SCORE_VALUES.HARD_DROP;
            this.lockPiece();
            this.audioManager.playHardDrop();
            this.hapticsManager.hardDrop();
        }
        if (this.inputManager.isJustPressed('pause')) {
            this.pauseGame();
        }
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        if (this.clearedLines.length > 0) {
            this.clearAnimationTime += deltaTime;
            if (this.clearAnimationTime > 500) {
                this.clearedLines = [];
                this.clearedLinesData = null;
                this.clearAnimationTime = 0;
            }
            return;
        }
        this.dropTimer += deltaTime;
        const gravityInterval = Math.max(50, this.dropInterval - (this.level - 1) * 50);
        if (this.dropTimer >= gravityInterval) {
            this.dropTimer = 0;
            if (this.board.isValidPosition(this.currentPiece, this.pieceX, this.pieceY + 1)) {
                this.pieceY++;
            } else {
                this.lockPiece();
            }
        }
    }
    
    lockPiece() {
        this.board.placePiece(this.currentPiece, this.pieceX, this.pieceY);
        const linesToClear = [];
        for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
            if (this.board.grid[y].every(cell => cell !== 0)) {
                linesToClear.push(y);
            }
        }
        
        if (linesToClear.length > 0) {
            this.clearedLines = linesToClear;
            this.clearedLinesData = linesToClear.map(y => [...this.board.grid[y]]);
            this.clearAnimationTime = 0;
            
            for (const line of linesToClear) {
                this.board.grid.splice(line, 1);
                this.board.grid.unshift(Array(BOARD_WIDTH).fill(0));
            }
            
            const scoreMap = {1: SCORE_VALUES.SINGLE, 2: SCORE_VALUES.DOUBLE, 3: SCORE_VALUES.TRIPLE, 4: SCORE_VALUES.TETRIS};
            this.score += scoreMap[linesToClear.length] * this.level;
            this.lines += linesToClear.length;
            const newLevel = Math.floor(this.lines / 10) + 1;
            if (newLevel > this.level) {
                this.level = newLevel;
                this.audioManager.playLevelUp();
            }
            this.audioManager.playLineClear(linesToClear.length);
            this.hapticsManager.lineClear(linesToClear.length);
            this.updateHUD();
        }
        this.spawnPiece();
    }
    
    render() {
        this.renderer.clear();
        this.renderer.drawBoard(this.board.grid, []);
        
        if (this.clearedLinesData && this.clearedLines.length > 0) {
            for (let i = 0; i < this.clearedLines.length; i++) {
                const y = this.clearedLines[i];
                const lineData = this.clearedLinesData[i];
                for (let x = 0; x < BOARD_WIDTH; x++) {
                    if (lineData[x]) {
                        const alpha = 0.5 + 0.5 * Math.sin(this.clearAnimationTime / 50);
                        this.renderer.drawBlock(x * CELL_SIZE, y * CELL_SIZE, lineData[x], alpha);
                    }
                }
            }
        }
        
        if (this.gameState === 'playing' && this.currentPiece) {
            const ghostY = this.board.getGhostY(this.currentPiece, this.pieceX, this.pieceY);
            if (ghostY !== this.pieceY) {
                this.renderer.drawGhost(this.currentPiece, this.pieceX, ghostY);
            }
            this.renderer.drawPiece(this.currentPiece, this.pieceX, this.pieceY, 1.0, 0.3);
        }
        
        if (this.nextPiece) {
            this.nextRenderer.clear();
            const shape = this.nextPiece.getShape();
            const offsetX = (4 - shape[0].length) / 2;
            const offsetY = (4 - shape.length) / 2;
            this.nextRenderer.drawPiece(this.nextPiece, offsetX, offsetY, 1.0, 0.2);
        }
    }
    
    updateHUD() {
        document.getElementById('score').textContent = this.score.toLocaleString();
        document.getElementById('level').textContent = this.level;
        document.getElementById('lines').textContent = this.lines;
    }
    
    startGame() {
        if (this.gameState === 'playing') return;
        
        this.gameState = 'playing';
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropTimer = 0;
        this.clearedLines = [];
        this.clearedLinesData = null;
        this.clearAnimationTime = 0;
        this.board = new Board();
        this.randomizer = new BagRandomizer();
        this.currentPiece = null;
        if (!this.nextPiece) {
            this.nextPiece = new Piece(this.randomizer.next());
        }
        this.spawnPiece();
        this.updateHUD();
        this.hideOverlay();
    }
    
    pauseGame() {
        this.gameState = 'paused';
        this.showOverlay('PAUSED', 'Press P to resume');
    }
    
    resumeGame() {
        this.gameState = 'playing';
        this.hideOverlay();
    }
    
    gameOver() {
        this.gameState = 'gameover';
        this.audioManager.playGameOver();
        this.hapticsManager.gameOver();
        this.showOverlay('GAME OVER', `Final Score: ${this.score.toLocaleString()}<br>Press SPACE to restart`);
    }
    
    showOverlay(title, message) {
        const overlay = document.getElementById('gameOverlay');
        document.getElementById('overlayTitle').textContent = title;
        document.getElementById('overlayMessage').innerHTML = message;
        overlay.classList.remove('hidden');
    }
    
    hideOverlay() {
        const overlay = document.getElementById('gameOverlay');
        overlay.classList.add('hidden');
        console.log('Overlay hidden, game state:', this.gameState);
    }
    
    gameLoop() {
        if (!this.gameLoopRunning && this.gameLoopRunning !== undefined) {
            return;
        }
        let lastTime = performance.now();
        const loop = (currentTime) => {
            if (!this.gameLoopRunning && this.gameLoopRunning !== undefined) {
                return;
            }
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;
            this.handleInput();
            this.update(deltaTime);
            this.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

