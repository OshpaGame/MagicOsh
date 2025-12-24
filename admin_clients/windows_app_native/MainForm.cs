using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using SocketIOClient;
using Newtonsoft.Json;

namespace MagicOshAdmin {
    public partial class MainForm : Form {
        
        // UI Controls
        private ListBox lstUsers;
        private RichTextBox txtChat;
        private TextBox txtInput;
        private Button btnSend;
        private Button btnAttach; // NEW
        private Button btnCloseChat;
        private Label lblStatus; 
        private Label lblStats;   // NEW
        private Label lblActiveUser;
        private Panel sidebarPanel;
        private Panel chatPanel;

        // Logic
        private SocketIO client;
        private Dictionary<string, UserSession> sessions = new Dictionary<string, UserSession>();
        private string activeSocketId = null; 

        public MainForm() {
            InitializeComponent();
            SetupNetwork();
        }

        private void InitializeComponent() {
            this.Text = "MagicOsh Admin (Ops Center v2.0)";
            this.Size = new Size(1150, 700);
            this.BackColor = Color.FromArgb(10, 10, 20);
            this.ForeColor = Color.White;

            // --- 1. SIDEBAR ---
            sidebarPanel = new Panel { Dock = DockStyle.Left, Width = 280, BackColor = Color.FromArgb(20, 20, 30), Padding = new Padding(0) };
            
            Label lblOps = new Label { Text = "OPS CENTER", Dock = DockStyle.Top, Height = 50, ForeColor = Color.Cyan, Font = new Font("Segoe UI", 14, FontStyle.Bold), TextAlign = ContentAlignment.MiddleCenter };
            
            lblStatus = new Label { Text = "Conectando...", Dock = DockStyle.Bottom, Height = 30, ForeColor = Color.Gray, TextAlign = ContentAlignment.MiddleCenter, BackColor = Color.Black };

            lstUsers = new ListBox { 
                Dock = DockStyle.Fill, 
                BackColor = Color.FromArgb(20, 20, 30), 
                ForeColor = Color.White, 
                BorderStyle = BorderStyle.None,
                Font = new Font("Segoe UI", 11)
            };
            lstUsers.DrawMode = DrawMode.OwnerDrawFixed;
            lstUsers.ItemHeight = 40; // Taller for better look
            lstUsers.DrawItem += LstUsers_DrawItem;
            lstUsers.SelectedIndexChanged += LstUsers_SelectedIndexChanged;

            sidebarPanel.Controls.Add(lstUsers);
            sidebarPanel.Controls.Add(lblOps);
            sidebarPanel.Controls.Add(lblStatus);

            // --- 2. CHAT PANEL ---
            chatPanel = new Panel { Dock = DockStyle.Fill, BackColor = Color.Black };
            
            // Header
            Panel headerPanel = new Panel { Dock = DockStyle.Top, Height = 60, BackColor = Color.FromArgb(25, 25, 35), Padding = new Padding(10) };
            lblActiveUser = new Label { Text = "Sin Selección", Dock = DockStyle.Left, Width=400, TextAlign = ContentAlignment.MiddleLeft, Font = new Font("Segoe UI", 16, FontStyle.Bold), ForeColor = Color.White };
            
            // Stats Label (Top Right)
            lblStats = new Label { Text = "Visitas: 0 | Online: 0", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleRight, ForeColor = Color.Orange, Font = new Font("Consolas", 10) };

            btnCloseChat = new Button { Text = "FINALIZAR SESIÓN", Dock = DockStyle.Right, Width = 140, BackColor = Color.Crimson, FlatStyle = FlatStyle.Flat, ForeColor = Color.White, Font = new Font("Segoe UI", 9, FontStyle.Bold) };
            btnCloseChat.Click += BtnCloseChat_Click;
            btnCloseChat.Visible = false;

            headerPanel.Controls.Add(lblStats); // Middle
            headerPanel.Controls.Add(lblActiveUser); // Lefter
            headerPanel.Controls.Add(btnCloseChat); // Righter

            // Input Area
            Panel inputPanel = new Panel { Dock = DockStyle.Bottom, Height = 60, BackColor = Color.FromArgb(25, 25, 35), Padding = new Padding(10) };
            
            btnAttach = new Button { Text = "📎", Dock = DockStyle.Left, Width = 50, BackColor = Color.FromArgb(60,60,70), FlatStyle = FlatStyle.Flat, ForeColor = Color.White, Font = new Font("Segoe UI", 14) };
            btnAttach.Click += BtnAttach_Click;

            btnSend = new Button { Text = "ENVIAR", Dock = DockStyle.Right, Width = 100, BackColor = Color.DodgerBlue, FlatStyle = FlatStyle.Flat, ForeColor = Color.White, Font = new Font("Segoe UI", 10, FontStyle.Bold) };
            
            txtInput = new TextBox { Dock = DockStyle.Fill, BackColor = Color.FromArgb(40, 40, 50), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle, Font = new Font("Segoe UI", 12) };
            
            btnSend.Click += BtnSend_Click;
            txtInput.KeyDown += (s, e) => { if(e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; BtnSend_Click(s, e); } };

            // Wrapper just to give margin to TextBox
            Panel txtWrapper = new Panel { Dock = DockStyle.Fill, Padding = new Padding(10, 5, 10, 5) };
            txtWrapper.Controls.Add(txtInput);

            inputPanel.Controls.Add(txtWrapper);
            inputPanel.Controls.Add(btnAttach);
            inputPanel.Controls.Add(btnSend);

            // Chat Text Box
            txtChat = new RichTextBox { 
                Dock = DockStyle.Fill, 
                BackColor = Color.Black, 
                ForeColor = Color.Lime, 
                Font = new Font("Consolas", 11), 
                ReadOnly = true,
                BorderStyle = BorderStyle.None,
                Padding = new Padding(15)
            };

            chatPanel.Controls.Add(txtChat);
            chatPanel.Controls.Add(inputPanel); 
            chatPanel.Controls.Add(headerPanel);
            
            this.Controls.Add(chatPanel);
            this.Controls.Add(sidebarPanel);
        }

