/**
 * Auth Logic specifically for the Login Page
 * Connects to Server API
 */

export const initAuthPage = () => {
    // Elements
    const loginForm = document.getElementById('loginFormPage');
    const registerForm = document.getElementById('registerFormPage');

    // Inputs
    const pageRegUsername = document.getElementById('pageRegUsername');
    const pageRegEmail = document.getElementById('pageRegEmail');
    const pageRegDob = document.getElementById('pageRegDob');
    const pageRegPassword = document.getElementById('pageRegPassword');

    const pageLoginEmail = document.getElementById('pageLoginEmail');
    const pageLoginPassword = document.getElementById('pageLoginPassword');

    // BUFFER: Fallback to localStorage if server fails (optional but good for stability)
    // For now, we rely on server response.

    // REGISTER Logic
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const newUser = {
                username: pageRegUsername.value.trim(),
                email: pageRegEmail.value.trim(),
                dob: pageRegDob.value,
                password: pageRegPassword.value
            };

            if (newUser.password.length < 6) {
                alert('La contraseña debe tener al menos 6 caracteres');
                return;
            }

            // Call Server API
            fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        // Save session Locally for UI
                        localStorage.setItem('magicOshSession', JSON.stringify({ ...newUser, ...data.user }));

                        // REDIRECT TO SUCCESS PAGE
                        window.location.href = 'register_success.html';
                    } else {
                        alert('Error: ' + data.message);
                    }
                })
                .catch(err => {
                    console.error(err);
                    alert('Error conectando con el servidor. Intenta más tarde.');
                });
        });
    }

    // LOGIN Logic
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const credentials = {
                email: pageLoginEmail.value.trim(),
                password: pageLoginPassword.value
            };

            // Call Server API
            fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        // SAVE SESSION
                        localStorage.setItem('magicOshSession', JSON.stringify(data.user));

                        // REDIRECT TO DASHBOARD
                        window.location.href = 'dashboard.html';
                    } else {
                        alert('Error: ' + data.message);
                    }
                })
                .catch(err => {
                    console.error(err);
                    alert('Error conectando con el servidor.');
                });
        });
    }
};
