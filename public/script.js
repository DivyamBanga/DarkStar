const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Resize canvas
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Player movement keys
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

// Track all players
let players = {};

// Handle keydown and keyup
window.addEventListener('keydown', (e) => { keys[e.key] = true; });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

// Update players from server
socket.on('updatePlayers', (serverPlayers) => {
    players = serverPlayers;
});

// Game loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw players
    for (const id in players) {
        const player = players[id];
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x, player.y, 20, 20);
    }

    // Send movement data
    if (keys.ArrowUp) socket.emit('move', { dx: 0, dy: -5 });
    if (keys.ArrowDown) socket.emit('move', { dx: 0, dy: 5 });
    if (keys.ArrowLeft) socket.emit('move', { dx: -5, dy: 0 });
    if (keys.ArrowRight) socket.emit('move', { dx: 5, dy: 0 });

    requestAnimationFrame(gameLoop);
}

gameLoop();