        // --- EVENTS ---

        private void LstUsers_DrawItem(object sender, DrawItemEventArgs e) {
            e.DrawBackground();
            if (e.Index >= 0) {
                UserSession item = (UserSession)lstUsers.Items[e.Index];
                
                // Traffic Light Colors
                Brush statusBrush = item.IsOnline ? Brushes.Lime : Brushes.Gray;
                if(item.HasUnread) statusBrush = Brushes.Yellow;

                string displayMain = item.Username.Length > 15 ? item.Username.Substring(0,12)+"..." : item.Username;
                string displaySub = item.IsOnline ? "En Linea" : "Desconectado";
                if(item.HasUnread) displaySub = "NUEVO MENSAJE";

                // Draw Circle
                e.Graphics.FillEllipse(statusBrush, e.Bounds.Left + 10, e.Bounds.Top + 12, 16, 16);
                
                // Draw Name
                e.Graphics.DrawString(displayMain, new Font("Segoe UI", 12, FontStyle.Bold), Brushes.White, e.Bounds.Left + 35, e.Bounds.Top + 4);
                // Draw Subtext
                e.Graphics.DrawString(displaySub, new Font("Segoe UI", 8), Brushes.Gray, e.Bounds.Left + 35, e.Bounds.Top + 24);

                // Separator
                e.Graphics.DrawLine(new Pen(Color.FromArgb(40,40,50)), e.Bounds.Left, e.Bounds.Bottom-1, e.Bounds.Right, e.Bounds.Bottom-1);
            }
        }

        private void LstUsers_SelectedIndexChanged(object sender, EventArgs e) {
            if (lstUsers.SelectedItem == null) return;
            var session = (UserSession)lstUsers.SelectedItem;
            
            activeSocketId = session.SocketId;
            lblActiveUser.Text = session.Username.ToUpper();
            btnCloseChat.Visible = true;
            session.HasUnread = false;
            
            RefreshChatView(session);
            RefreshUserList(); 
        }

