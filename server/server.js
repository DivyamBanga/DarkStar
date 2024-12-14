/**
 * Multiplayer Game Server
 * Handles client connections, game state management, and real-time communication via Socket.IO.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve Static Files
app.use(express.static('public'));

// Game State
const players = {};
let particles = [];

// Constants
const MAX_SPEED = 5; // Maximum movement speed (pixels per frame)

// Map Size Configuration
const MAP_WIDTH = 1000; // Adjustable map width
const MAP_HEIGHT = 1000; // Adjustable map height

// Utility Functions
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function spawnParticle() {
    const sizeMultiplier = Math.ceil(Math.random() * 3); // 1, 2, or 3
    const planetNumber = Math.floor(Math.random() * 35) + 1;
    const points = Math.ceil(Math.random() * 3); // 1, 2, or 3 points

    return {
        x: Math.random() * MAP_WIDTH,
        y: Math.random() * MAP_HEIGHT,
        sizeMultiplier, // Determines visual size on client-side
        points,          // Points awarded upon absorption
        planetNumber
    };
}

// Spawn Particles at Intervals
setInterval(() => {
    if (particles.length < 100) particles.push(spawnParticle());
}, 500);

// Handle Socket Connections
io.on('connection', (socket) => {
    // Send map size to the newly connected client
    socket.emit('mapSize', { width: MAP_WIDTH, height: MAP_HEIGHT });

    // New Player Joins
    socket.on('newPlayer', (name) => {
        players[socket.id] = {
            x: Math.random() * MAP_WIDTH,
            y: Math.random() * MAP_HEIGHT,
            size: 10,
            color: getRandomColor(),
            name,
            holeNumber: Math.floor(Math.random() * 3) + 1,
            vx: 0, // Velocity in x-direction
            vy: 0  // Velocity in y-direction
        };
        socket.emit('updateParticles', particles);
        io.emit('updatePlayers', players);
    });

    // Player Movement
    socket.on('move', (data) => {
        const player = players[socket.id];
        if (player) {
            let { dx, dy } = data;

            // Calculate the intended speed
            const intendedSpeed = Math.sqrt(dx * dx + dy * dy);

            if (intendedSpeed > MAX_SPEED) {
                // Scale dx and dy to enforce maximum speed
                const scale = MAX_SPEED / intendedSpeed;
                dx *= scale;
                dy *= scale;
            }

            // Update Player Position based on validated movement
            player.x += dx;
            player.y += dy;

            // Ensure player stays within bounds
            player.x = Math.min(MAP_WIDTH, Math.max(0, player.x));
            player.y = Math.min(MAP_HEIGHT, Math.max(0, player.y));

            // Handle Particle Attraction and Absorption
            particles = particles.filter(particle => {
                const pdx = player.x - particle.x;
                const pdy = player.y - particle.y;
                const dist = Math.sqrt(pdx * pdx + pdy * pdy);
                const attractionRadius = player.size + 15;

                if (dist < attractionRadius) {
                    // Move particle towards player
                    const angle = Math.atan2(pdy, pdx);
                    const attractionSpeed = 2; // Pixels per update
                    particle.x += Math.cos(angle) * attractionSpeed;
                    particle.y += Math.sin(angle) * attractionSpeed;

                    // Check if particle is absorbed
                    const newDist = Math.sqrt((player.x - particle.x) ** 2 + (player.y - particle.y) ** 2);
                    if (newDist < player.size) {
                        player.size += particle.points;
                        io.to(socket.id).emit('particleAbsorb', {
                            particleX: particle.x,
                            particleY: particle.y,
                            playerX: player.x,
                            playerY: player.y
                        });
                        return false; // Remove particle
                    }
                }
                return true; // Keep particle
            });

            // Handle Player Collisions with Smooth Knockback
            for (const id1 in players) {
                const p1 = players[id1];
                for (const id2 in players) {
                    if (id1 === id2) continue;
                    const p2 = players[id2];
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < p1.size + p2.size && dist > 0) {
                        // Both players lose size
                        p1.size -= 2;
                        p2.size -= 2;

                        // Ensure they don't go negative
                        if (p1.size <= 0) {
                            io.to(id1).emit('playerDied', p1.name);
                            delete players[id1];
                            continue;
                        }
                        if (p2.size <= 0) {
                            io.to(id2).emit('playerDied', p2.name);
                            delete players[id2];
                            continue;
                        }

                        // Calculate knockback using mass (mass ~ size)
                        const nx = dx / dist;
                        const ny = dy / dist;

                        // Impulse strength
                        const force = 5;
                        const mass1 = p1.size;
                        const mass2 = p2.size;
                        const totalMass = mass1 + mass2;

                        // Velocity changes inversely proportional to size (mass)
                        const impulse1 = (force * (mass2 / totalMass));
                        const impulse2 = (force * (mass1 / totalMass));

                        // Apply impulses in opposite directions
                        p1.vx -= nx * impulse1;
                        p1.vy -= ny * impulse1;
                        p2.vx += nx * impulse2;
                        p2.vy += ny * impulse2;
                    }
                }
            }

            // Apply Velocity and Friction
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

            // Emit updated game state
            io.emit('updatePlayers', players);
            io.emit('updateParticles', particles);

            // Update Leaderboard
            const leaderboardData = Object.values(players)
                .sort((a, b) => b.size - a.size)
                .map(p => ({ name: p.name, size: p.size }));
            io.emit('leaderboard', leaderboardData);
        }
    });

    // Handle Chat Messages
    socket.on('chatMessage', (msg) => {
        io.emit('chatMessage', msg);
    });

    // Handle Player Disconnection
    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

// Start Server
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
