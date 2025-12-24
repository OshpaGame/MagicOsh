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

// Config CORS & BODY PARSER FOR IMAGES (HUGE LIMITS)
app.use(cors());
app.use(express.json({ limit: '1024mb' }));
app.use(express.urlencoded({ extended: true, limit: '1024mb' }));

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public_html')));

// Socket.io Setup (Allow 1GB Buffer for 500MB files)
const io = new Server(server, {
    maxHttpBufferSize: 1e9,
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'blinkoptimizer.ft456@gmail.com',
        pass: process.env.EMAIL_PASS || 'YOUR_APP_PASSWORD_HERE'
    }
});

// --- DATABASE (File-based) ---
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const POSTS_FILE = path.join(__dirname, 'data', 'posts.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'active_sessions.json');
const STATS_FILE = path.join(__dirname, 'data', 'stats.json');
const CHAT_LOGS_DIR = path.join(__dirname, 'chat_logs_archive');

// Ensure data existence
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, '[]');
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, '{}');
if (!fs.existsSync(STATS_FILE)) fs.writeFileSync(STATS_FILE, JSON.stringify({ total_visits: 0 }));
if (!fs.existsSync(CHAT_LOGS_DIR)) fs.mkdirSync(CHAT_LOGS_DIR);

// Helpers
function getJson(file) { try { return JSON.parse(fs.readFileSync(file)); } catch { return {}; } }
function saveJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

// --- API ROUTES ---
// 1. Get Posts
app.get('/api/posts', (req, res) => {
    try { res.json(getJson(POSTS_FILE)); } catch (e) { res.status(500).json([]); }
});
// 2. Create Post
app.post('/api/posts', (req, res) => {
    try {
        const { username, text, image, timestamp } = req.body;
        const posts = getJson(POSTS_FILE);
        if (!Array.isArray(posts)) return res.json({ success: false }); // Safety

        const newPost = { id: Date.now(), username, text, image, timestamp: timestamp || new Date().toISOString() };
        posts.push(newPost);
        if (posts.length > 100) posts.shift();
        saveJson(POSTS_FILE, posts);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Failed" }); }
});

// Auth Routes (users) - Keep existing logic or simplified helper usage
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, dob } = req.body;
    let users = getJson(USERS_FILE);
    if (!Array.isArray(users)) users = [];

    if (users.find(u => u.email === email)) return res.status(400).json({ success: false, message: 'Registrado.' });
    const newUser = { id: Date.now(), username, email, password, dob, createdAt: new Date() };
    users.push(newUser);
    saveJson(USERS_FILE, users);
    res.json({ success: true, user: { id: newUser.id, username, email } });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    let users = getJson(USERS_FILE);
    if (!Array.isArray(users)) users = [];
    const user = users.find(u => u.email === email && u.password === password);
    if (user) res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
    else res.status(401).json({ success: false, message: 'Invalid.' });
});


// --- REAL-TIME CORE ---
// Load persisted sessions into memory on start
let activeChats = getJson(SESSIONS_FILE);
// Clean up old sockets from memory structure (but allow re-connect)
Object.keys(activeChats).forEach(k => { activeChats[k].connected = false; });

// Helper: Count ONLY connected Web Clients
function getOnlineWebCount() {
    return Object.values(activeChats).filter(s => s.connected && s.type === 'web_client').length;
}

