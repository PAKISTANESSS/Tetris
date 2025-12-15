import { Game } from './game.js';

// Initialize game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    try {
        const game = new Game();
        console.log('Tetris game initialized successfully!');
    } catch (error) {
        console.error('Error initializing game:', error);
        alert('Failed to initialize game. Please check the browser console for details.\n\nError: ' + error.message);
    }
});

