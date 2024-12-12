const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {};
let particles = [];

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function spawnParticle() {
    return { x: Math.random() * 1000, y: Math.random() * 1000 };
}

setInterval(() => {
    if (particles.length < 100) particles.push(spawnParticle());
}, 1000);

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('newPlayer', (name) => {
        players[socket.id] = { x: Math.random() * 1000, y: Math.random() * 1000, size: 10, color: getRandomColor(), name };
        socket.emit('updateParticles', particles);
        io.emit('updatePlayers', players);
    });

    socket.on('move', (data) => {
        const player = players[socket.id];
        if (player) {
            player.x = Math.min(1000, Math.max(0, player.x + data.dx));
            player.y = Math.min(1000, Math.max(0, player.y + data.dy));

            particles.forEach((particle, index) => {
                const dx = player.x - particle.x;
                const dy = player.y - particle.y;
                if (Math.sqrt(dx * dx + dy * dy) < player.size) {
                    player.size += 1;
                    particles.splice(index, 1);
                }
            });

            io.emit('updatePlayers', players);
            io.emit('updateParticles', particles);

            // Emit leaderboard
            const leaderboardData = Object.values(players)
                .sort((a, b) => b.size - a.size)
                .map(p => ({ name: p.name, size: p.size }));
            io.emit('leaderboard', leaderboardData);
        }
    });

    socket.on('chatMessage', (msg) => {
        io.emit('chatMessage', msg);
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
        console.log(`Player disconnected: ${socket.id}`);
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
