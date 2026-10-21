(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.TUValidation = api;
        if (typeof document !== 'undefined') api.autoAttach();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    const RULES = { NAME_MIN: 2, NAME_MAX: 50, EMAIL_MAX: 254, PASSWORD_MIN: 8, PASSWORD_MAX: 128 };
    const NAME_PATTERN = /^\p{L}+(?:[ '\-]\p{L}+)*$/u;
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[^\s@.]{2,}$/;

    function cleanName(name) {
        return String(name || '').trim().split(/\s+/).filter(Boolean).join(' ');
    }

    function passwordChecks(password) {
        return {
            length: password.length >= RULES.PASSWORD_MIN,
            lower: /[a-z]/.test(password),
            upper: /[A-Z]/.test(password),
            number: /[0-9]/.test(password),
        };
    }

    const PROBLEM_TEXT = {
        length: 'at least ' + RULES.PASSWORD_MIN + ' characters',
        lower: 'a lowercase letter',
        upper: 'an uppercase letter',
        number: 'a number',
    };

    const validators = {
        name(values) {
            const name = cleanName(values.name);
            if (!name) return 'Please enter your name.';
            if (name.length < RULES.NAME_MIN || name.length > RULES.NAME_MAX) {
                return 'Name must be between ' + RULES.NAME_MIN + ' and ' + RULES.NAME_MAX + ' characters.';
            }
            if (!NAME_PATTERN.test(name)) return 'Name can only contain letters, spaces, hyphens and apostrophes.';
            return '';
        },
        email(values) {
            const email = String(values.email || '').trim();
            if (!email) return 'Please enter your email address.';
            if (email.length > RULES.EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
                return 'Please enter a valid email address (e.g. you@example.com).';
            }
            return '';
        },
        password(values) {
            const password = String(values.password || '');
            if (!password) return 'Please create a password.';
            if (password.length > RULES.PASSWORD_MAX) return 'Password must be at most ' + RULES.PASSWORD_MAX + ' characters.';
            const checks = passwordChecks(password);
            const problems = Object.keys(checks).filter((rule) => !checks[rule]).map((rule) => PROBLEM_TEXT[rule]);
            return problems.length ? 'Password must contain ' + problems.join(', ') + '.' : '';
        },
        confirm_password(values) {
            const confirm = String(values.confirm_password || '');
            if (!confirm) return 'Please confirm your password.';
            if (confirm !== String(values.password || '')) return 'Passwords do not match.';
            return '';
        },
    };

    function validateSignup(values) {
        const errors = {};
        Object.keys(validators).forEach((field) => {
            const message = validators[field](values);
            if (message) errors[field] = message;
        });
        return errors;
    }

    function passwordStrength(password) {
        if (!password) return { score: 0, label: '' };
        const checks = passwordChecks(password);
        let score = Object.values(checks).filter(Boolean).length;
        if (password.length >= 12) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;
        const level = score <= 2 ? 1 : score <= 3 ? 2 : score <= 4 ? 3 : 4;
        return { score: level, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][level] };
    }

    function showNotice(box, text) {
        if (!box) return;
        box.replaceChildren();
        if (!text) return;
        const p = document.createElement('p');
        p.className = 'notice error';
        p.setAttribute('role', 'alert');
        p.textContent = text;
        box.appendChild(p);
    }

    function attachSignupForm(form) {
        const fields = Object.keys(validators);
        const touched = {};
        const notice = document.getElementById('notice-box');

        const values = () => {
            const data = {};
            fields.forEach((field) => {
                const input = form.elements[field];
                data[field] = input ? input.value : '';
            });
            return data;
        };

        function setFieldState(field, message) {
            const input = form.elements[field];
            if (!input) return;
            const wrapper = input.closest('.field');
            const errorEl = document.getElementById(field + '-error');
            if (errorEl) errorEl.textContent = message;
            input.setAttribute('aria-invalid', message ? 'true' : 'false');
            if (wrapper) {
                wrapper.classList.toggle('has-error', Boolean(message));
                wrapper.classList.toggle('is-valid', !message && input.value !== '');
            }
        }

        function validateField(field) {
            const message = validators[field](values());
            setFieldState(field, message);
            return message;
        }

        function updatePasswordUi() {
            const password = form.elements.password ? form.elements.password.value : '';
            const checks = passwordChecks(password);
            form.querySelectorAll('[data-rule]').forEach((item) => {
                item.classList.toggle('met', Boolean(checks[item.dataset.rule]));
            });
            const meter = form.querySelector('.strength');
            if (meter) {
                const strength = passwordStrength(password);
                meter.dataset.score = String(strength.score);
                const label = meter.querySelector('.strength-label');
                if (label) label.textContent = strength.label;
            }
        }

        fields.forEach((field) => {
            const input = form.elements[field];
            if (!input) return;
            input.addEventListener('blur', () => {
                if (input.value !== '') touched[field] = true;
                if (touched[field]) validateField(field);
            });
            input.addEventListener('input', () => {
                if (touched[field]) validateField(field);
                if (field === 'password') {
                    updatePasswordUi();
                    if (touched.confirm_password) validateField('confirm_password');
                }
            });
        });

        form.querySelectorAll('.toggle-password').forEach((button) => {
            button.addEventListener('click', () => {
                const input = document.getElementById(button.getAttribute('aria-controls'));
                if (!input) return;
                const show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                button.textContent = show ? 'Hide' : 'Show';
                button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
                button.setAttribute('aria-pressed', String(show));
            });
        });

        form.addEventListener('submit', (event) => {
            const invalid = fields.filter((field) => {
                touched[field] = true;
                return validateField(field);
            });
            if (invalid.length) {
                event.preventDefault();
                event.stopImmediatePropagation();
                showNotice(notice, 'Please fix the highlighted fields.');
                form.elements[invalid[0]].focus();
            }
        });

        updatePasswordUi();
    }

    function autoAttach() {
        const form = document.getElementById('signup-form');
        if (form) attachSignupForm(form);
    }

    return { RULES, cleanName, passwordChecks, passwordStrength, validateSignup, attachSignupForm, autoAttach };
});
