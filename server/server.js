const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Track players
const players = {};

// Generate random color for players
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('newPlayer', (name) => {
        players[socket.id] = { x: 100, y: 100, color: getRandomColor(), name: name };
        io.emit('updatePlayers', players);
    });

    socket.on('move', (data) => {
        const player = players[socket.id];
        if (player) {
            player.x += data.dx;
            player.y += data.dy;
            io.emit('updatePlayers', players);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
