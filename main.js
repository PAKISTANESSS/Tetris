// Tetris Game - WebGL Implementation
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 32;
const VIRTUAL_WIDTH = BOARD_WIDTH * CELL_SIZE;
const VIRTUAL_HEIGHT = BOARD_HEIGHT * CELL_SIZE;

const TETROMINOES = {
    I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: [0, 255, 255] },
    O: { shape: [[1,1],[1,1]], color: [255, 255, 0] },
    T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: [128, 0, 128] },
    S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: [0, 255, 0] },
    Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: [255, 0, 0] },
    J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: [0, 0, 255] },
    L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: [255, 165, 0] }
};

const WALL_KICKS = {
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

const SCORE_VALUES = {
    SINGLE: 100, DOUBLE: 300, TRIPLE: 500, TETRIS: 800,
    SOFT_DROP: 1, HARD_DROP: 2
};

class Renderer {
    constructor(canvas, width = VIRTUAL_WIDTH, height = VIRTUAL_HEIGHT) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl', { 
            alpha: false, 
            antialias: false,
            preserveDrawingBuffer: true 
        }) || canvas.getContext('experimental-webgl', { 
            alpha: false, 
            antialias: false,
            preserveDrawingBuffer: true 
        });
        if (!this.gl) throw new Error('WebGL not supported');
        console.log('WebGL context created:', {
            version: this.gl.getParameter(this.gl.VERSION),
            vendor: this.gl.getParameter(this.gl.VENDOR),
            renderer: this.gl.getParameter(this.gl.RENDERER)
        });
        this.virtualWidth = width;
        this.virtualHeight = height;
        this.setupCanvas();
        this.setupShaders();
        this.setupBuffers();
        this.setupUniforms();
    }
    
    setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.style.width = this.virtualWidth + 'px';
        this.canvas.style.height = this.virtualHeight + 'px';
        this.canvas.width = this.virtualWidth * dpr;
        this.canvas.height = this.virtualHeight * dpr;
        
        // Set viewport to match canvas size
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Create projection matrix (orthographic, Y-up, origin at top-left)
        this.projectionMatrix = this.ortho(0, this.virtualWidth, this.virtualHeight, 0, -1, 1);
        
        console.log('Canvas setup:', {
            styleSize: `${this.virtualWidth}x${this.virtualHeight}`,
            actualSize: `${this.canvas.width}x${this.canvas.height}`,
            viewport: `${this.canvas.width}x${this.canvas.height}`,
            dpr: dpr
        });
    }
    
    ortho(l, r, b, t, n, f) {
        // Standard orthographic projection matrix (column-major)
        // Maps from world coordinates to clip space [-1, 1]
        const rl = r - l;
        const tb = t - b;
        const fn = f - n;
        return new Float32Array([
            2.0 / rl, 0.0, 0.0, 0.0,
            0.0, 2.0 / tb, 0.0, 0.0,
            0.0, 0.0, -2.0 / fn, 0.0,
            -(r + l) / rl, -(t + b) / tb, -(f + n) / fn, 1.0
        ]);
    }
    
    setupShaders() {
        const vs = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            uniform mat4 u_projection;
            uniform mat4 u_transform;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = u_projection * u_transform * vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
        const fs = `
            precision mediump float;
            uniform vec3 u_color;
            uniform float u_alpha;
            uniform float u_glow;
            uniform float u_outline;
            varying vec2 v_texCoord;
            
            void main() {
                vec2 coord = v_texCoord;
                vec3 color = u_color;
                
                float dist = length(coord - vec2(0.5));
                float shade = 1.0 - dist * 0.3;
                color *= shade;
                
                float edge = min(min(coord.x, 1.0 - coord.x), min(coord.y, 1.0 - coord.y));
                if (edge < u_outline) {
                    color = mix(color * 0.3, color, edge / u_outline);
                }
                
                if (u_glow > 0.0) {
                    float glowDist = length(coord - vec2(0.5));
                    float glow = 1.0 - smoothstep(0.3, 0.7, glowDist);
                    color += vec3(u_glow * glow * 0.5);
                }
                
                gl_FragColor = vec4(color / 255.0, u_alpha);
            }
        `;
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vs);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fs);
        if (!vertexShader || !fragmentShader) {
            throw new Error('Failed to compile shaders');
        }
        this.program = this.createProgram(vertexShader, fragmentShader);
        if (!this.program) {
            throw new Error('Failed to create program');
        }
        this.gl.useProgram(this.program);
    }
    
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const info = this.gl.getShaderInfoLog(shader);
            console.error('Shader compilation error:', info);
            console.error('Shader source:', source.substring(0, 200));
            this.gl.deleteShader(shader);
            return null;
        }
        const info = this.gl.getShaderInfoLog(shader);
        if (info) {
            console.warn('Shader info:', info);
        }
        return shader;
    }
    
    createProgram(vs, fs) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vs);
        this.gl.attachShader(program, fs);
        this.gl.linkProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            const info = this.gl.getProgramInfoLog(program);
            console.error('Program link error:', info);
            this.gl.deleteProgram(program);
            return null;
        }
        // Validate program
        this.gl.validateProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.VALIDATE_STATUS)) {
            const info = this.gl.getProgramInfoLog(program);
            console.error('Program validation error:', info);
        }
        return program;
    }
    
    setupBuffers() {
        const positions = new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]);
        const texCoords = new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]);
        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
        this.texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);
    }
    
    setupUniforms() {
        this.aPos = this.gl.getAttribLocation(this.program, 'a_position');
        this.aTex = this.gl.getAttribLocation(this.program, 'a_texCoord');
        this.uProjection = this.gl.getUniformLocation(this.program, 'u_projection');
        this.uTransform = this.gl.getUniformLocation(this.program, 'u_transform');
        this.uColor = this.gl.getUniformLocation(this.program, 'u_color');
        this.uAlpha = this.gl.getUniformLocation(this.program, 'u_alpha');
        this.uGlow = this.gl.getUniformLocation(this.program, 'u_glow');
        this.uOutline = this.gl.getUniformLocation(this.program, 'u_outline');
        
        if (this.aPos === -1 || this.aTex === -1) {
            console.error('Failed to get attribute locations - aPos:', this.aPos, 'aTex:', this.aTex);
        }
        if (!this.uProjection || !this.uTransform || !this.uColor || !this.uAlpha) {
            console.error('Failed to get uniform locations');
        }
    }
    
    clear() {
        // Set viewport every frame to ensure it's correct
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        // Don't clear depth buffer - we're not using it
    }
    
    drawBlock(x, y, color, alpha = 1.0, glow = 0.0) {
        if (this.aPos === -1 || this.aTex === -1 || !this.program) {
            console.error('drawBlock: Invalid program or attributes', { aPos: this.aPos, aTex: this.aTex, program: !!this.program });
            return;
        }
        
        // Use program
        this.gl.useProgram(this.program);
        
        // Set viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Enable blending
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.gl.disable(this.gl.DEPTH_TEST);
        this.gl.disable(this.gl.CULL_FACE);
        
        // Bind position buffer and set attribute FIRST
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.enableVertexAttribArray(this.aPos);
        this.gl.vertexAttribPointer(this.aPos, 2, this.gl.FLOAT, false, 0, 0);
        
        // Bind texCoord buffer and set attribute
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.enableVertexAttribArray(this.aTex);
        this.gl.vertexAttribPointer(this.aTex, 2, this.gl.FLOAT, false, 0, 0);
        
        // Create transform matrix: scale by CELL_SIZE, translate by (x, y)
        const transform = new Float32Array([
            CELL_SIZE, 0, 0, 0,
            0, CELL_SIZE, 0, 0,
            0, 0, 1, 0,
            x, y, 0, 1
        ]);
        
        // Set uniforms - check if they exist
        if (!this.uProjection || !this.uTransform || !this.uColor) {
            console.error('drawBlock: Missing uniform locations', {
                uProjection: !!this.uProjection,
                uTransform: !!this.uTransform,
                uColor: !!this.uColor
            });
            return;
        }
        
        this.gl.uniformMatrix4fv(this.uProjection, false, this.projectionMatrix);
        this.gl.uniformMatrix4fv(this.uTransform, false, transform);
        this.gl.uniform3fv(this.uColor, new Float32Array(color));
        this.gl.uniform1f(this.uAlpha, alpha);
        this.gl.uniform1f(this.uGlow, glow);
        this.gl.uniform1f(this.uOutline, 0.05);
        
        // Draw
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
        
        // Check for errors
        const error = this.gl.getError();
        if (error !== this.gl.NO_ERROR && error !== 0) {
            console.error('WebGL error in drawBlock:', error, 'at', x, y);
        }
    }
    
    drawBoard(board, clearedLines = []) {
        for (let y = 0; y < BOARD_HEIGHT; y++) {
            const isCleared = clearedLines.includes(y);
            for (let x = 0; x < BOARD_WIDTH; x++) {
                const cell = board[y][x];
                if (cell) {
                    this.drawBlock(x * CELL_SIZE, y * CELL_SIZE, cell, isCleared ? 0.5 : 1.0);
                }
            }
        }
    }
    
    drawPiece(piece, x, y, alpha = 1.0, glow = 0.3) {
        const shape = piece.getShape();
        const color = piece.color;
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    this.drawBlock((x + px) * CELL_SIZE, (y + py) * CELL_SIZE, color, alpha, glow);
                }
            }
        }
    }
    
    drawGhost(piece, x, y) {
        const shape = piece.getShape();
        const color = piece.color;
        this.gl.uniform1f(this.uOutline, 0.15);
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    this.drawBlock((x + px) * CELL_SIZE, (y + py) * CELL_SIZE, color, 0.2, 0.0);
                }
            }
        }
        this.gl.uniform1f(this.uOutline, 0.05);
    }
}

