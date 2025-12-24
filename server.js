require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https'); // For Keep-Alive
const { Server } = require("socket.io");
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Config CORS & BODY PARSER FOR IMAGES
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased for Base64 Community Images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public_html')));

// Socket.io Setup
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'blinkoptimizer.ft456@gmail.com',
        pass: process.env.EMAIL_PASS || 'YOUR_APP_PASSWORD_HERE'
    }
});

// --- File-Based Database Persistence ---
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const POSTS_FILE = path.join(__dirname, 'data', 'posts.json'); // New Community DB

// Ensure Data Structure
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, '[]');

function getUsers() {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
    catch (e) { return []; }
}
function saveUser(user) {
    const users = getUsers();
    users.push(user);
    try { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); return true; }
    catch (e) { return false; }
}

// --- API Routes ---

// AUTH
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, dob } = req.body;
    const users = getUsers();
    if (users.find(u => u.email === email)) return res.status(400).json({ success: false, message: 'El correo ya está registrado.' });
    const newUser = { id: Date.now(), username, email, password, dob, createdAt: new Date() };
    saveUser(newUser);
    console.log('New User Registered:', username);
    res.json({ success: true, user: { id: newUser.id, username, email } });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (user) res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
    else res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
});

// COMMUNITY POSTS API (NEW)
app.get('/api/posts', (req, res) => {
    try {
        const posts = JSON.parse(fs.readFileSync(POSTS_FILE));
        res.json(posts);
    } catch (e) { res.status(500).json([]); }
});

app.post('/api/posts', (req, res) => {
    try {
        const { username, text, image, timestamp } = req.body;
        const posts = JSON.parse(fs.readFileSync(POSTS_FILE));

        const newPost = {
            id: Date.now(),
            username,
            text,
            image, // Base64 string
            timestamp: timestamp || new Date().toISOString()
        };

        posts.push(newPost);
        // Keep only last 100 posts to avoid file bloat
        if (posts.length > 100) posts.shift();

        fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to save post" });
    }
});


// --- Real-Time Logic (Universal Support) ---
const activeChats = {};

io.on('connection', (socket) => {
    console.log('New Socket Connected:', socket.id);
    activeChats[socket.id] = { email: null, history: [], type: 'unknown' };

    socket.on('identify', (data) => {
        socket.join(data.type);
        activeChats[socket.id].type = data.type;
        console.log(`Socket ${socket.id} identified as ${data.type}`);

        if (data.type === 'web_client') {
            if (data.username) activeChats[socket.id].username = data.username;
            io.to('admin_windows').to('admin_windows_native').to('admin_android').emit('user_connected', {
                socketId: socket.id,
                username: data.username || 'Invitado',
                email: activeChats[socket.id].email
            });
        }

        if (['admin_windows', 'admin_windows_native', 'admin_android'].includes(data.type)) {
            console.log("Admin Connected! Sending active list...");
            const currentUsers = Object.keys(activeChats)
                .filter(id => activeChats[id].type === 'web_client')
                .map(id => ({
                    socketId: id,
                    username: activeChats[id].username || 'Invitado',
                    email: activeChats[id].email,
                    history: activeChats[id].history
                }));
            socket.emit('active_users_list', currentUsers);
        }
    });

    socket.on('web_message', (msgData) => {
        if (!activeChats[socket.id]) return;
        if (msgData.email) activeChats[socket.id].email = msgData.email;
        if (msgData.username) activeChats[socket.id].username = msgData.username;

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${msgData.username}: ${msgData.text}`;
        activeChats[socket.id].history.push(logEntry);

        const adminPayload = { ...msgData, socketId: socket.id, timestamp };
        io.to('admin_windows').to('admin_windows_native').to('admin_android').emit('new_message', adminPayload);
    });

    socket.on('admin_reply', (replyData) => {
        const timestamp = new Date().toLocaleTimeString();
        if (activeChats[replyData.targetSocketId]) {
            activeChats[replyData.targetSocketId].history.push(`[${timestamp}] Soporte: ${replyData.message}`);
            io.to(replyData.targetSocketId).emit('admin_response', replyData.message);
        }
    });

    socket.on('admin_close_chat', (data) => {
        const targetId = data.targetSocketId;
        const session = activeChats[targetId];
        if (session) {
            console.log(`Closing chat for: ${session.username || targetId}`);

            // Archive
            const logsDir = path.join(__dirname, 'chat_logs_archive');
            if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

            const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            const safeUsername = (session.username || 'guest').replace(/[^a-z0-9]/gi, '_');
            const fileName = `${safeUsername}_${dateStr}.txt`;

            const fileContent = `CHAT LOG - ${session.username}\nEMAIL: ${session.email || 'N/A'}\nDATE: ${new Date().toLocaleString()}\n----------------------------------------\n\n` + session.history.join('\n');
            fs.writeFile(path.join(logsDir, fileName), fileContent, () => { });

            io.to(targetId).emit('admin_response', 'El soporte ha finalizado esta sesión.');
            io.to('admin_windows').to('admin_windows_native').to('admin_android').emit('chat_closed_confirmed', { socketId: targetId });
            session.history = [];
        }
    });

    socket.on('disconnect', async () => {
        io.to('admin_windows').to('admin_windows_native').to('admin_android').emit('user_disconnected', { socketId: socket.id });
        delete activeChats[socket.id];
    });
});

// --- Keep-Alive ---
app.get('/health', (req, res) => res.send('I am alive!'));
function keepAlive() {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    const targetUrl = url.endsWith('/') ? `${url}health` : `${url}/health`;
    if (process.env.RENDER_EXTERNAL_URL) {
        const client = targetUrl.startsWith('https') ? https : http;
        client.get(targetUrl, (res) => { }).on('error', (err) => console.error('Keep-Alive error:', err.message));
    }
}
setInterval(keepAlive, 840000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`MagicOsh Server running on port ${PORT}`);
    setTimeout(keepAlive, 5000);
});
