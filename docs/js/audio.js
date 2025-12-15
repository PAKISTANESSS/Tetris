/**
 * Audio Manager
 * Handles procedural sound effects using Web Audio API
 * Persists mute state in localStorage
 */
export class AudioManager {
    constructor() {
        this.audioContext = null;
        // Load mute state from localStorage (default to false if not set)
        const savedMuteState = localStorage.getItem('tetris_muted');
        this.muted = savedMuteState === 'true';
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            // Web Audio API not supported
        }
    }
    
    toggleMute() {
        this.muted = !this.muted;
        // Save mute state to localStorage
        localStorage.setItem('tetris_muted', this.muted.toString());
        return this.muted;
    }
    
    isMuted() {
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

