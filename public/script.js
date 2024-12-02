const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const playButton = document.getElementById('playButton');
let playerName = '';

// Resize canvas
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Player movement keys
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

// Track all players
let players = {};

// Handle menu play button
playButton.addEventListener('click', () => {
    const nameInput = document.getElementById('playerName');
    playerName = nameInput.value.trim();

    if (playerName) {
        socket.emit('newPlayer', playerName);
        menu.style.display = 'none';
        canvas.style.display = 'block';
    } else {
        alert('Please enter a name.');
    }
});

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

        // Draw player name
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(player.name, player.x, player.y - 5);
    }

    // Send movement data with screen boundaries
    const player = players[socket.id];
    if (player) {
        if (keys.ArrowUp && player.y > 0) socket.emit('move', { dx: 0, dy: -5 });
        if (keys.ArrowDown && player.y < canvas.height - 20) socket.emit('move', { dx: 0, dy: 5 });
        if (keys.ArrowLeft && player.x > 0) socket.emit('move', { dx: -5, dy: 0 });
        if (keys.ArrowRight && player.x < canvas.width - 20) socket.emit('move', { dx: 5, dy: 0 });
    }

    requestAnimationFrame(gameLoop);
}

gameLoop();