class Board {
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
        // Return indices before clearing for animation
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

class Piece {
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

class BagRandomizer {
    constructor() {
        this.bag = [];
        this.refillBag();
    }
    
    refillBag() {
        const pieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        for (let i = pieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
        }
        this.bag = pieces;
    }
    
    next() {
        if (this.bag.length === 0) this.refillBag();
        return this.bag.shift();
    }
}

class InputManager {
    constructor() {
        this.keys = new Map(); // Currently pressed keys
        this.justPressed = new Map(); // Keys that were just pressed (reset after being read)
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            const key = this.normalizeKey(e.key);
            if (key && !this.keys.has(key)) {
                // Key was just pressed (not held)
                this.keys.set(key, true);
                this.justPressed.set(key, true);
            }
            if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => {
            const key = this.normalizeKey(e.key);
            if (key) {
                this.keys.delete(key);
                this.justPressed.delete(key);
            }
        });
    }
    
    normalizeKey(key) {
        const map = {
            'ArrowLeft': 'left', 'a': 'left', 'A': 'left',
            'ArrowRight': 'right', 'd': 'right', 'D': 'right',
            'ArrowDown': 'down',
            ' ': 'space',
            'ArrowUp': 'rotate', 'w': 'rotate', 'W': 'rotate',
            'p': 'pause', 'P': 'pause',
            'm': 'mute', 'M': 'mute'
        };
        return map[key];
    }
    