        private void RefreshChatView(UserSession session) {
            txtChat.Clear();
            AppendText($"--- Historial con {session.Username} ---\n", Color.Gray);
            foreach(var msg in session.History) {
                Color c = msg.Contains("Soporte:") ? Color.Cyan : Color.Lime;
                if(msg.Contains("envió archivo")) c = Color.Orange;
                AppendText(msg + "\n", c);
            }
            txtChat.SelectionStart = txtChat.Text.Length;
            txtChat.ScrollToCaret();
        }

        private void RefreshUserList() {
            lstUsers.SelectedIndexChanged -= LstUsers_SelectedIndexChanged;
            int idx = lstUsers.SelectedIndex;
            lstUsers.Items.Clear();
            foreach(var s in sessions.Values) lstUsers.Items.Add(s);
            if(idx >= 0 && idx < lstUsers.Items.Count) lstUsers.SelectedIndex = idx;
            lstUsers.SelectedIndexChanged += LstUsers_SelectedIndexChanged;
        }

        private void AppendText(string text, Color color) {
            txtChat.SelectionStart = txtChat.TextLength;
            txtChat.SelectionLength = 0;
            txtChat.SelectionColor = color;
            txtChat.AppendText(text);
            txtChat.SelectionColor = txtChat.ForeColor;
            txtChat.ScrollToCaret();
        }

        // --- ACTIONS ---

        private void BtnSend_Click(object sender, EventArgs e) {
            if (string.IsNullOrWhiteSpace(txtInput.Text) || activeSocketId == null) return;
            var payload = new { targetSocketId = activeSocketId, message = txtInput.Text };
            client.EmitAsync("admin_reply", payload);
            
            if(sessions.ContainsKey(activeSocketId)) {
                var s = sessions[activeSocketId];
                string log = $"[{DateTime.Now.ToShortTimeString()}] Soporte: {txtInput.Text}";
                s.History.Add(log);
                RefreshChatView(s); // Force redraw to show msg
            }
            txtInput.Clear();
        }

        private void BtnAttach_Click(object sender, EventArgs e) {
            if (activeSocketId == null) { MessageBox.Show("Selecciona un usuario primero."); return; }

            using(OpenFileDialog ofd = new OpenFileDialog()) {
                ofd.Title = "Enviar archivo a " + lblActiveUser.Text;
                if(ofd.ShowDialog() == DialogResult.OK) {
                    try {
                        byte[] bytes = File.ReadAllBytes(ofd.FileName);
                        string base64 = Convert.ToBase64String(bytes);
                        string safeName = Path.GetFileName(ofd.FileName);

                        // Checks size (approx 50MB limit on server)
                        if(bytes.Length > 45 * 1024 * 1024) {
                             MessageBox.Show("Archivo demasiado grande. Máximo 45MB."); return;
                        }

                        var payload = new { targetSocketId = activeSocketId, fileName = safeName, fileBase64 = base64 };
                        client.EmitAsync("admin_file", payload);

                        // Log locally
                        if(sessions.ContainsKey(activeSocketId)) {
                             string log = $"[{DateTime.Now.ToShortTimeString()}] Soporte envió archivo: {safeName}";
                             sessions[activeSocketId].History.Add(log);
                             RefreshChatView(sessions[activeSocketId]);
                        }
                    } catch (Exception ex) { MessageBox.Show("Error leyendo archivo: " + ex.Message); }
                }
            }
        }

        private void BtnCloseChat_Click(object sender, EventArgs e) {
            if(activeSocketId == null) return;
            client.EmitAsync("admin_close_chat", new { targetSocketId = activeSocketId });
            
            if(sessions.ContainsKey(activeSocketId)) sessions.Remove(activeSocketId);
            RefreshUserList();
            txtChat.Clear();
            lblActiveUser.Text = "Sin Selección";
            activeSocketId = null;
            btnCloseChat.Visible = false;
        }

        // --- NETWORK ---

