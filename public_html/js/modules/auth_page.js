/**
 * Auth Logic specifically for the Login Page
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

            const users = JSON.parse(localStorage.getItem('magicOshUsers') || '[]');

            if (users.find(u => u.email === newUser.email)) {
                alert('Este correo ya está registrado');
                return;
            }

            users.push(newUser);
            localStorage.setItem('magicOshUsers', JSON.stringify(users));

            alert('¡Cuenta creada con éxito! Ahora inicia sesión.');

            // Switch to Login Tab
            registerForm.classList.remove('active');
            loginForm.classList.add('active');
            // Pre-fill email
            pageLoginEmail.value = newUser.email;
        });
    }

    // LOGIN Logic
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const email = pageLoginEmail.value.trim();
            const password = pageLoginPassword.value;

            const users = JSON.parse(localStorage.getItem('magicOshUsers') || '[]');
            const user = users.find(u => u.email === email && u.password === password);

            if (user) {
                // SAVE SESSION
                localStorage.setItem('magicOshSession', JSON.stringify(user));

                // REDIRECT TO HOME
                window.location.href = 'index.html';
            } else {
                alert('Correo o contraseña incorrectos');
            }
        });
    }
};
