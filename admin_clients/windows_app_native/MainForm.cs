using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;
using SocketIOClient;
using Newtonsoft.Json;
using System.Linq;

namespace MagicOshAdmin
{
    // Data Model for Session
    public class UserSession {
        public string SocketId { get; set; }
        public string Username { get; set; }
        public string Email { get; set; }
        public List<string> History { get; set; } = new List<string>();
        public bool HasUnread { get; set; } = false;
        public bool IsOnline { get; set; } = true;
        
        public override string ToString() {
            string status = IsOnline ? "🟢" : "⚫";
            string unread = HasUnread ? "(!)" : "";
            return $"{status} {Username} {unread}";
        }
    }

    public partial class MainForm : Form
    {
        private SocketIO client;
        private string activeSocketId; // Currently viewing
        
        // Data Store
        private Dictionary<string, UserSession> sessions = new Dictionary<string, UserSession>();
        
        // UI Components
        private ListBox lstUsers;
        private RichTextBox chatHistory;
        private TextBox txtInput;
        private Button btnSend;
        private Button btnCloseChat; // NEW
        private Label lblHeader; // NEW
        private Label lblStatus;
        private Panel sidebar;

        public MainForm()
        {
            InitializeComponent(); // Custom logic below
            InitializeSocket();
        }

        private void InitializeComponent()
        {
            this.Size = new Size(1100, 750);
            this.Text = "MagicOsh Admin Panel (Multi-Client Edition)";
            this.Icon = SystemIcons.Shield;
            this.BackColor = Color.FromArgb(10, 10, 15);

            // --- 1. SIDEBAR (User List) ---
            sidebar = new Panel();
            sidebar.Dock = DockStyle.Left;
            sidebar.Width = 260;
            sidebar.BackColor = Color.FromArgb(20, 20, 35);
            sidebar.Padding = new Padding(10);

            Label lblLogo = new Label();
            lblLogo.Text = "OPS CENTER";
            lblLogo.ForeColor = Color.Cyan;
            lblLogo.Font = new Font("Consolas", 14, FontStyle.Bold);
            lblLogo.Dock = DockStyle.Top;
            lblLogo.Height = 40;
            sidebar.Controls.Add(lblLogo);

            lstUsers = new ListBox();
            lstUsers.Dock = DockStyle.Fill;
            lstUsers.BackColor = Color.FromArgb(30, 30, 45);
            lstUsers.ForeColor = Color.White;
            lstUsers.BorderStyle = BorderStyle.None;
            lstUsers.Font = new Font("Segoe UI", 11);
            lstUsers.DrawMode = DrawMode.OwnerDrawFixed;
            lstUsers.ItemHeight = 40;
            lstUsers.DrawItem += LstUsers_DrawItem;
            lstUsers.SelectedIndexChanged += LstUsers_SelectionChanged;
            sidebar.Controls.Add(lstUsers);
            
            // --- 2. MAIN CHAT AREA ---
            Panel chatPanel = new Panel();
            chatPanel.Dock = DockStyle.Fill;
            chatPanel.BackColor = Color.FromArgb(5, 5, 10);
            
            // Header
            Panel headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 60;
            headerPanel.BackColor = Color.FromArgb(25, 25, 40);
            headerPanel.Padding = new Padding(15);
            
            lblHeader = new Label();
            lblHeader.Text = "Selecciona un usuario...";
            lblHeader.ForeColor = Color.White;
            lblHeader.Font = new Font("Segoe UI", 12, FontStyle.Bold);
            lblHeader.AutoSize = true;
            lblHeader.Location = new Point(15, 15);
            
            btnCloseChat = new Button();
            btnCloseChat.Text = "FINALIZAR CHAT";
            btnCloseChat.BackColor = Color.Crimson;
            btnCloseChat.ForeColor = Color.White;
            btnCloseChat.FlatStyle = FlatStyle.Flat;
            btnCloseChat.Size = new Size(120, 30);
            btnCloseChat.Location = new Point(500, 15); // Will anchor right
            btnCloseChat.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            btnCloseChat.Visible = false;
            btnCloseChat.Click += BtnCloseChat_Click;
            
            headerPanel.Controls.Add(lblHeader);
            headerPanel.Controls.Add(btnCloseChat);

            // Status Bar
            lblStatus = new Label();
            lblStatus.Text = "Conectando...";
            lblStatus.ForeColor = Color.Gray;
            lblStatus.Dock = DockStyle.Top;
            lblStatus.TextAlign = ContentAlignment.MiddleCenter;

            // Chat History
            chatHistory = new RichTextBox();
            chatHistory.Dock = DockStyle.Fill;
            chatHistory.BackColor = Color.Black;
            chatHistory.ForeColor = Color.LightGray;
            chatHistory.Font = new Font("Consolas", 10);
            chatHistory.ReadOnly = true;
            chatHistory.BorderStyle = BorderStyle.None;
            chatHistory.Padding = new Padding(20);

            // Input Area
            Panel inputPanel = new Panel();
            inputPanel.Dock = DockStyle.Bottom;
            inputPanel.Height = 60;
            inputPanel.Padding = new Padding(10);
            inputPanel.BackColor = Color.FromArgb(30, 30, 40);

            btnSend = new Button();
            btnSend.Text = "➔";
            btnSend.Dock = DockStyle.Right;
            btnSend.Width = 60;
            btnSend.BackColor = Color.FromArgb(0, 150, 255);
            btnSend.FlatStyle = FlatStyle.Flat;
            btnSend.ForeColor = Color.White;
            btnSend.Click += BtnSend_Click;

            txtInput = new TextBox();
            txtInput.Dock = DockStyle.Fill;
            txtInput.BackColor = Color.FromArgb(50, 50, 60);
            txtInput.ForeColor = Color.White;
            txtInput.BorderStyle = BorderStyle.FixedSingle;
            txtInput.Font = new Font("Segoe UI", 14);
            txtInput.KeyDown += (s, e) => { if (e.KeyCode == Keys.Enter) BtnSend_Click(s, e); };

            inputPanel.Controls.Add(txtInput);
            inputPanel.Controls.Add(btnSend);

            // Assembly
            chatPanel.Controls.Add(chatHistory);
            chatPanel.Controls.Add(inputPanel);
            chatPanel.Controls.Add(lblStatus);
            chatPanel.Controls.Add(headerPanel);

            this.Controls.Add(chatPanel);
            this.Controls.Add(sidebar);
        }

