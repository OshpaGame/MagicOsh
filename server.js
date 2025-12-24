require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https'); // For Keep-Alive
const { Server } = require("socket.io");
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // For DB Persistence

const app = express();
const server = http.createServer(app);

// Config CORS to allow connections from your Web and Apps
app.use(cors());
app.use(express.json());

// Serve Static Files (The Website)
// This allows Render to host BOTH the site and the API/Socket
app.use(express.static(path.join(__dirname, 'public_html')));

// Socket.io Setup
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all connections (secure this in production later)
        methods: ["GET", "POST"]
    }
});

// Email Transporter (BlinkOptimizer)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'blinkoptimizer.ft456@gmail.com',
        pass: process.env.EMAIL_PASS || 'YOUR_APP_PASSWORD_HERE'
    }
});

// --- File-Based Database Persistence ---
// NOTE: On Render Free Tier, this file persists as long as the server runs.
// It resets on new Deploys. For permanent storage, connect a MongoDB/Postgres.
const DB_FILE = path.join(__dirname, 'users_db.json');

function getUsers() {
    if (!fs.existsSync(DB_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Error reading DB:", e);
        return [];
    }
}

function saveUser(user) {
    const users = getUsers();
    users.push(user);
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
        console.log("User saved to DB file.");
        return true;
    } catch (e) {
        console.error("Error saving to DB:", e);
        return false;
    }
}

// --- API Routes ---

// Register
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, dob } = req.body;

    const users = getUsers();

    // Check existing
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, message: 'El correo ya está registrado.' });
    }

    const newUser = { id: Date.now(), username, email, password, dob, createdAt: new Date() };
    saveUser(newUser); // Persist to file

    console.log('New User Registered:', username);
    res.json({ success: true, user: { id: newUser.id, username, email } });
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
    }
});


// --- Real-Time Logic ---
const activeChats = {}; // Store: { socketId: { email, history: [] } }

io.on('connection', (socket) => {
    console.log('New User Connected:', socket.id);

    // Init session store
    activeChats[socket.id] = { email: null, history: [] };

    // Identify Client Type
    socket.on('identify', (data) => {
        socket.join(data.type);
        console.log(`Socket ${socket.id} identified as ${data.type}`);
        if (data.type === 'web_client' && data.username) {
            // Store username if needed
            activeChats[socket.id].username = data.username;
        }
    });

    // Handle Chat Message from Web
    socket.on('web_message', (msgData) => {
        // Store Email if present
        if (msgData.email) activeChats[socket.id].email = msgData.email;

        // Add to History
        activeChats[socket.id].history.push(`[Usuario]: ${msgData.text}`);

        // Send to Admins
        const adminPayload = { ...msgData, socketId: socket.id };
        io.to('admin_windows').to('admin_windows_native').to('admin_android').emit('new_message', adminPayload);
    });

    // Handle Reply from Admin
    socket.on('admin_reply', (replyData) => {
        // Add to History
        if (activeChats[replyData.targetSocketId]) {
            activeChats[replyData.targetSocketId].history.push(`[Soporte]: ${replyData.message}`);
        }

        // Send back to web user
        io.to(replyData.targetSocketId).emit('admin_response', replyData.message);
    });

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);

        try {
            const session = activeChats[socket.id];

            // Check if we should email transcript
            if (session && session.email && session.history.length > 0) {
                console.log(`Sending Chat Transcript to ${session.email}...`);

                const transcript = session.history.join('\n');

                // Send Email via Nodemailer
                await transporter.sendMail({
                    from: '"MagicOsh Support" <blinkoptimizer.ft456@gmail.com>',
                    to: session.email,
                    subject: 'Tu historial de chat con MagicOsh',
                    text: `Gracias por contactarnos. Aquí tienes una copia de tu conversación:\n\n${transcript}\n\nSaludos,\nEl equipo de MagicOsh.`
                });

                console.log('Transcript sent successfully.');
            }
        } catch (err) {
            console.error('Error sending transcript:', err.message);
        }

        // Cleanup memory
        delete activeChats[socket.id];
    });
});

// Helper: Send Email
async function sendNotificationEmail(data) {
    try {
        await transporter.sendMail({
            from: 'MagicOsh Bot <blinkoptimizer.ft456@gmail.com>',
            to: 'blinkoptimizer.ft456@gmail.com',
            subject: `Nuevo Mensaje de ${data.username}`,
            text: `Mensaje: ${data.text}\n\nResponder desde la App.`
        });
    } catch (error) {
        console.error('Email Error:', error);
    }
}

// --- Keep-Alive Mechanism (Anti-Sleep for Render Free Tier) ---
app.get('/health', (req, res) => res.send('I am alive!'));

function keepAlive() {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    const targetUrl = url.endsWith('/') ? `${url}health` : `${url}/health`;

    // Only ping if we are on Render (to avoid noise in local dev) or if forced
    if (process.env.RENDER_EXTERNAL_URL) {
        console.log(`Sending Keep-Alive ping to ${targetUrl}`);

        // Pilih client yang sesuai (http atau https)
        const client = targetUrl.startsWith('https') ? https : http;

        client.get(targetUrl, (res) => {
            if (res.statusCode === 200) {
                console.log('Keep-Alive success');
            } else {
                console.error(`Keep-Alive failed: ${res.statusCode}`);
            }
        }).on('error', (err) => {
            console.error('Keep-Alive error:', err.message);
        });
    }
}

// Ping every 14 minutes (840000 ms) to beat the 15 min sleep timer
setInterval(keepAlive, 840000);

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`MagicOsh Server running on port ${PORT}`);
    // Initial ping
    setTimeout(keepAlive, 5000);
});
