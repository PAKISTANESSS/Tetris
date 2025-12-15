/**
 * Haptics Manager
 * Handles vibration feedback for mobile devices
 */
export class HapticsManager {
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

