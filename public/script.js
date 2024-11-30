// public/script.js

/**
 * Multiplayer Game Client-Side Script
 * Handles rendering, player input via keyboard, and communication with the server.
 */

const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Resize canvas
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Grid settings
const GRID_SIZE = 50;

// Track all players
let players = {};

// Resource map
let resourceMap = [];

// Player movement keys (Arrow keys and WASD)
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    a: false,
    s: false,
    d: false
};

// Handle keydown and keyup
window.addEventListener('keydown', (e) => {
    if (e.key in keys) {
        keys[e.key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key in keys) {
        keys[e.key] = false;
    }
});

// Receive resource map from server
socket.on('resourceMap', (serverResourceMap) => {
    resourceMap = serverResourceMap;
});

// Receive updated players from server
socket.on('updatePlayers', (serverPlayers) => {
    players = serverPlayers;
});

// Listen for elimination event
socket.on('eliminated', () => {
    alert('You have been eliminated!');
    window.location.reload();
});

// Handle player interactions with resources
function handleResources() {
    const player = players[socket.id];
    if (player) {
        const gridX = Math.floor(player.x / GRID_SIZE);
        const gridY = Math.floor(player.y / GRID_SIZE);
        if (resourceMap[gridX] && resourceMap[gridX][gridY]) {
            const material = resourceMap[gridX][gridY];
            if (material === 'dirt') {
                socket.emit('collectResource', { x: player.x, y: player.y });
            }
            // Removed handling for 'lava' as it's no longer present
        }
    }
}

// Update movement data based on keyboard input
function updateMovement() {
    const player = players[socket.id];
    if (player) {
        let dx = 0;
        let dy = 0;
        const speed = 5; // Base movement speed

        // Arrow keys and WASD
        if (keys.ArrowUp || keys.w) dy -= speed;
        if (keys.ArrowDown || keys.s) dy += speed;
        if (keys.ArrowLeft || keys.a) dx -= speed;
        if (keys.ArrowRight || keys.d) dx += speed;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            dx *= Math.SQRT1_2;
            dy *= Math.SQRT1_2;
        }

        // Update player position
        player.x += dx;
        player.y += dy;

        // Emit updated position to server
        socket.emit('move', { x: player.x, y: player.y });
    }
}

// Game loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw resource map
    for (let x = 0; x < resourceMap.length; x++) {
        for (let y = 0; y < resourceMap[x].length; y++) {
            const material = resourceMap[x][y];
            if (material === 'dirt') {
                ctx.fillStyle = 'brown'; // Representing dirt
                ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            }
        }
    }

    // Draw players
    for (const id in players) {
        const player = players[id];
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Handle movement and resources
    updateMovement();
    handleResources();

    requestAnimationFrame(gameLoop);
}

gameLoop();
