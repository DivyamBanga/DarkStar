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

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
let players = {};
let particles = [];

const playerImage = new Image();
playerImage.src = '/images/hole1.png';

const particleImage = new Image();
particleImage.src = '/images/planet1.png';

let imagesLoaded = 0;
const requiredImages = 2;

function startGameIfAllLoaded() {
    imagesLoaded++;
    if (imagesLoaded === requiredImages) {
        gameLoop();
    }
}

playerImage.onload = startGameIfAllLoaded;
particleImage.onload = startGameIfAllLoaded;

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

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
        const message = chatInput.value.trim();
        socket.emit('chatMessage', { name: playerName, message });
        chatInput.value = '';
    }
});

socket.on('chatMessage', ({ name, message }) => {
    const timestamp = new Date().toLocaleTimeString();
    const chatEntry = document.createElement('div');
    chatEntry.textContent = `[${timestamp}] ${name}: ${message}`;
    chatLog.appendChild(chatEntry);
    chatLog.scrollTop = chatLog.scrollHeight;
});

socket.on('updatePlayers', (serverPlayers) => {
    players = serverPlayers;
});

socket.on('updateParticles', (serverParticles) => {
    particles = serverParticles;
});

socket.on('leaderboard', (leaders) => {
    leaderboard.innerHTML = leaders
        .map(player => `<div><strong>${player.name}</strong>: ${player.size}</div>`)
        .join('');
});

socket.on('playerDied', (name) => {
    document.getElementById('playerName').value = name;
    menu.style.display = 'flex';
    canvas.style.display = 'none';
    leaderboard.style.display = 'none';
    chatBox.style.display = 'none';
});

socket.on('particleAbsorb', ({ particleX, particleY, playerX, playerY }) => {
    const startTime = performance.now();
    const duration = 50;

    function animate() {
        const now = performance.now();
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const currentX = particleX + (playerX - particleX) * t;
        const currentY = particleY + (playerY - particleY) * t;
        drawGame(currentX, currentY);
        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            drawGame();
        }
    }

    animate();
});

function drawGame(absorbingParticleX = null, absorbingParticleY = null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const player = players[socket.id];
    if (!player) return;

    const offsetX = canvas.width / 2 - player.x;
    const offsetY = canvas.height / 2 - player.y;

    ctx.save();
    ctx.translate(offsetX, offsetY);

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, mapWidth, mapHeight);

    particles.forEach(({ x, y }) => {
        ctx.drawImage(particleImage, x - 5, y - 5, 10, 10);
    });

    if (absorbingParticleX !== null && absorbingParticleY !== null) {
        ctx.drawImage(particleImage, absorbingParticleX - 5, absorbingParticleY - 5, 10, 10);
    }

    for (const id in players) {
        const p = players[id];
        const size = p.size * 2;
        ctx.drawImage(playerImage, p.x - size/2, p.y - size/2, size, size);

        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(p.name, p.x - 10, p.y - size/2 - 5);
    }

    ctx.restore();
}

function gameLoop() {
    drawGame();
    if (keys.ArrowUp) socket.emit('move', { dx: 0, dy: -3 });
    if (keys.ArrowDown) socket.emit('move', { dx: 0, dy: 3 });
    if (keys.ArrowLeft) socket.emit('move', { dx: -3, dy: 0 });
    if (keys.ArrowRight) socket.emit('move', { dx: 3, dy: 0 });
    requestAnimationFrame(gameLoop);
}