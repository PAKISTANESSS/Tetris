import { Game } from './game.js';

// Initialize game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    try {
        const game = new Game();
    } catch (error) {
        alert('Failed to initialize game.\n\nError: ' + error.message);
    }
});

