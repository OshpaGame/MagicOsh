/**
 * Auth Module (Index Page)
 * Handles Header State (Login vs Avatar) based on Session
 */

console.log("Auth Module Loaded");

export const initAuth = () => {
    console.log("Initializing Auth Logic...");

    // Elements
    const btnLogin = document.getElementById('btnLogin'); // The <a> link
    const userMenu = document.getElementById('userMenu');
    const userDisplayName = document.getElementById('userDisplayName');
    const btnLogout = document.getElementById('btnLogout');
    const btnProfile = document.getElementById('btnProfile');

    // Profile Modal Elements
    const profileModal = document.getElementById('profileModal');
    const closeProfile = document.querySelector('.close-profile');

    // Debug Element Finding
    if (!btnLogin) console.error("CRITICAL: btnLogin not found in DOM!");
    if (!userMenu) console.error("CRITICAL: userMenu not found in DOM!");

    // --- State Check ---
    checkSession();

    // --- Logout Logic ---
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Logging out...");
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

    window.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            profileModal.classList.remove('show');
        }
    });


    // --- Helper Functions ---

    function checkSession() {
        const sessionJson = localStorage.getItem('magicOshSession');
        console.log('Session Status:', sessionJson ? 'Active' : 'None');

        if (sessionJson) {
            const session = JSON.parse(sessionJson);

            // HIDE LOGIN BUTTON
            if (btnLogin) {
                btnLogin.style.display = 'none';
                btnLogin.style.setProperty('display', 'none', 'important'); // Force verify
            }

            // SHOW USER MENU
            if (userMenu) userMenu.style.display = 'block';

            // Show Avatar in Header
            if (userDisplayName) {
                const initial = session.username ? session.username.charAt(0).toUpperCase() : 'U';
                userDisplayName.innerHTML = `<div class="avatar-circle" style="width: 40px; height: 40px; font-size: 1.2rem; margin: 0; box-shadow: none; border: 1px solid rgba(255,255,255,0.5); cursor:pointer; display:flex;" onclick="window.location.href='dashboard.html'">${initial}</div>`;
            }

            // Hide Chat Overlay
            const chatOverlay = document.getElementById('chatLoginOverlay');
            if (chatOverlay) chatOverlay.style.display = 'none';

        } else {
            // SHOW LOGIN BUTTON
            if (btnLogin) btnLogin.style.display = 'inline-block';

            // HIDE USER MENU
            if (userMenu) userMenu.style.display = 'none';

            // Show Chat Overlay
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

// AUTO-EXECUTE WHEN DOM IS READY
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
