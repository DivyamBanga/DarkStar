// server/server.js

/**
 * Multiplayer Game Server
 * Handles player connections, movements, resource management, and interactions.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Initialize server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static('public'));

// Define materials
const MATERIALS = {
    EMPTY: 'empty',
    DIRT: 'dirt' // Changed from 'resource' to 'dirt'
    // Removed other materials like 'resource' and 'lava'
};

// Initialize resource map (simple grid)
const GRID_SIZE = 50; // Size of each grid cell
const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
let resourceMap = [];

// Initialize the resource map with dirt only
for (let x = 0; x < MAP_WIDTH / GRID_SIZE; x++) {
    resourceMap[x] = [];
    for (let y = 0; y < MAP_HEIGHT / GRID_SIZE; y++) {
        resourceMap[x][y] = MATERIALS.DIRT;
    }
}

// Track players
let players = {};

// Utility function to generate random colors
const getRandomColor = () => {
    return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
};

// Handle collision detection and player interactions
function checkCollisions() {
    const playerIds = Object.keys(players);
    for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
            const playerA = players[playerIds[i]];
            const playerB = players[playerIds[j]];
            const dx = playerA.x - playerB.x;
            const dy = playerA.y - playerB.y;
            const distance = Math.hypot(dx, dy);
            const minDistance = playerA.size + playerB.size;

            if (distance < minDistance) {
                if (playerA.size > playerB.size) {
                    // Player A eliminates Player B
                    playerA.size += Math.floor(playerB.size / 2);
                    playerA.armor += Math.floor(playerB.armor / 2);
                    playerA.health = Math.min(playerA.health + 10, 100); // Optional health boost
                    delete players[playerIds[j]];
                    io.to(playerIds[j]).emit('eliminated');
                    io.emit('updatePlayers', players);
                } else if (playerB.size > playerA.size) {
                    // Player B eliminates Player A
                    playerB.size += Math.floor(playerA.size / 2);
                    playerB.armor += Math.floor(playerA.armor / 2);
                    playerB.health = Math.min(playerB.health + 10, 100); // Optional health boost
                    delete players[playerIds[i]];
                    io.to(playerIds[i]).emit('eliminated');
                    io.emit('updatePlayers', players);
                }
                // If sizes are equal, no elimination
            }
        }
    }
}

// Handle player connections and interactions
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Add new player with initial attributes
    players[socket.id] = { 
        x: 200, 
        y: 200, 
        color: getRandomColor(),
        size: 10, // Initial size
        armor: 5, // Initial armor
        health: 100 // Initial health
    };
    io.emit('updatePlayers', players);
    socket.emit('resourceMap', resourceMap);

    // Handle player movement
    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            checkCollisions(); // Check for collisions after movement
            io.emit('updatePlayers', players);
        }
    });

    // Handle resource collection
    socket.on('collectResource', (position) => {
        const gridX = Math.floor(position.x / GRID_SIZE);
        const gridY = Math.floor(position.y / GRID_SIZE);
        if (resourceMap[gridX] && resourceMap[gridX][gridY]) {
            const material = resourceMap[gridX][gridY];
            if (material === MATERIALS.DIRT) {
                players[socket.id].size += 1;
                players[socket.id].armor += 1;
                resourceMap[gridX][gridY] = MATERIALS.EMPTY;
                io.emit('updatePlayers', players);
                io.emit('resourceMap', resourceMap);
            }
            // Removed handling for 'lava' as it's no longer present
        }
    });

    // Remove player on disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
