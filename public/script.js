/**
 * Multiplayer Game Script
 * Handles client-side rendering, user input, and communication with the server via Socket.IO.
 */

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

let mapWidth = 1000; // Default value, will be updated from server
let mapHeight = 1000; // Default value, will be updated from server

// Set canvas dimensions to window size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Handle window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (imagesLoaded === totalImages) {
        drawGame();
    }
});

// Player movement variables
let mouseX = 0;
let mouseY = 0;
let isMouseInside = false;
const MAX_SPEED = 5; // Maximum movement speed (pixels per frame)
const SPEED_THRESHOLD = 100; // Distance threshold (pixels)

let players = {};
let particles = [];

// Image Assets
const holeImages = [];
const planetImages = [];
let backgroundImage = new Image();
let imagesLoaded = 0;
const totalImages = 3 + 35 + 1; // holes + planets + background

// Load Hole Images
for (let i = 1; i <= 3; i++) {
    const img = new Image();
    img.onload = () => {
        imagesLoaded++;
        checkAllImagesLoaded();
    };
    img.src = `/images/hole${i}.png`;
    holeImages.push(img);
}

// Load Planet Images
for (let i = 1; i <= 35; i++) {
    const img = new Image();
    img.onload = () => {
        imagesLoaded++;
        checkAllImagesLoaded();
    };
    img.src = `/images/planet${i}.png`;
    planetImages.push(img);
}

// Load Background Image
backgroundImage.onload = () => {
    imagesLoaded++;
    checkAllImagesLoaded();
};
backgroundImage.src = '/images/background.png';

// Function to check if all images are loaded
function checkAllImagesLoaded() {
    if (imagesLoaded === totalImages) {
        gameLoop();
    }
}

// Play Button Event Listener
playButton.addEventListener('click', () => {
    const nameInput = document.getElementById('playerName');
    playerName = nameInput.value.trim() || 'Un Un Un';
    socket.emit('newPlayer', playerName);
    menu.style.display = 'none';
    canvas.style.display = 'block';
    leaderboard.style.display = 'block';
    chatBox.style.display = 'flex';
});

// Mouse Enter and Leave Event Listeners
canvas.addEventListener('mouseenter', () => {
    isMouseInside = true;
});

canvas.addEventListener('mouseleave', () => {
    isMouseInside = false;
    // Reset mouse position to center to stop movement when mouse leaves
    mouseX = canvas.width / 2;
    mouseY = canvas.height / 2;
});

// Mouse Move Event Listener
canvas.addEventListener('mousemove', (e) => {
    if (isMouseInside) {
        const rect = canvas.getBoundingClientRect();
        // Calculate mouse position relative to the canvas
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    }
});

// Chat Input Event Listener
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
        const message = chatInput.value.trim();
        socket.emit('chatMessage', { name: playerName, message });
        chatInput.value = '';
    }
});

// Socket Event Listeners

// Receive map size from server
socket.on('mapSize', ({ width, height }) => {
    mapWidth = width;
    mapHeight = height;
    // Optionally, adjust background image or other elements based on new map size
    drawGame();
});

// Receive chat messages
socket.on('chatMessage', ({ name, message }) => {
    const timestamp = new Date().toLocaleTimeString();
    const chatEntry = document.createElement('div');
    chatEntry.textContent = `[${timestamp}] ${name}: ${message}`;
    chatLog.appendChild(chatEntry);
    chatLog.scrollTop = chatLog.scrollHeight;
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

// Handle player death
socket.on('playerDied', (name) => {
    document.getElementById('playerName').value = name;
    menu.style.display = 'flex';
    canvas.style.display = 'none';
    leaderboard.style.display = 'none';
    chatBox.style.display = 'none';
});

// Handle particle absorption animation
socket.on('particleAbsorb', ({ particleX, particleY, playerX, playerY }) => {
    const startTime = performance.now();
    const duration = 50; // Animation duration in ms

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

// Drawing Function
function drawGame(absorbingParticleX = null, absorbingParticleY = null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const player = players[socket.id];
    if (!player) return;

    const offsetX = canvas.width / 2 - player.x;
    const offsetY = canvas.height / 2 - player.y;

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Draw Background Image
    ctx.drawImage(backgroundImage, 0, 0, mapWidth, mapHeight);

    // Draw Map Boundary
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, mapWidth, mapHeight);

    // Draw Particles with Variable Sizes
    particles.forEach(({ x, y, planetNumber, sizeMultiplier }) => {
        const baseSize = 10; // Base size in pixels
        const size = baseSize * sizeMultiplier; // Scale size based on sizeMultiplier
        ctx.drawImage(
            planetImages[planetNumber - 1],
            x - size / 2,
            y - size / 2,
            size,
            size
        );
    });

    // Draw Absorbing Particle
    if (absorbingParticleX !== null && absorbingParticleY !== null) {
        const baseSize = 10;
        const size = baseSize * 1; // Default size for absorbing particle
        ctx.drawImage(
            planetImages[0],
            absorbingParticleX - size / 2,
            absorbingParticleY - size / 2,
            size,
            size
        );
    }

    // Draw Players
    for (const id in players) {
        const p = players[id];
        const size = p.size * 2;
        ctx.drawImage(
            holeImages[p.holeNumber - 1],
            p.x - size / 2,
            p.y - size / 2,
            size,
            size
        );

        // Draw Player Name
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(p.name, p.x - 10, p.y - size / 2 - 5);
    }

    ctx.restore();
}

// Game Loop
function gameLoop() {
    const player = players[socket.id];
    if (player) {
        // Calculate direction vector from player to mouse position
        const dx = mouseX - canvas.width / 2;
        const dy = mouseY - canvas.height / 2;
        const distance = Math.sqrt(dx * dx + dy * dy);

        let moveX = 0;
        let moveY = 0;

        if (distance >= SPEED_THRESHOLD) {
            // Mouse is beyond the threshold; set movement to MAX_SPEED
            const normX = dx / distance;
            const normY = dy / distance;
            moveX = normX * MAX_SPEED;
            moveY = normY * MAX_SPEED;
        } else if (distance > 0) {
            // Mouse is within the threshold; scale speed proportionally
            const normX = dx / distance;
            const normY = dy / distance;
            const speed = (distance / SPEED_THRESHOLD) * MAX_SPEED;
            moveX = normX * speed;
            moveY = normY * speed;
        }

        // Emit move event with calculated dx and dy
        socket.emit('move', { dx: moveX, dy: moveY });
    }

    drawGame();
    requestAnimationFrame(gameLoop);
}