io.on('connection', (socket) => {
    // 1. Update Visits Stat
    const stats = getJson(STATS_FILE);
    stats.total_visits = (stats.total_visits || 0) + 1;
    saveJson(STATS_FILE, stats);

    // Broadcast REAL stats
    io.to('admin_room').emit('stats_update', {
        total_visits: stats.total_visits,
        online_users: getOnlineWebCount()
    });

    socket.on('identify', (data) => {
        if (data.type === 'admin_windows_native') {
            socket.join('admin_room');
            console.log("ADMIN CONNECTED. Sending persisted sessions...");

            // Send FULL list of sessions (Active + Persisted but Offline)
            const sessionList = Object.values(activeChats);
            socket.emit('active_users_list', sessionList);

            // Send Stats
            socket.emit('stats_update', {
                total_visits: stats.total_visits,
                online_users: getOnlineWebCount()
            });
        }
        else if (data.type === 'web_client') {
            const username = data.username || 'Invitado';

            // Recover or Init Session
            if (!activeChats[socket.id]) {
                activeChats[socket.id] = {
                    socketId: socket.id, // For new users, socketId IS the key
                    username: username,
                    email: null,
                    history: [],
                    connected: true,
                    type: 'web_client'
                };
            } else {
                activeChats[socket.id].connected = true; // Mark back online
                activeChats[socket.id].username = username;
            }
            saveJson(SESSIONS_FILE, activeChats); // PERSIST

            // Notify Admin
            io.to('admin_room').emit('user_connected', activeChats[socket.id]);
            // Force Stat Update
            io.to('admin_room').emit('stats_update', {
                total_visits: stats.total_visits,
                online_users: getOnlineWebCount()
            });
        }
    });

    socket.on('web_message', (msgData) => {
        if (!activeChats[socket.id]) return;

        // Update Metadata
        if (msgData.email) activeChats[socket.id].email = msgData.email;
        if (msgData.username) activeChats[socket.id].username = msgData.username;

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${msgData.username}: ${msgData.text}`;

        activeChats[socket.id].history.push(logEntry);
        saveJson(SESSIONS_FILE, activeChats); // PERSIST EVERY MSG

        // Forward to Admin
        const adminPayload = { ...msgData, socketId: socket.id, timestamp };
        io.to('admin_room').emit('new_message', adminPayload);
    });

    // ADMIN ACTIONS
    socket.on('admin_reply', (replyData) => {
        const timestamp = new Date().toLocaleTimeString();
        const targetId = replyData.targetSocketId;

        if (activeChats[targetId]) {
            const msg = `[${timestamp}] Soporte: ${replyData.message}`;
            activeChats[targetId].history.push(msg);
            saveJson(SESSIONS_FILE, activeChats); // PERSIST

            io.to(targetId).emit('admin_response', replyData.message);
        }
    });

    // NEW: ADMIN SEND FILE
    socket.on('admin_file', (fileData) => {
        // fileData: { targetSocketId, fileName, fileBase64 }
        const timestamp = new Date().toLocaleTimeString();
        const targetId = fileData.targetSocketId;

        if (activeChats[targetId]) {
            const msg = `[${timestamp}] Soporte envió archivo: ${fileData.fileName}`;
            activeChats[targetId].history.push(msg);
            saveJson(SESSIONS_FILE, activeChats);

            // Send to Web User
            io.to(targetId).emit('admin_file_receive', {
                fileName: fileData.fileName,
                fileData: fileData.fileBase64
            });
        }
    });

    socket.on('admin_close_chat', (data) => {
        const targetId = data.targetSocketId;
        const session = activeChats[targetId];

        if (session) {
            // Archive Logic
            const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            const safeUsername = (session.username || 'guest').replace(/[^a-z0-9]/gi, '_');
            const fileName = `${safeUsername}_${dateStr}.txt`;
            const fileContent = `LOG - ${session.username}\n${new Date().toLocaleString()}\n\n` + session.history.join('\n');

            fs.writeFile(path.join(CHAT_LOGS_DIR, fileName), fileContent, () => { });

            // Notify User
            io.to(targetId).emit('admin_response', 'El soporte ha finalizado esta sesión.');
            io.to('admin_room').emit('chat_closed_confirmed', { socketId: targetId });

            // DELETE FROM PERSISTENCE
            delete activeChats[targetId];
            saveJson(SESSIONS_FILE, activeChats);
        }
    });

    socket.on('disconnect', () => {
        // Update Stats
        const stats = getJson(STATS_FILE); // Re-read to ensure latest
        io.to('admin_room').emit('stats_update', {
            total_visits: stats.total_visits,
            online_users: io.engine.clientsCount
        });

        if (activeChats[socket.id]) {
            activeChats[socket.id].connected = false;
            // DO NOT DELETE from activeChats yet! Wait for admin to close it.
            saveJson(SESSIONS_FILE, activeChats);

            io.to('admin_room').emit('user_disconnected', { socketId: socket.id });
        }
    });
});

// --- Keep-Alive ---
app.get('/health', (req, res) => res.send('OK'));
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
    console.log(`MagicOsh Server v2 running on ${PORT}`);
    setTimeout(keepAlive, 5000);
});
