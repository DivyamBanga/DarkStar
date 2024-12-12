const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const playButton = document.getElementById('playButton');
const chatBox = document.getElementById('chatBox');
const chatLog = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
const leaderboard = document.getElementById('leaderboard');
let chatVisible = false;
let playerName = '';

const mapWidth = 1000;
const mapHeight = 1000;

// Resize canvas
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Player movement keys
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

// Track all players and particles
let players = {};
let particles = [];

// Handle menu play button
playButton.addEventListener('click', () => {
    const nameInput = document.getElementById('playerName');
    playerName = nameInput.value.trim();

    if (playerName) {
        socket.emit('newPlayer', playerName);
        menu.style.display = 'none';
        canvas.style.display = 'block';
        leaderboard.style.display = 'block';
    } else {
        alert('Please enter a name.');
    }
});

// Handle keydown and keyup
window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        chatVisible = !chatVisible;
        chatBox.style.display = chatVisible ? 'flex' : 'none';
        if (chatVisible) chatInput.focus();
    } else {
        keys[e.key] = true;
    }
});

window.addEventListener('keyup', (e) => { keys[e.key] = false; });

// Send message on Enter
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
        const message = chatInput.value.trim();
        socket.emit('chatMessage', { name: playerName, message });
        chatInput.value = ''; // Clear input field
    }
});

// Update chat log
socket.on('chatMessage', ({ name, message }) => {
    const timestamp = new Date().toLocaleTimeString();
    const chatEntry = document.createElement('div');
    chatEntry.textContent = `[${timestamp}] ${name}: ${message}`;
    chatLog.appendChild(chatEntry);
    chatLog.scrollTop = chatLog.scrollHeight; // Auto-scroll to bottom
});

// Update players
socket.on('updatePlayers', (serverPlayers) => {
    players = serverPlayers;
});

// Update particles
socket.on('updateParticles', (serverParticles) => {
    particles = serverParticles;
});

// Update leaderboard
socket.on('leaderboard', (leaders) => {
    leaderboard.innerHTML = leaders
        .map(player => `<div><strong>${player.name}</strong>: ${player.size}</div>`)
        .join('');
});

// Game loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const player = players[socket.id];
    if (!player) {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Center view on the player
    const offsetX = canvas.width / 2 - player.x;
    const offsetY = canvas.height / 2 - player.y;

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Draw map boundary
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, mapWidth, mapHeight);

    // Draw particles
    particles.forEach(({ x, y }) => {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'yellow';
        ctx.fill();
    });

    // Draw players
    for (const id in players) {
        const p = players[id];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Draw player name
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(p.name, p.x - 10, p.y - p.size - 5);
    }

    ctx.restore();

    // Send movement data with map boundaries
    if (keys.ArrowUp) socket.emit('move', { dx: 0, dy: -5 });
    if (keys.ArrowDown) socket.emit('move', { dx: 0, dy: 5 });
    if (keys.ArrowLeft) socket.emit('move', { dx: -5, dy: 0 });
    if (keys.ArrowRight) socket.emit('move', { dx: 5, dy: 0 });

    requestAnimationFrame(gameLoop);
}

gameLoop();