    // Check if key is currently held down
    isPressed(key) {
        return this.keys.has(key);
    }
    
    // Check if key was just pressed (only true once per press, until released)
    isJustPressed(key) {
        if (this.justPressed.has(key)) {
            this.justPressed.delete(key); // Consume the "just pressed" state
            return true;
        }
        return false;
    }
}

class AudioManager {
    constructor() {
        this.audioContext = null;
        this.muted = false;
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }
    
    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }
    
    playTone(freq, dur, type = 'sine', vol = 0.1) {
        if (this.muted || !this.audioContext) return;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(vol, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + dur);
        osc.start(this.audioContext.currentTime);
        osc.stop(this.audioContext.currentTime + dur);
    }
    
    playMove() { this.playTone(200, 0.05, 'square', 0.05); }
    playRotate() { this.playTone(300, 0.08, 'square', 0.08); }
    playHardDrop() {
        this.playTone(150, 0.1, 'square', 0.15);
        this.playTone(100, 0.15, 'square', 0.1);
    }
    playLineClear(lines) {
        const freq = [200, 250, 300, 350][Math.min(lines - 1, 3)];
        this.playTone(freq, 0.2, 'square', 0.2);
        this.playTone(freq * 1.5, 0.15, 'square', 0.15);
    }
    playLevelUp() {
        this.playTone(400, 0.1, 'sine', 0.2);
        this.playTone(500, 0.1, 'sine', 0.2);
        this.playTone(600, 0.2, 'sine', 0.2);
    }
    playGameOver() {
        this.playTone(150, 0.3, 'sawtooth', 0.3);
        setTimeout(() => this.playTone(100, 0.5, 'sawtooth', 0.3), 200);
    }
}

