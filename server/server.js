const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {};
let particles = [];

const MAX_SPEED = 5;
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 1000;
const REGEN = 1; // 1% per second

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
    const points = Math.ceil(Math.random() * 3);
    return {
        x: Math.random() * MAP_WIDTH,
        y: Math.random() * MAP_HEIGHT,
        sizeMultiplier,
        points,
        planetNumber
    };
}

setInterval(() => {
    if (particles.length < 100) particles.push(spawnParticle());
}, 500);

// Regen interval
setInterval(() => {
    for (const id in players) {
        const p = players[id];
        const regenAmount = p.maxHp * (REGEN / 100);
        p.hp = Math.min(p.hp + regenAmount, p.maxHp);
    }
    io.emit('updatePlayers', players);
}, 1000);

io.on('connection', (socket) => {
    socket.emit('mapSize', { width: MAP_WIDTH, height: MAP_HEIGHT });

    socket.on('newPlayer', (name) => {
        const initialSize = 10;
        const initialHp = initialSize * 10;
        players[socket.id] = {
            x: Math.random() * MAP_WIDTH,
            y: Math.random() * MAP_HEIGHT,
            size: initialSize,
            hp: initialHp,
            maxHp: initialHp,
            color: getRandomColor(),
            name,
            holeNumber: Math.floor(Math.random() * 3) + 1,
            vx: 0,
            vy: 0
        };
        socket.emit('updateParticles', particles);
        io.emit('updatePlayers', players);
    });

    socket.on('move', (data) => {
        const player = players[socket.id];
        if (player) {
            let { dx, dy } = data;
            const intendedSpeed = Math.sqrt(dx * dx + dy * dy);

            if (intendedSpeed > MAX_SPEED) {
                const scale = MAX_SPEED / intendedSpeed;
                dx *= scale;
                dy *= scale;
            }

            player.x += dx;
            player.y += dy;

            player.x = Math.min(MAP_WIDTH, Math.max(0, player.x));
            player.y = Math.min(MAP_HEIGHT, Math.max(0, player.y));

            particles = particles.filter(particle => {
                const pdx = player.x - particle.x;
                const pdy = player.y - particle.y;
                const dist = Math.sqrt(pdx * pdx + pdy * pdy);
                const attractionRadius = player.size + 15;

                if (dist < attractionRadius) {
                    const angle = Math.atan2(pdy, pdx);
                    const attractionSpeed = 2;
                    particle.x += Math.cos(angle) * attractionSpeed;
                    particle.y += Math.sin(angle) * attractionSpeed;

                    const newDist = Math.sqrt((player.x - particle.x) ** 2 + (player.y - particle.y) ** 2);
                    if (newDist < player.size) {
                        const oldRatio = player.hp / player.maxHp;
                        player.size += particle.points;
                        player.maxHp = Math.ceil(player.size * 10);
                        player.hp = oldRatio * player.maxHp;
                        player.hp = Math.min(player.hp + (particle.points * 5), player.maxHp);
                        io.to(socket.id).emit('particleAbsorb', {
                            particleX: particle.x,
                            particleY: particle.y,
                            playerX: player.x,
                            playerY: player.y
                        });
                        return false;
                    }
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

                    if (dist < p1.size + p2.size && dist > 0) {
                        const damageToP1 = Math.ceil(p2.size);
                        const damageToP2 = Math.ceil(p1.size);
                        p1.hp -= damageToP1;
                        p2.hp -= damageToP2;

                        if (p1.hp <= 0) {
                            io.to(id1).emit('playerDied', p1.name);
                            delete players[id1];
                            if (players[id2]) {
                                const killer = players[id2];
                                const oldRatio = killer.hp / killer.maxHp;
                                killer.size *= 1.1;
                                killer.maxHp = Math.ceil(killer.size * 10);
                                killer.hp = oldRatio * killer.maxHp;
                                killer.hp = Math.min(killer.hp + Math.ceil(killer.maxHp * 0.2), killer.maxHp);
                            }
                            continue;
                        }
                        if (p2.hp <= 0) {
                            io.to(id2).emit('playerDied', p2.name);
                            delete players[id2];
                            if (players[id1]) {
                                const killer = players[id1];
                                const oldRatio = killer.hp / killer.maxHp;
                                killer.size *= 1.1;
                                killer.maxHp = Math.ceil(killer.size * 10);
                                killer.hp = oldRatio * killer.maxHp;
                                killer.hp = Math.min(killer.hp + Math.ceil(killer.maxHp * 0.2), killer.maxHp);
                            }
                            continue;
                        }

                        const nx = dx / dist;
                        const ny = dy / dist;
                        const force = 5;
                        const mass1 = p1.size;
                        const mass2 = p2.size;
                        const totalMass = mass1 + mass2;

                        const impulse1 = (force * (mass2 / totalMass));
                        const impulse2 = (force * (mass1 / totalMass));

                        p1.vx -= nx * impulse1;
                        p1.vy -= ny * impulse1;
                        p2.vx += nx * impulse2;
                        p2.vy += ny * impulse2;
                    }
                }
            }

            const friction = 0.95;
            for (const id in players) {
                const p = players[id];
                if (typeof p.vx === 'number' && typeof p.vy === 'number') {
                    p.vx *= friction;
                    p.vy *= friction;
                    p.x += p.vx;
                    p.y += p.vy;
                    p.x = Math.max(0, Math.min(MAP_WIDTH, p.x));
                    p.y = Math.max(0, Math.min(MAP_HEIGHT, p.y));
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
