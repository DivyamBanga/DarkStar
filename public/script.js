// public/script.js

/**
 * Multiplayer Game Client-Side Script
 * Handles rendering, player input, and communication with the server.
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

// Track cursor position and button states
let cursor = { x: canvas.width / 2, y: canvas.height / 2 };
let isAccelerating = false;
let isBraking = false;

// Handle mouse movement
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    cursor.x = e.clientX - rect.left;
    cursor.y = e.clientY - rect.top;
});

// Handle mouse button presses
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left button
        isAccelerating = true;
    } else if (e.button === 2) { // Right button
        isBraking = true;
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) { // Left button
        isAccelerating = false;
    } else if (e.button === 2) { // Right button
        isBraking = false;
    }
});

// Prevent context menu on right-click
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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
            if (material === 'resource') {
                socket.emit('collectResource', { x: player.x, y: player.y });
            } else if (material === 'lava') {
                // Health reduction is handled server-side
            }
        }
    }
}

// Update movement data
function updateMovement() {
    const player = players[socket.id];
    if (player) {
        const dx = cursor.x - player.x;
        const dy = cursor.y - player.y;
        const distance = Math.hypot(dx, dy);
        const direction = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
        
        // Set base speed
        let speed = 2;
        
        if (isAccelerating) {
            speed += 3; // Accelerate
        }
        if (isBraking) {
            speed = Math.max(speed - 3, 1); // Brake
        }
        
        // Update player position
        player.x += direction.x * speed;
        player.y += direction.y * speed;
        
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
            if (material === 'resource') {
                ctx.fillStyle = 'green';
                ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            } else if (material === 'lava') {
                ctx.fillStyle = 'red';
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
