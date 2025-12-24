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

        const newPost = {
            id: Date.now(),
            username,
            text,
            image,
            timestamp: timestamp || new Date().toISOString(),
            likes: [],     // Array of usernames
            comments: []   // Array of {username, text, timestamp}
        };
        posts.push(newPost);
        if (posts.length > 100) posts.shift();
        saveJson(POSTS_FILE, posts);

        // LIVE SYNC: Notify all public clients
        io.emit('new_public_post', newPost);

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Failed" }); }
});

// 3. Toggle Like
app.post('/api/posts/:id/like', (req, res) => {
    try {
        const { id } = req.params;
        const { username } = req.body;
        const posts = getJson(POSTS_FILE);
        const post = posts.find(p => p.id == id);

        if (post) {
            if (!post.likes) post.likes = [];
            const index = post.likes.indexOf(username);
            if (index === -1) post.likes.push(username);
            else post.likes.splice(index, 1);

            saveJson(POSTS_FILE, posts);
            io.emit('post_update', post);
            res.json({ success: true, likes: post.likes.length });
        } else { res.status(404).json({ error: "Post not found" }); }
    } catch (e) { res.status(500).json({ error: "Failed" }); }
});

// 4. Add Comment
app.post('/api/posts/:id/comment', (req, res) => {
    try {
        const { id } = req.params;
        const { username, text } = req.body;
        const posts = getJson(POSTS_FILE);
        const post = posts.find(p => p.id == id);

        if (post) {
            if (!post.comments) post.comments = [];
            post.comments.push({ username, text, timestamp: new Date().toISOString() });
            saveJson(POSTS_FILE, posts);
            io.emit('post_update', post);
            res.json({ success: true });
        } else { res.status(404).json({ error: "Post not found" }); }
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

// 5. Update Profile
app.post('/api/users/update', (req, res) => {
    try {
        const { username, email, oldPassword, newPassword, bio, avatar } = req.body;
        let users = getJson(USERS_FILE);
        const userIdx = users.findIndex(u => u.username === username); // Match by username (or email)

        if (userIdx !== -1) {
            // Verify Password if needed (Optional for now, trust session)
            // if (users[userIdx].password !== oldPassword) return res.json({success: false, message: "Pass Fail"});

            if (newPassword) users[userIdx].password = newPassword;
            if (bio) users[userIdx].bio = bio;
            if (avatar) users[userIdx].avatar = avatar; // Base64 avatar support

            saveJson(USERS_FILE, users);
            res.json({ success: true, message: "Profile Updated" });
        } else {
            res.status(404).json({ success: false, message: "User not found" });
        }
    } catch (e) { res.status(500).json({ error: "Failed" }); }
});


// --- REAL-TIME CORE ---
let activeChats = getJson(SESSIONS_FILE); // Key: USERNAME (not socket.id)

// Cleanup Stale Sessions (> 24h offline)
const ONE_DAY = 24 * 60 * 60 * 1000;
Object.keys(activeChats).forEach(k => {
    activeChats[k].connected = false;
    activeChats[k].currentSocketId = null; // Invalidate old socket

    // Purge logic
    const lastActive = activeChats[k].lastActive || 0;
    if (Date.now() - lastActive > ONE_DAY) delete activeChats[k];
});
saveJson(SESSIONS_FILE, activeChats);

// Map SocketID -> Username for quick lookup
const socketUserMap = {};

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
            socket.emit('active_users_list', sessionList.map(s => ({
                SocketId: s.username, // PRESERVING APP COMPATIBILITY: ID IS USERNAME NOW
                Username: s.username,
                Email: s.email,
                History: s.history,
                IsOnline: s.connected
            })));

            // Send Stats
            socket.emit('stats_update', {
                total_visits: stats.total_visits,
                online_users: getOnlineWebCount()
            });
        }
        else if (data.type === 'web_client') {
            const username = data.username || 'Invitado_' + socket.id.substr(0, 4);
            socketUserMap[socket.id] = username;

            // Recover or Init Session
            if (!activeChats[username]) {
                activeChats[username] = {
                    username: username, // Primary Key
                    currentSocketId: socket.id,
                    email: null,
                    history: [],
                    connected: true,
                    type: 'web_client',
                    lastActive: Date.now()
                };
            } else {
                activeChats[username].connected = true; // Mark back online
                activeChats[username].currentSocketId = socket.id; // Update pointer
                activeChats[username].lastActive = Date.now();

                // LIVE SYNC: Send History back to User
                socket.emit('chat_restore', activeChats[username].history);
            }
            saveJson(SESSIONS_FILE, activeChats); // PERSIST

            // Notify Admin (Send the Session Object)
            const sessionObj = activeChats[username];
            // Mapper for Admin App compatibility (it expects "SocketId" property to route msgs)
            // But we must be careful: Admin App uses "SocketId" as ID. 
            // We tell Admin: "Hey, this username is now at this SocketID"
            io.to('admin_room').emit('user_connected', {
                SocketId: username, // PRESERVING APP COMPATIBILITY: ID IS USERNAME NOW
                Username: username,
                Email: sessionObj.email,
                History: sessionObj.history,
                IsOnline: true
            });

            io.to('admin_room').emit('stats_update', {
                total_visits: stats.total_visits,
                online_users: getOnlineWebCount()
            });
        }
    });

    socket.on('web_message', (msgData) => {
        const username = socketUserMap[socket.id];
        if (!username || !activeChats[username]) return;

        const session = activeChats[username];
        if (msgData.email) session.email = msgData.email;
        session.lastActive = Date.now();

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${username}: ${msgData.text}`;

        session.history.push(logEntry);
        saveJson(SESSIONS_FILE, activeChats);

        // Forward to Admin (Using username as ID)
        const adminPayload = { ...msgData, socketId: username, timestamp };
        io.to('admin_room').emit('new_message', adminPayload);
    });

    // ADMIN ACTIONS
    socket.on('admin_reply', (replyData) => {
        // targetSocketId is actually the USERNAME now
        const username = replyData.targetSocketId;
        const session = activeChats[username];
        const timestamp = new Date().toLocaleTimeString();

        if (session) {
            const msg = `[${timestamp}] Soporte: ${replyData.message}`;
            session.history.push(msg);
            session.lastActive = Date.now();
            saveJson(SESSIONS_FILE, activeChats);

            // Route to REAL socket if connected
            if (session.currentSocketId) {
                io.to(session.currentSocketId).emit('admin_response', replyData.message);
            }
        }
    });

    // NEW: ADMIN SEND FILE
    socket.on('admin_file', (fileData) => {
        const username = fileData.targetSocketId; // It's username now
        const session = activeChats[username];
        const timestamp = new Date().toLocaleTimeString();

        if (session) {
            const msg = `[${timestamp}] Soporte envió archivo: ${fileData.fileName}`;
            session.history.push(msg);
            session.lastActive = Date.now();
            saveJson(SESSIONS_FILE, activeChats);

            // Route to REAL socket
            if (session.currentSocketId) {
                io.to(session.currentSocketId).emit('admin_file_receive', {
                    fileName: fileData.fileName,
                    fileData: fileData.fileBase64
                });
            }
        }
    });

    socket.on('admin_close_chat', (data) => {
        const username = data.targetSocketId;
        const session = activeChats[username];

        if (session) {
            // Archive Logic
            const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            const safeUsername = (session.username || 'guest').replace(/[^a-z0-9]/gi, '_');
            const fileName = `${safeUsername}_${dateStr}.txt`;
            const fileContent = `LOG - ${session.username}\n${new Date().toLocaleString()}\n\n` + session.history.join('\n');

            fs.writeFile(path.join(CHAT_LOGS_DIR, fileName), fileContent, () => { });

            if (session.currentSocketId) {
                // FORCE REFRESH TO CLEAR CLIENT STATE
                io.to(session.currentSocketId).emit('force_client_refresh');
            }
            io.to('admin_room').emit('chat_closed_confirmed', { socketId: username });

            // DELETE FROM PERSISTENCE
            delete activeChats[username];
            saveJson(SESSIONS_FILE, activeChats);
        }
    });

    socket.on('disconnect', () => {
        // Update Stats
        const stats = getJson(STATS_FILE);
        io.to('admin_room').emit('stats_update', { total_visits: stats.total_visits, online_users: getOnlineWebCount() });

        const username = socketUserMap[socket.id];
        if (username && activeChats[username]) {
            activeChats[username].connected = false;
            // activeChats[username].currentSocketId = null; // Don't nullify yet, keep as reference? No, invalid.
            activeChats[username].lastActive = Date.now();
            saveJson(SESSIONS_FILE, activeChats);

            // Notify admin user went offline (Using username ID)
            io.to('admin_room').emit('user_disconnected', { socketId: username });
        }
        delete socketUserMap[socket.id];
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