        private async void SetupNetwork() {
            client = new SocketIO("https://magicosh-service.onrender.com", new SocketIOOptions { 
                ConnectionTimeout = TimeSpan.FromSeconds(20)
            });

            // 1. Initial Full List (Active + Offline/Persisted)
            client.On("active_users_list", response => {
                try {
                    var users = response.GetValue<List<UserSession>>();
                    this.Invoke((MethodInvoker)delegate {
                        foreach(var u in users) {
                            if(!sessions.ContainsKey(u.SocketId)) sessions.Add(u.SocketId, u);
                            else {
                                // Update existing
                                sessions[u.SocketId].IsOnline = u.IsOnline; 
                                sessions[u.SocketId].History = u.History;
                            }
                        }
                        RefreshUserList();
                    });
                } catch {}
            });

            // 2. Stats Update
            client.On("stats_update", response => {
                try {
                    var data = response.GetValue<StatsData>();
                    this.Invoke((MethodInvoker)delegate {
                        lblStats.Text = $"VISITAS: {data.total_visits} | ONLINE: {data.online_users}";
                    });
                } catch {}
            });

            // 3. New Message
            client.On("new_message", response => {
                try {
                    var data = response.GetValue<MessageData>(); 
                    if(data == null) return;

                    string sid = data.socketId;

                    this.Invoke((MethodInvoker)delegate {
                        if(!sessions.ContainsKey(sid)) {
                            // New Session
                            sessions.Add(sid, new UserSession { SocketId = sid, Username = data.username, IsOnline=true });
                        }
                        
                        var s = sessions[sid];
                        s.IsOnline = true;
                        string ts = data.timestamp ?? DateTime.Now.ToShortTimeString();
                        s.History.Add($"[{ts}] {data.username}: {data.text}");

                        if(activeSocketId == sid) RefreshChatView(s);
                        else {
                            s.HasUnread = true;
                            RefreshUserList();
                            System.Media.SystemSounds.Exclamation.Play();
                        }
                    });
                } catch {}
            });

            // 4. Connect/Disconnect Events
            client.On("user_connected", response => {
                try {
                    var obj = response.GetValue<UserSession>();
                    this.Invoke((MethodInvoker)delegate {
                        if(!sessions.ContainsKey(obj.SocketId)) sessions.Add(obj.SocketId, obj);
                        else sessions[obj.SocketId].IsOnline = true;
                        RefreshUserList();
                    });
                } catch {}
            });
            client.On("user_disconnected", response => {
                 try {
                    var obj = response.GetValue<UserSession>();
                    this.Invoke((MethodInvoker)delegate {
                        if(sessions.ContainsKey(obj.SocketId)) {
                             sessions[obj.SocketId].IsOnline = false;
                             RefreshUserList();
                        }
                    });
                } catch {}
            });

            client.OnConnected += (s, e) => {
                this.Invoke((MethodInvoker)delegate {
                    lblStatus.Text = "CONECTADO A LA NUBE ☁";
                    lblStatus.ForeColor = Color.Lime;
                    client.EmitAsync("identify", new { type = "admin_windows_native" });
                });
            };

            try { await client.ConnectAsync(); } catch {}
        }
    }

    // Models
    public class UserSession {
        [JsonProperty("socketId")] public string SocketId { get; set; }
        [JsonProperty("username")] public string Username { get; set; }
        [JsonProperty("email")] public string Email { get; set; }
        [JsonProperty("history")] public List<string> History { get; set; } = new List<string>();
        [JsonProperty("connected")] public bool IsOnline { get; set; } = true;
        [JsonIgnore] public bool HasUnread { get; set; } = false;
        public override string ToString() { return Username; } // Simple string for list, but we custom draw it
    }

    public class MessageData {
        [JsonProperty("socketId")] public string socketId { get; set; }
        [JsonProperty("username")] public string username { get; set; }
        [JsonProperty("text")] public string text { get; set; }
        [JsonProperty("timestamp")] public string timestamp { get; set; }
    }

    public class StatsData {
        [JsonProperty("total_visits")] public int total_visits { get; set; }
        [JsonProperty("online_users")] public int online_users { get; set; }
    }
}
