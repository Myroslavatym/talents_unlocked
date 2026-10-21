(function () {
    const USERS_KEY = 'talents_users';
    const SESSION_KEY = 'talents_current_user';
    const ATTEMPTS_KEY = 'talents_login_attempts';
    const SESSION_MS = 24 * 60 * 60 * 1000;
    const MAX_ATTEMPTS = 5;
    const LOCK_MS = 5 * 60 * 1000;
    const PBKDF2_ITERATIONS = 310000;

    const params = new URLSearchParams(window.location.search);
    const noticeBox = document.getElementById('notice-box');

    function readJson(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value === null ? fallback : value;
        } catch {
            return fallback;
        }
    }

    function showNotice(text, isError) {
        if (!noticeBox) return;
        const p = document.createElement('p');
        p.className = isError ? 'notice error' : 'notice';
        p.setAttribute('role', isError ? 'alert' : 'status');
        p.textContent = text;
        noticeBox.replaceChildren(p);
    }

    const getUsers = () => readJson(USERS_KEY, []);
    const saveUsers = (users) => localStorage.setItem(USERS_KEY, JSON.stringify(users));

    function getCurrentUser() {
        const session = readJson(SESSION_KEY, null);
        if (!session || !session.expiresAt || session.expiresAt < Date.now()) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return session;
    }

    function setCurrentUser(user) {
        if (user) {
            localStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name, email: user.email, expiresAt: Date.now() + SESSION_MS }));
        } else {
            localStorage.removeItem(SESSION_KEY);
        }
    }

    const toHex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
    const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));

    async function hashPassword(password, saltHex) {
        const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
        return { salt: toHex(salt), hash: toHex(bits) };
    }

    function safeEqual(a, b) {
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return diff === 0;
    }

    async function verifyPassword(user, password) {
        if (user.hash && user.salt) {
            const { hash } = await hashPassword(password, user.salt);
            return safeEqual(hash, user.hash);
        }
        return typeof user.password === 'string' && safeEqual(user.password, password);
    }

    const cryptoAvailable = () => Boolean(window.crypto && crypto.subtle);

    function lockRemaining(email) {
        const entry = readJson(ATTEMPTS_KEY, {})[email];
        return entry && entry.lockedUntil > Date.now() ? entry.lockedUntil - Date.now() : 0;
    }

    function registerFailure(email) {
        const attempts = readJson(ATTEMPTS_KEY, {});
        const entry = attempts[email] && attempts[email].lockedUntil > Date.now() ? attempts[email] : { count: 0, lockedUntil: 0 };
        entry.count = (attempts[email] && !attempts[email].lockedUntil ? attempts[email].count : entry.count) + 1;
        if (entry.count >= MAX_ATTEMPTS) {
            entry.lockedUntil = Date.now() + LOCK_MS;
            entry.count = 0;
        }
        attempts[email] = entry;
        localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    }

    function clearFailures(email) {
        const attempts = readJson(ATTEMPTS_KEY, {});
        delete attempts[email];
        localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    }

    function setBusy(form, busy) {
        const button = form.querySelector('button[type="submit"]');
        if (button) button.disabled = busy;
    }

    const currentUser = getCurrentUser();
    document.body.dataset.auth = currentUser ? 'user' : 'guest';
    const page = document.body.dataset.page;
    if (currentUser && (page === 'signup' || page === 'login')) {
        window.location.replace('/dashboard.html');
        return;
    }

    if (params.get('created') === '1') showNotice('Your account is ready. Log in to get started.', false);

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const values = {
                name: signupForm.elements.name.value,
                email: signupForm.elements.email.value,
                password: signupForm.elements.password.value,
                confirm_password: signupForm.elements.confirm_password.value,
            };
            if (window.TUValidation && Object.keys(window.TUValidation.validateSignup(values)).length) return;
            if (!cryptoAvailable()) return showNotice('Secure sign-up needs HTTPS (or localhost). Please open the site over HTTPS.', true);

            const name = window.TUValidation ? window.TUValidation.cleanName(values.name) : values.name.trim();
            const email = values.email.trim().toLowerCase();
            const users = getUsers();
            if (users.some((u) => u.email === email)) {
                return showNotice('This email is already registered. Please log in.', true);
            }

            setBusy(signupForm, true);
            const { salt, hash } = await hashPassword(values.password);
            users.push({ name, email, salt, hash, createdAt: new Date().toISOString() });
            saveUsers(users);
            window.location.href = '/login.html?created=1';
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase().slice(0, 254);
            const password = document.getElementById('password').value.slice(0, 128);
            if (!email || !password) return showNotice('Please enter your email and password.', true);
            if (!cryptoAvailable()) return showNotice('Secure log-in needs HTTPS (or localhost).', true);

            const remaining = lockRemaining(email);
            if (remaining) {
                return showNotice('Too many failed attempts. Please wait ' + Math.ceil(remaining / 60000) + ' minute(s) and try again.', true);
            }

            setBusy(loginForm, true);
            const users = getUsers();
            const user = users.find((u) => u.email === email);
            const ok = user ? await verifyPassword(user, password) : (await hashPassword(password), false);
            setBusy(loginForm, false);

            if (!ok) {
                registerFailure(email);
                return showNotice('Email or password is incorrect. Please try again.', true);
            }

            if (!user.hash) {
                Object.assign(user, await hashPassword(password));
                delete user.password;
                saveUsers(users);
            }
            clearFailures(email);
            setCurrentUser(user);
            window.location.href = '/dashboard.html';
        });
    }

    const dashboardAvatar = document.getElementById('user-avatar');
    if (dashboardAvatar) {
        if (!currentUser) {
            window.location.replace('/login.html');
            return;
        }
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('user-email').textContent = currentUser.email;
        const firstNameEl = document.getElementById('user-first-name');
        if (firstNameEl) firstNameEl.textContent = currentUser.name.split(' ')[0];
        dashboardAvatar.textContent = (currentUser.name[0] || 'U').toUpperCase();

        const logoutForm = document.getElementById('logout-form');
        if (logoutForm) {
            logoutForm.addEventListener('submit', function (e) {
                e.preventDefault();
                setCurrentUser(null);
                window.location.href = '/login.html';
            });
        }
    }

    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        forgotForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return showNotice('Please enter a valid email address.', true);
            showNotice('If an account exists for this email, a reset link will be sent. (Demo mode: no email is sent.)', false);
        });
    }
})();
