/**
 * 7-Bag Randomizer
 * Ensures fair piece distribution using the standard Tetris randomizer
 */
export class BagRandomizer {
    constructor() {
        this.bag = [];
        this.refillBag();
    }
    
    refillBag() {
        const pieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        // Fisher-Yates shuffle
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

