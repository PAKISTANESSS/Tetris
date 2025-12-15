import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, CELL_SIZE, BOARD_WIDTH, BOARD_HEIGHT } from './constants.js';

/**
 * WebGL Renderer for Tetris game
 * Handles all WebGL rendering operations including shaders, buffers, and drawing
 */
export class Renderer {
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
        
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.projectionMatrix = this.ortho(0, this.virtualWidth, this.virtualHeight, 0, -1, 1);
    }
    
    ortho(l, r, b, t, n, f) {
        // Standard orthographic projection matrix (column-major)
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
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
    
    createProgram(vs, fs) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vs);
        this.gl.attachShader(program, fs);
        this.gl.linkProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            this.gl.deleteProgram(program);
            return null;
        }
        this.gl.validateProgram(program);
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
    }
    
    clear() {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
    
    drawBlock(x, y, color, alpha = 1.0, glow = 0.0) {
        if (this.aPos === -1 || this.aTex === -1 || !this.program) {
            return;
        }
        
        this.gl.useProgram(this.program);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.gl.disable(this.gl.DEPTH_TEST);
        this.gl.disable(this.gl.CULL_FACE);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.enableVertexAttribArray(this.aPos);
        this.gl.vertexAttribPointer(this.aPos, 2, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.enableVertexAttribArray(this.aTex);
        this.gl.vertexAttribPointer(this.aTex, 2, this.gl.FLOAT, false, 0, 0);
        
        const transform = new Float32Array([
            CELL_SIZE, 0, 0, 0,
            0, CELL_SIZE, 0, 0,
            0, 0, 1, 0,
            x, y, 0, 1
        ]);
        
        if (!this.uProjection || !this.uTransform || !this.uColor) {
            return;
        }
        
        this.gl.uniformMatrix4fv(this.uProjection, false, this.projectionMatrix);
        this.gl.uniformMatrix4fv(this.uTransform, false, transform);
        this.gl.uniform3fv(this.uColor, new Float32Array(color));
        this.gl.uniform1f(this.uAlpha, alpha);
        this.gl.uniform1f(this.uGlow, glow);
        this.gl.uniform1f(this.uOutline, 0.05);
        
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
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