        // --- SOCKET LOGIC ---

        private async void InitializeSocket()
        {
            // Use your Render URL or local for testing
            client = new SocketIO("https://magicosh-service.onrender.com");
            // client = new SocketIO("http://localhost:3000"); // Uncomment for local logic

            client.OnConnected += async (sender, e) =>
            {
                UpdateStatus("Conectado al servidor", Color.LimeGreen);
                await client.EmitAsync("identify", new { type = "admin_windows_native" });
            };
            
            client.OnDisconnected += (sender, e) => UpdateStatus("Desconectado", Color.Red);

            // 1. Initial User List
            client.On("active_users_list", response => {
                try {
                    var users = JsonConvert.DeserializeObject<List<UserSession>>(response.GetValue<string>());
                    this.Invoke((MethodInvoker)delegate {
                        foreach(var u in users) {
                            if(!sessions.ContainsKey(u.SocketId)) sessions.Add(u.SocketId, u);
                        }
                        RefreshUserList();
                    });
                } catch {}
            });

            // 2. New Message
            client.On("new_message", response => {
                try {
                    dynamic obj = JsonConvert.DeserializeObject<dynamic>(response.ToString())[0];
                    string socketId = obj.socketId;
                    string user = obj.username;
                    string text = obj.text;
                    string time = obj.timestamp;

                    this.Invoke((MethodInvoker)delegate {
                        // Ensure session exists
                        if(!sessions.ContainsKey(socketId)) {
                             sessions.Add(socketId, new UserSession { 
                                 SocketId = socketId, 
                                 Username = user, 
                                 History = new List<string>() 
                             });
                             RefreshUserList();
                        }

                        var session = sessions[socketId];
                        string logLine = $"[{time}] {user}: {text}";
                        session.History.Add(logLine);

                        if(activeSocketId == socketId) {
                            AppendText(logLine + "\n", Color.Cyan); // Show immediately
                        } else {
                            session.HasUnread = true;
                            RefreshUserList();
                            System.Media.SystemSounds.Exclamation.Play(); // Ding!
                        }
                    });
                } catch (Exception ex) { Console.WriteLine(ex.Message); }
            });

            // 3. User Connected
             client.On("user_connected", response => {
                 // Similar to new_message logic just for creating session
                 try {
                     dynamic obj = JsonConvert.DeserializeObject<dynamic>(response.ToString())[0];
                     string id = obj.socketId;
                     string name = obj.username;
                     
                     this.Invoke((MethodInvoker)delegate {
                        if(!sessions.ContainsKey(id)) {
                             sessions.Add(id, new UserSession { SocketId = id, Username = name });
                             RefreshUserList();
                        } else {
                            sessions[id].IsOnline = true;
                            RefreshUserList();
                        }
                     });
                 } catch {}
             });

            // 4. User Disconnected
            client.On("user_disconnected", response => {
                try {
                     dynamic obj = JsonConvert.DeserializeObject<dynamic>(response.ToString())[0];
                     string id = obj.socketId;
                     this.Invoke((MethodInvoker)delegate {
                        if(sessions.ContainsKey(id)) {
                            sessions[id].IsOnline = false;
                            RefreshUserList();
                        }
                     });
                } catch {}
            });
            
             // 5. Connect
            try { await client.ConnectAsync(); } catch {}
        }