class HapticsManager {
    constructor() {
        this.supported = 'vibrate' in navigator;
    }
    
    vibrate(pattern) {
        if (!this.supported) return;
        try {
            navigator.vibrate(pattern);
        } catch (e) {}
    }
    
    hardDrop() { this.vibrate(30); }
    lineClear(lines) {
        if (lines === 4) this.vibrate([50, 20, 50]);
        else this.vibrate(30);
    }
    gameOver() { this.vibrate([100, 50, 100, 50, 200]); }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.nextCanvas = document.getElementById('nextCanvas');
        this.renderer = new Renderer(this.canvas);
        // Setup next canvas with smaller size (4x4 blocks)
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
        // Initialize next piece for preview (even in menu)
        this.nextPiece = new Piece(this.randomizer.next());
        // Don't spawn current piece in menu state
        if (this.gameState === 'playing') {
            this.spawnPiece();
        }
        
        // Verify WebGL setup
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
        
        // Add click to start on overlay (with debounce)
        const overlay = document.getElementById('gameOverlay');
        let clickTimeout = null;
        overlay.addEventListener('click', () => {
            if (clickTimeout) return; // Prevent rapid clicks
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
        
        // Use isJustPressed for all actions - each key press only triggers once
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
        // Get lines to clear before clearing
        const linesToClear = [];
        for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
            if (this.board.grid[y].every(cell => cell !== 0)) {
                linesToClear.push(y);
            }
        }
        
        if (linesToClear.length > 0) {
            // Store cleared lines data for animation (before clearing)
            this.clearedLines = linesToClear;
            this.clearedLinesData = linesToClear.map(y => [...this.board.grid[y]]);
            this.clearAnimationTime = 0;
            
            // Actually clear the lines
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
        
        // Draw board
        this.renderer.drawBoard(this.board.grid, []);
        
        // Draw cleared lines animation if active
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
        
        // Draw current piece if playing
        if (this.gameState === 'playing' && this.currentPiece) {
            // Draw ghost piece first (behind current piece)
            const ghostY = this.board.getGhostY(this.currentPiece, this.pieceX, this.pieceY);
            if (ghostY !== this.pieceY) {
                this.renderer.drawGhost(this.currentPiece, this.pieceX, ghostY);
            }
            // Draw current piece
            this.renderer.drawPiece(this.currentPiece, this.pieceX, this.pieceY, 1.0, 0.3);
        }
        
        // Always draw next piece (even in menu) - draw every frame
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
        // Prevent multiple rapid starts
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
        // Keep next piece if it exists, otherwise create one
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
            return; // Don't start if explicitly stopped
        }
        let lastTime = performance.now();
        const loop = (currentTime) => {
            if (!this.gameLoopRunning && this.gameLoopRunning !== undefined) {
                return; // Stop if paused
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

window.addEventListener('DOMContentLoaded', () => {
    try {
        const game = new Game();
        console.log('Tetris game initialized successfully!');
    } catch (error) {
        console.error('Error initializing game:', error);
        alert('Failed to initialize game. Please check the browser console for details.\n\nError: ' + error.message);
    }
});

