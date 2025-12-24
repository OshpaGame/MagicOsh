using System;
using System.Drawing;
using System.Windows.Forms;
using SocketIOClient;
using Newtonsoft.Json;

namespace MagicOshAdmin
{
    public partial class MainForm : Form
    {
        private SocketIO client;
        private string currentTargetSocketId;
        
        // UI Components
        private RichTextBox chatHistory;
        private TextBox txtInput;
        private Button btnSend;
        private Label lblStatus;
        private Panel sidebar;

        public MainForm()
        {
            InitializeComponent();
            SetupNeonTheme();
            InitializeSocket();
        }

        private void InitializeComponent()
        {
            this.Size = new Size(1000, 700);
            this.Text = "MagicOsh Admin Panel (Official)";
            this.Icon = SystemIcons.Application;

            // Sidebar
            sidebar = new Panel();
            sidebar.Dock = DockStyle.Left;
            sidebar.Width = 200;
            sidebar.BackColor = Color.FromArgb(10, 10, 26);
            
            Label lblLogo = new Label();
            lblLogo.Text = "MagicOsh";
            lblLogo.ForeColor = Color.White;
            lblLogo.Font = new Font("Segoe UI", 16, FontStyle.Bold);
            lblLogo.Location = new Point(20, 20);
            lblLogo.AutoSize = true;
            sidebar.Controls.Add(lblLogo);

            // Chat Area Base
            Panel chatPanel = new Panel();
            chatPanel.Dock = DockStyle.Fill;
            chatPanel.BackColor = Color.FromArgb(5, 5, 16);
            chatPanel.Padding = new Padding(20);

            // Status Header
            lblStatus = new Label();
            lblStatus.Text = "Estado: Desconectado 🔴";
            lblStatus.ForeColor = Color.Gray;
            lblStatus.Dock = DockStyle.Top;
            lblStatus.Height = 30;

            // Chat History
            chatHistory = new RichTextBox();
            chatHistory.Dock = DockStyle.Fill;
            chatHistory.BackColor = Color.FromArgb(15, 15, 30);
            chatHistory.ForeColor = Color.White;
            chatHistory.ReadOnly = true;
            chatHistory.BorderStyle = BorderStyle.None;
            chatHistory.Font = new Font("Segoe UI", 10);
            chatHistory.Margin = new Padding(0, 10, 0, 10);

            // Input Area
            Panel inputPanel = new Panel();
            inputPanel.Dock = DockStyle.Bottom;
            inputPanel.Height = 50;
            inputPanel.BackColor = Color.Transparent;

            btnSend = new Button();
            btnSend.Text = "ENVIAR";
            btnSend.Dock = DockStyle.Right;
            btnSend.Width = 100;
            btnSend.FlatStyle = FlatStyle.Flat;
            btnSend.BackColor = Color.FromArgb(176, 0, 255); // Neon Purple
            btnSend.ForeColor = Color.White;
            btnSend.Click += BtnSend_Click;

            txtInput = new TextBox();
            txtInput.Dock = DockStyle.Fill;
            txtInput.BackColor = Color.FromArgb(30, 30, 45);
            txtInput.ForeColor = Color.White;
            txtInput.BorderStyle = BorderStyle.FixedSingle;
            txtInput.Font = new Font("Segoe UI", 12);
            txtInput.KeyDown += (s, e) => { if (e.KeyCode == Keys.Enter) BtnSend_Click(s, e); };

            inputPanel.Controls.Add(txtInput);
            inputPanel.Controls.Add(btnSend);

            // Layout Assembly
            chatPanel.Controls.Add(chatHistory);
            chatPanel.Controls.Add(inputPanel);
            chatPanel.Controls.Add(lblStatus);

            this.Controls.Add(chatPanel);
            this.Controls.Add(sidebar);
        }

        private void SetupNeonTheme()
        {
            this.BackColor = Color.FromArgb(5, 5, 16);
        }

        private async void InitializeSocket()
        {
            // REPLACE WITH YOUR RENDER URL or Localhost
            client = new SocketIO("http://localhost:3000");

            client.OnConnected += async (sender, e) =>
            {
                this.Invoke((MethodInvoker)delegate {
                    lblStatus.Text = "Estado: Conectado 🟢 (MagicOsh Server)";
                    lblStatus.ForeColor = Color.LightGreen;
                    AppendText("Conectado al servidor central.\n", Color.Gray);
                });
                
                await client.EmitAsync("identify", new { type = "admin_windows_native" });
            };

            client.On("new_message", response =>
            {
                // Deserialize msg
                var msg = JsonConvert.DeserializeObject<MessageData>(response.GetValue<string>()); // Simplified
                // Note: SocketIOClient usually returns JsonElement, robust parsing needed here in real app
                
                // For demo, we treat response as raw struct
                try {
                   var obj = JsonConvert.DeserializeObject<dynamic>(response.ToString());
                   string user = obj[0].username;
                   string text = obj[0].text;
                   string socketId = obj[0].socketId;

                   this.Invoke((MethodInvoker)delegate {
                       currentTargetSocketId = socketId;
                       AppendText($"[{DateTime.Now.ToShortTimeString()}] {user}: ", Color.Cyan);
                       AppendText($"{text}\n", Color.White);
                       txtInput.PlaceholderText = $"Responder a {user}...";
                   });
                } catch (Exception ex) {
                   // Debug
                }
            });

            try {
                await client.ConnectAsync();
            } catch (Exception ex) {
                MessageBox.Show("Error conectando al servidor: " + ex.Message);
            }
        }

        private async void BtnSend_Click(object sender, EventArgs e)
        {
            if (string.IsNullOrWhiteSpace(txtInput.Text) || currentTargetSocketId == null) return;

            var reply = new 
            {
                targetSocketId = currentTargetSocketId,
                message = txtInput.Text
            };

            await client.EmitAsync("admin_reply", reply);

            AppendText($"[Yo]: {txtInput.Text}\n", Color.Magenta);
            txtInput.Clear();
        }

        private void AppendText(string text, Color color)
        {
            chatHistory.SelectionStart = chatHistory.TextLength;
            chatHistory.SelectionLength = 0;
            chatHistory.SelectionColor = color;
            chatHistory.AppendText(text);
            chatHistory.SelectionColor = chatHistory.ForeColor;
            chatHistory.ScrollToCaret();
        }
    }

    // Helper class
    public class MessageData {
        public string username { get; set; }
        public string text { get; set; }
        public string socketId { get; set; }
    }
}
