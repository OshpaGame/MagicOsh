/**
 * Auth Module (Index Page)
 * Handles Header State (Login vs Avatar) based on Session
 */

export const initAuth = () => {
    // Elements
    const btnLogin = document.getElementById('btnLogin'); // The <a> link
    const userMenu = document.getElementById('userMenu');
    const userDisplayName = document.getElementById('userDisplayName');
    const btnLogout = document.getElementById('btnLogout');
    const btnProfile = document.getElementById('btnProfile');

    // Profile Modal Elements (We kept the profile modal)
    const profileModal = document.getElementById('profileModal');
    const closeProfile = document.querySelector('.close-profile');

    // --- State Check ---
    checkSession();

    // --- Logout Logic ---
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('magicOshSession');
            checkSession();
            window.location.reload();
        });
    }

    // --- Profile Modal Logic ---
    if (btnProfile) {
        btnProfile.addEventListener('click', (e) => {
            e.preventDefault();
            loadProfileData();
            if (profileModal) profileModal.classList.add('show');
        });
    }

    if (closeProfile) {
        closeProfile.addEventListener('click', () => {
            if (profileModal) profileModal.classList.remove('show');
        });
    }

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            profileModal.classList.remove('show');
        }
    });


    // --- Helper Functions ---

    function checkSession() {
        const sessionJson = localStorage.getItem('magicOshSession');

        // Debug
        console.log('Checking Session:', sessionJson);

        if (sessionJson) {
            const session = JSON.parse(sessionJson);

            if (btnLogin) btnLogin.style.display = 'none';
            if (userMenu) userMenu.style.display = 'block';

            // Show Avatar in Header
            if (userDisplayName) {
                const initial = session.username ? session.username.charAt(0).toUpperCase() : 'U';
                userDisplayName.innerHTML = `<div class="avatar-circle" style="width: 40px; height: 40px; font-size: 1.2rem; margin: 0; box-shadow: none; border-width: 1px; cursor:pointer;" onclick="document.getElementById('btnProfile').click()">${initial}</div>`;
            }

            // Also check chat overlap if on homepage
            const chatOverlay = document.getElementById('chatLoginOverlay');
            if (chatOverlay) chatOverlay.style.display = 'none';

        } else {
            if (btnLogin) btnLogin.style.display = 'inline-block'; // or block
            if (userMenu) userMenu.style.display = 'none';

            // Show chat overlay
            const chatOverlay = document.getElementById('chatLoginOverlay');
            if (chatOverlay) chatOverlay.style.display = 'flex';
        }
    }

    function loadProfileData() {
        const session = JSON.parse(localStorage.getItem('magicOshSession'));
        if (session) {
            const profileUsername = document.getElementById('profileUsername');
            const profileEmail = document.getElementById('profileEmail');
            const profileAvatar = document.getElementById('profileAvatar');
            const profileDob = document.getElementById('profileDob');

            if (profileUsername) profileUsername.textContent = session.username;
            if (profileEmail) profileEmail.textContent = session.email;
            if (profileDob) profileDob.textContent = session.dob || 'No especificada';
            if (profileAvatar) profileAvatar.textContent = session.username.charAt(0).toUpperCase();
        }
    }
};

initAuth();
