const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Initialize server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static('public'));

// Track players
let players = {};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Add new player
    players[socket.id] = { x: 200, y: 200, color: getRandomColor() };
    io.emit('updatePlayers', players);

    // Handle player movement
    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x += data.dx;
            players[socket.id].y += data.dy;
            io.emit('updatePlayers', players);
        }
    });

    // Remove player on disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

const getRandomColor = () => {
    return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
};

// Start the server
const PORT = process.env.PORT || 3000;;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
