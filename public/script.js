const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const playButton = document.getElementById('playButton');
const chatBox = document.getElementById('chatBox');
const chatLog = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
const leaderboard = document.getElementById('leaderboard');
let playerName = '';

let mapWidth = 1000;
let mapHeight = 1000;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (imagesLoaded === totalImages) {
        drawGame();
    }
});

const backgroundCanvas = document.getElementById('backgroundCanvas');
const backgroundCtx = backgroundCanvas.getContext('2d');

function resizeCanvas() {
    backgroundCanvas.width = window.innerWidth;
    backgroundCanvas.height = window.innerHeight;
}
resizeCanvas();

const stars = Array.from({ length: 100 }, () => ({
    x: Math.random() * backgroundCanvas.width,
    y: Math.random() * backgroundCanvas.height,
    size: Math.random() * 2 + 1,
    speed: Math.random() * 0.5 + 0.1,
}));

const mouse = { x: null, y: null };
window.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
});

function drawStars() {
    backgroundCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
    for (const star of stars) {
        const dx = mouse.x - star.x || 0;
        const dy = mouse.y - star.y || 0;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 100) {
            star.x += dx * 0.02;
            star.y += dy * 0.02;
        }
        backgroundCtx.beginPath();
        backgroundCtx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        backgroundCtx.fillStyle = 'white';
        backgroundCtx.fill();
        star.y += star.speed;
        if (star.y > backgroundCanvas.height) star.y = 0;
    }
    requestAnimationFrame(drawStars);
}
drawStars();

let mouseX = 0;
let mouseY = 0;
let isMouseInside = false;

const SPEED_THRESHOLD = 100;
let players = {};
let particles = [];

const holeImages = [];
const planetImages = [];
let backgroundImage = new Image();
let imagesLoaded = 0;
const totalImages = 3 + 35 + 1;

for (let i = 1; i <= 3; i++) {
    const img = new Image();
    img.onload = () => {
        imagesLoaded++;
        checkAllImagesLoaded();
    };
    img.src = `/images/hole${i}.png`;
    holeImages.push(img);
}

for (let i = 1; i <= 35; i++) {
    const img = new Image();
    img.onload = () => {
        imagesLoaded++;
        checkAllImagesLoaded();
    };
    img.src = `/images/planet${i}.png`;
    planetImages.push(img);
}

backgroundImage.onload = () => {
    imagesLoaded++;
    checkAllImagesLoaded();
};
backgroundImage.src = '/images/background.png';

function checkAllImagesLoaded() {
    if (imagesLoaded === totalImages) {
        gameLoop();
    }
}

playButton.addEventListener('click', () => {
    const nameInput = document.getElementById('playerName');
    playerName = nameInput.value.trim() || 'Player';
    socket.emit('newPlayer', playerName);
    menu.style.display = 'none';
    canvas.style.display = 'block';
    leaderboard.style.display = 'block';
    chatBox.style.display = 'flex';
});

canvas.addEventListener('mouseenter', () => {
    isMouseInside = true;
});

canvas.addEventListener('mouseleave', () => {
    isMouseInside = false;
    mouseX = canvas.width / 2;
    mouseY = canvas.height / 2;
});

canvas.addEventListener('mousemove', (e) => {
    if (isMouseInside) {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    }
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
        const message = chatInput.value.trim();
        socket.emit('chatMessage', { name: playerName, message });
        chatInput.value = '';
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
        socket.emit('dash');
    }
});

socket.on('mapSize', ({ width, height }) => {
    mapWidth = width;
    mapHeight = height;
    drawGame();
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
        .map(player => `<div><strong>${player.name}</strong>: ${Math.round(player.size)}</div>`)
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
    ctx.drawImage(backgroundImage, 0, 0, mapWidth, mapHeight);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, mapWidth, mapHeight);

    particles.forEach(({ x, y, planetNumber, sizeMultiplier }) => {
        const baseSize = 10;
        const size = baseSize * sizeMultiplier;
        ctx.drawImage(
            planetImages[planetNumber - 1],
            x - size / 2,
            y - size / 2,
            size,
            size
        );
    });

    if (absorbingParticleX !== null && absorbingParticleY !== null) {
        const baseSize = 10;
        const size = baseSize;
        ctx.drawImage(
            planetImages[0],
            absorbingParticleX - size / 2,
            absorbingParticleY - size / 2,
            size,
            size
        );
    }

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

        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(p.name, p.x - 10, p.y - size / 2 - 5);

        if (p.hp < p.maxHp) {
            const barWidth = 40;
            const hpRatio = p.hp / p.maxHp;
            const currentHpWidth = barWidth * hpRatio;
            const barX = p.x - barWidth / 2;
            const barY = p.y + (size / 2) + 5;
            
            ctx.fillStyle = 'grey';
            ctx.fillRect(barX, barY, barWidth, 5);

            ctx.fillStyle = 'green';
            ctx.fillRect(barX, barY, currentHpWidth, 5);
        }
    }
    ctx.restore();
}

function gameLoop() {
    const player = players[socket.id];
    if (player) {
        const dx = mouseX - canvas.width / 2;
        const dy = mouseY - canvas.height / 2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const playerMaxSpeed = (player.isDashing ? 5 * (10 / player.size) * 2 : 5 * (10 / player.size));
        let moveX = 0;
        let moveY = 0;

        if (distance >= SPEED_THRESHOLD) {
            const normX = dx / distance;
            const normY = dy / distance;
            moveX = normX * playerMaxSpeed;
            moveY = normY * playerMaxSpeed;
        } else if (distance > 0) {
            const normX = dx / distance;
            const normY = dy / distance;
            const speed = (distance / SPEED_THRESHOLD) * playerMaxSpeed;
            moveX = normX * speed;
            moveY = normY * speed;
        }

        socket.emit('move', { dx: moveX, dy: moveY });
    }
    drawGame();
    requestAnimationFrame(gameLoop);
}
