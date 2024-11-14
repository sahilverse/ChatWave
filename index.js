require('dotenv').config();
const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const schedule = require('node-schedule');

const app = express();
const server = createServer(app);
const io = new Server(server);

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const uniqueSuffix = timestamp + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${timestamp}-${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

function clearChatsAndUploads() {

    // Clear chat history
    chatHistory.length = 0;

    // Clear uploads
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    fs.readdir(uploadDir, (err, files) => {
        if (err) throw err;
        for (const file of files) {
            fs.unlink(path.join(uploadDir, file), err => {
                if (err) throw err;
            });
        }
    });

    console.log('Chats and uploads cleared.');
}

// Schedule chat and upload clearing every 15 days
schedule.scheduleJob('0 0 */15 * *', clearChatsAndUploads);

app.set('view engine', 'ejs');
app.set('views', path.resolve('./views'));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.get('/', (req, res) => {
    res.render('index');
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) {
        res.json({ filename: '/uploads/' + req.file.filename });
    } else {
        res.status(400).send('No file uploaded');
    }
});

const chatHistory = [];
const onlineUsers = new Set();

io.on('connection', (socket) => {

    socket.emit('chatHistory', chatHistory);

    socket.on('newUser', (username) => {
        socket.username = username;
        onlineUsers.add(username);
        socket.emit('chatHistory', chatHistory);

        const joinMessage = { text: `${username} joined the chat.`, type: 'join' };

        socket.emit("welcome", `Welcome to the chat, ${socket.username}!`);
        chatHistory.push(joinMessage);
        socket.broadcast.emit('userConnected', { text: joinMessage.text });

        io.emit('userList', { users: Array.from(onlineUsers) });
    });

    socket.on('chatMessage', (msg) => {
        const chatMessage = { username: socket.username, text: msg, userId: socket.id, type: 'message' };
        chatHistory.push(chatMessage);
        io.emit('chatMessage', chatMessage);
    });

    socket.on('voiceMessage', (data) => {
        const voiceMessage = { username: socket.username, audioUrl: data.audioUrl, userId: socket.id, type: 'voice' };
        chatHistory.push(voiceMessage);
        io.emit('voiceMessage', voiceMessage);
    });

    socket.on('fileMessage', (data) => {
        const fileMessage = { username: socket.username, fileUrl: data.fileUrl, fileName: data.fileName, fileType: data.fileType, userId: socket.id, type: 'file' };
        chatHistory.push(fileMessage);
        io.emit('fileMessage', fileMessage);
    });

    socket.on('disconnect', () => {

        if (socket.username) {
            onlineUsers.delete(socket.username);
            const disconnectMessage = { text: `${socket.username} left the chat.`, type: 'leave' };
            chatHistory.push(disconnectMessage);
            io.emit('userDisconnected', { text: disconnectMessage.text, users: Array.from(onlineUsers) });
        }
    });
    socket.on('chatsCleared', () => {
        socket.broadcast.emit('chatHistory', chatHistory);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});