require('dotenv').config();
const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');



const app = express();
const server = createServer(app);
const io = new Server(server);


app.set('view engine', 'ejs');
app.set('views', path.resolve('./views'));
const PORT = process.env.PORT || 3000;


app.use(express.json());

app.get('/', (req, res) => {
    res.render('index');
});
const chatHistory = [];
io.on("connection", (socket) => {

    socket.emit("chatHistory", chatHistory);
    // Handle new user connection
    socket.on("newUser", (username) => {
        socket.username = username || "Anonymous";
        const joinMessage = { text: `${socket.username} joined the chat.`, type: "join" };
        chatHistory.push(joinMessage);

        // Notify all users (except the sender) about the new user
        socket.broadcast.emit("userConnected", joinMessage);


        // Optionally send a welcome message only to the newly connected user
        socket.emit("welcome", `Welcome to the chat, ${socket.username}!`);
    });

    // Handle chat message
    socket.on("chatMessage", (msg) => {
        const chatMessage = { username: socket.username, text: msg, userId: socket.id, type: "message" };
        io.emit("chatMessage", chatMessage);
        chatHistory.push(chatMessage);
    });

    // Handle user disconnect
    socket.on("disconnect", () => {
        const disconnectMessage = { text: `${socket.username} left the chat.`, type: "leave" };
        chatHistory.push(disconnectMessage);
        io.emit("userDisconnected", disconnectMessage);
    });
});


server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});



