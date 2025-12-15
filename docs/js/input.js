/**
 * Input Manager
 * Handles keyboard input with one-time key press detection
 */
export class InputManager {
    constructor() {
        this.keys = new Map(); // Currently pressed keys
        this.justPressed = new Map(); // Keys that were just pressed (reset after being read)
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            const key = this.normalizeKey(e.key);
            if (key && !this.keys.has(key)) {
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
    
    isPressed(key) {
        return this.keys.has(key);
    }
    
    isJustPressed(key) {
        if (this.justPressed.has(key)) {
            this.justPressed.delete(key); // Consume the "just pressed" state
            return true;
        }
        return false;
    }
}

