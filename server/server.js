// server/server.js
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
    const sizeMultiplier = Math.ceil(Math.random() * 3);
    const planetNumber = Math.floor(Math.random() * 35) + 1;
    return {
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        sizeMultiplier,
        points: sizeMultiplier,
        planetNumber
    };
}

setInterval(() => {
    if (particles.length < 100) particles.push(spawnParticle());
}, 500);

io.on('connection', (socket) => {
    socket.on('newPlayer', (name) => {
        players[socket.id] = {
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            size: 10,
            color: getRandomColor(),
            name,
            holeNumber: Math.floor(Math.random() * 3) + 1
        };
        socket.emit('updateParticles', particles);
        io.emit('updatePlayers', players);
    });

    socket.on('move', (data) => {
        const player = players[socket.id];
        if (player) {
            player.x = Math.min(1000, Math.max(0, player.x + data.dx));
            player.y = Math.min(1000, Math.max(0, player.y + data.dy));

            particles = particles.filter(particle => {
                const dx = player.x - particle.x;
                const dy = player.y - particle.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 50) {
                    player.size += particle.points;
                    io.to(socket.id).emit('particleAbsorb', {
                        particleX: particle.x,
                        particleY: particle.y,
                        playerX: player.x,
                        playerY: player.y
                    });
                    return false;
                }
                return true;
            });

            for (const id1 in players) {
                const p1 = players[id1];
                for (const id2 in players) {
                    if (id1 === id2) continue;
                    const p2 = players[id2];
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < p1.size + p2.size) {
                        p1.size -= 2;
                        p2.size -= 2;

                        const pushFactor = 2;
                        const nx = dx / dist;
                        const ny = dy / dist;
                        p1.x -= nx * pushFactor;
                        p1.y -= ny * pushFactor;
                        p2.x += nx * pushFactor;
                        p2.y += ny * pushFactor;

                        if (p1.size <= 0) {
                            io.to(id1).emit('playerDied', p1.name);
                            delete players[id1];
                        }
                        if (p2.size <= 0) {
                            io.to(id2).emit('playerDied', p2.name);
                            delete players[id2];
                        }
                    }
                }
            }

            io.emit('updatePlayers', players);
            io.emit('updateParticles', particles);

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
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