        // --- UI HANDLERS ---

        private void LstUsers_SelectionChanged(object sender, EventArgs e) {
            if(lstUsers.SelectedIndex == -1) return;
            
            var session = (UserSession)lstUsers.SelectedItem;
            activeSocketId = session.SocketId;
            session.HasUnread = false;
            
            // Update UI
            lblHeader.Text = $"Chat con: {session.Username}";
            btnCloseChat.Visible = true;
            RefreshUserList(); // Clear unread mark
            
            // Load History
            chatHistory.Clear();
            foreach(var line in session.History) {
                if(line.Contains("Soporte:")) AppendText(line + "\n", Color.Magenta);
                else AppendText(line + "\n", Color.Cyan);
            }
            chatHistory.ScrollToCaret();
        }

        private async void BtnSend_Click(object sender, EventArgs e) {
            if(string.IsNullOrWhiteSpace(txtInput.Text) || activeSocketId == null) return;
            
            var text = txtInput.Text;
            var reply = new { targetSocketId = activeSocketId, message = text };
            
            await client.EmitAsync("admin_reply", reply);
            
            // Local Log
            string time = DateTime.Now.ToShortTimeString();
            string log = $"[{time}] Soporte: {text}";
            sessions[activeSocketId].History.Add(log);
            AppendText(log + "\n", Color.Magenta);
            
            txtInput.Clear();
        }

        private async void BtnCloseChat_Click(object sender, EventArgs e) {
            if(activeSocketId == null) return;
            var result = MessageBox.Show("¿Finalizar y archivar chat?", "Confirmar", MessageBoxButtons.YesNo);
            if(result == DialogResult.Yes) {
                
                await client.EmitAsync("admin_close_chat", new { targetSocketId = activeSocketId });
                
                sessions.Remove(activeSocketId);
                activeSocketId = null;
                
                chatHistory.Clear();
                lblHeader.Text = "Chat finalizado.";
                btnCloseChat.Visible = false;
                RefreshUserList();
            }
        }

        // --- HELPERS ---

        private void RefreshUserList() {
            lstUsers.Items.Clear();
            foreach(var s in sessions.Values) {
                lstUsers.Items.Add(s);
            }
        }
        
        private void LstUsers_DrawItem(object sender, DrawItemEventArgs e) {
            e.DrawBackground();
            if (e.Index < 0) return;
            
            var session = (UserSession)lstUsers.Items[e.Index];
            Brush textBrush = Brushes.White;
            
            if(session.HasUnread) textBrush = Brushes.Cyan;
            if(!session.IsOnline) textBrush = Brushes.Gray;
            
            e.Graphics.DrawString(session.ToString(), e.Font, textBrush, e.Bounds);
            e.DrawFocusRectangle();
        }

        private void UpdateStatus(string text, Color color) {
            this.Invoke((MethodInvoker)delegate {
                lblStatus.Text = text;
                lblStatus.ForeColor = color;
            });
        }
        
        private void AppendText(string text, Color color) {
            chatHistory.SelectionStart = chatHistory.TextLength;
            chatHistory.SelectionLength = 0;
            chatHistory.SelectionColor = color;
            chatHistory.AppendText(text);
            chatHistory.SelectionColor = chatHistory.ForeColor;
            chatHistory.ScrollToCaret();
        }
    }
}
