
/**
 * Auth Module
 * Handles Registration, Login, and Profile Management using LocalStorage
 */

export const initAuth = () => {
    // --- Elements ---
    const btnLogin = document.getElementById('btnLogin');
    const authModal = document.getElementById('authModal');
    const userMenu = document.getElementById('userMenu');
    const userDisplayName = document.getElementById('userDisplayName');
    const btnLogout = document.getElementById('btnLogout');
    const closeModalList = document.querySelectorAll('.close-modal');

    // Forms
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');

    // Profile
    const btnProfile = document.getElementById('btnProfile');
    const profileModal = document.getElementById('profileModal');
    const closeProfile = document.querySelector('.close-profile');

    // Inputs
    const regUsername = document.getElementById('regUsername');
    const regEmail = document.getElementById('regEmail');
    const regDob = document.getElementById('regDob');
    const regPassword = document.getElementById('regPassword');

    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');

    // Profile Fields
    const profileUsername = document.getElementById('profileUsername');
    const profileEmail = document.getElementById('profileEmail');
    const profileDob = document.getElementById('profileDob');

    // --- State Check ---
    checkSession();

    // --- Event Listeners ---

    // Open Login Modal
    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            authModal.classList.add('show');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        });
    }

    // Switch Forms
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.remove('active');
            loginForm.classList.add('active');
        });
    }

    // Close Modals
    closeModalList.forEach(btn => {
        btn.addEventListener('click', () => {
            authModal.classList.remove('show');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.classList.remove('show');
        }
        if (e.target === profileModal) {
            profileModal.classList.remove('show');
        }
    });

    // Registration Logic
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const newUser = {
                username: regUsername.value.trim(),
                email: regEmail.value.trim(),
                dob: regDob.value,
                password: regPassword.value // Note: In a real app, never store passwords plain text
            };

            // Simple validation
            if (newUser.password.length < 6) {
                alert('La contraseña debe tener al menos 6 caracteres');
                return;
            }

            // Save to LocalStorage (Simulated DB)
            const users = JSON.parse(localStorage.getItem('magicOshUsers') || '[]');

            if (users.find(u => u.email === newUser.email)) {
                alert('Este correo ya está registrado');
                return;
            }

            users.push(newUser);
            localStorage.setItem('magicOshUsers', JSON.stringify(users));

            alert('¡Cuenta creada con éxito! Por favor inicia sesión.');
            registerForm.classList.remove('active');
            loginForm.classList.add('active');
        });
    }

    // Login Logic
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const email = loginEmail.value.trim();
            const password = loginPassword.value;

            const users = JSON.parse(localStorage.getItem('magicOshUsers') || '[]');
            const user = users.find(u => u.email === email && u.password === password);

            if (user) {
                // Set Session
                localStorage.setItem('magicOshSession', JSON.stringify(user));
                checkSession();
                authModal.classList.remove('show');
            } else {
                alert('Credenciales incorrectas');
            }
        });
    }

    // Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('magicOshSession');
            checkSession();
        });
    }

    // Profile Modal
    if (btnProfile) {
        btnProfile.addEventListener('click', (e) => {
            e.preventDefault();
            loadProfileData();
            profileModal.classList.add('show');
        });
    }

    if (closeProfile) {
        closeProfile.addEventListener('click', () => {
            profileModal.classList.remove('show');
        });
    }

    // --- Helper Functions ---

    function checkSession() {
        const session = JSON.parse(localStorage.getItem('magicOshSession'));

        if (session) {
            btnLogin.style.display = 'none';
            userMenu.style.display = 'block';
            userDisplayName.textContent = session.username;
        } else {
            btnLogin.style.display = 'block';
            userMenu.style.display = 'none';
        }
    }

    function loadProfileData() {
        const session = JSON.parse(localStorage.getItem('magicOshSession'));
        if (session) {
            profileUsername.textContent = session.username;
            profileEmail.textContent = session.email;

            // Set Avatar Initial
            const avatarParams = document.getElementById('profileAvatar');
            if (avatarParams) avatarParams.textContent = session.username.charAt(0).toUpperCase();
            profileDob.textContent = session.dob || 'No especificada';
        }
    }

    console.log('Auth module loaded');
};

initAuth();
