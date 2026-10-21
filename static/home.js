(function () {
    const courses = window.TU_COURSES || [];
    const grid = document.getElementById('course-grid');
    if (!grid) return;

    const chipsBox = document.getElementById('category-chips');
    const searchForm = document.getElementById('course-search-form');
    const searchInput = document.getElementById('course-search');
    const countEl = document.getElementById('course-count');
    const emptyEl = document.getElementById('course-empty');
    const modal = document.getElementById('course-modal');
    const signupUrl = grid.dataset.signupUrl || '/signup';
    const dashboardUrl = grid.dataset.dashboardUrl || '/dashboard';

    const state = { category: 'All', query: '' };
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const ICONS = {
        code: ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6'],
        layout: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M3 9h18', 'M9 21V9'],
        chart: ['M3 3v18h18', 'M7 15l4-4 3 3 5-6'],
        cpu: ['M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M9 9h6v6H9z', 'M9 2v3', 'M15 2v3', 'M9 19v3', 'M15 19v3', 'M2 9h3', 'M2 15h3', 'M19 9h3', 'M19 15h3'],
        palette: ['M12 22a10 10 0 1 1 10-10c0 2.5-2 3.5-3.5 3.5H16a2 2 0 0 0-1.5 3.3A2 2 0 0 1 13 22z', 'M7.5 10.5h.01', 'M12 7h.01', 'M16.5 10.5h.01'],
        sigma: ['M18 7V4H6l6 8-6 8h12v-3'],
        megaphone: ['M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z', 'M16 8.5a5 5 0 0 1 0 7', 'M19 5.5a9 9 0 0 1 0 13'],
        globe: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M2 12h20', 'M12 2a15 15 0 0 1 0 20', 'M12 2a15 15 0 0 0 0 20'],
        mic: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
        star: ['M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z'],
        clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
        book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
        signal: ['M5 20v-4', 'M12 20v-9', 'M19 20V5'],
        users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
        check: ['M20 6L9 17l-5-5'],
    };

    function icon(name, className) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('class', 'icon ' + (className || ''));
        (ICONS[name] || []).forEach((d) => {
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', d);
            svg.appendChild(path);
        });
        return svg;
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function meta(iconName, text) {
        const item = el('span', 'meta-item');
        item.append(icon(iconName), document.createTextNode(text));
        return item;
    }

    function formatLearners(n) {
        return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n);
    }

    function isLoggedIn() {
        return document.body.dataset.auth === 'user';
    }

    function renderChips() {
        const counts = courses.reduce((acc, c) => {
            acc[c.category] = (acc[c.category] || 0) + 1;
            return acc;
        }, {});
        const categories = ['All'].concat(Object.keys(counts));
        chipsBox.replaceChildren();
        categories.forEach((category) => {
            const chip = el('button', 'chip');
            chip.type = 'button';
            chip.dataset.category = category;
            chip.setAttribute('aria-pressed', String(category === state.category));
            chip.append(el('span', '', category), el('span', 'chip-count', String(category === 'All' ? courses.length : counts[category])));
            chip.addEventListener('click', () => {
                state.category = category;
                chipsBox.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
                renderCourses();
            });
            chipsBox.appendChild(chip);
        });
    }

    function matches(course) {
        if (state.category !== 'All' && course.category !== state.category) return false;
        if (!state.query) return true;
        const haystack = [course.title, course.category, course.instructor, course.level].concat(course.skills).join(' ').toLowerCase();
        return state.query.split(/\s+/).every((word) => haystack.includes(word));
    }

    function buildCard(course, index) {
        const card = el('article', 'course-card');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', 'Preview course: ' + course.title);
        card.style.setProperty('--c1', course.colors[0]);
        card.style.setProperty('--c2', course.colors[1]);
        card.style.setProperty('--delay', index * 60 + 'ms');

        const thumb = el('div', 'course-thumb');
        thumb.append(el('span', 'thumb-tag', course.category), icon(course.icon, 'thumb-icon'), el('span', 'thumb-badge', 'Free preview'));

        const body = el('div', 'course-body');
        const rating = el('span', 'rating');
        rating.append(icon('star', 'star'), el('strong', '', course.rating.toFixed(1)), el('span', 'muted', '(' + formatLearners(course.learners) + ' learners)'));
        const metaRow = el('div', 'course-meta');
        metaRow.append(meta('signal', course.level), meta('clock', course.hours + 'h'), meta('book', course.lessons + ' lessons'));

        body.append(el('h3', 'course-title', course.title), el('p', 'course-instructor', course.instructor), rating, metaRow);
        card.append(thumb, body);

        card.addEventListener('click', () => openModal(course));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openModal(course);
            }
        });
        return card;
    }

    function renderCourses() {
        const visible = courses.filter(matches);
        grid.replaceChildren(...visible.map(buildCard));
        emptyEl.hidden = visible.length > 0;
        countEl.textContent = visible.length === courses.length ? courses.length + ' courses' : visible.length + ' of ' + courses.length + ' courses';
    }

    function openModal(course) {
        if (!modal) return;
        modal.style.setProperty('--c1', course.colors[0]);
        modal.style.setProperty('--c2', course.colors[1]);
        const header = modal.querySelector('.modal-hero');
        header.querySelector('.modal-icon').replaceChildren(icon(course.icon));
        modal.querySelector('#modal-category').textContent = course.category + ' · ' + course.level;
        modal.querySelector('#modal-title').textContent = course.title;
        modal.querySelector('#modal-instructor').textContent = 'with ' + course.instructor;
        modal.querySelector('#modal-description').textContent = course.description;

        const stats = modal.querySelector('#modal-stats');
        stats.replaceChildren(
            meta('star', course.rating.toFixed(1) + ' rating'),
            meta('users', formatLearners(course.learners) + ' learners'),
            meta('clock', course.hours + ' hours'),
            meta('book', course.lessons + ' lessons')
        );

        const skills = modal.querySelector('#modal-skills');
        skills.replaceChildren(...course.skills.map((s) => el('li', 'skill', s)));

        const modules = modal.querySelector('#modal-modules');
        modules.replaceChildren(
            ...course.modules.map((m, i) => {
                const li = el('li');
                li.append(el('span', 'module-num', String(i + 1)), el('span', '', m));
                return li;
            })
        );

        const cta = modal.querySelector('#modal-cta');
        if (isLoggedIn()) {
            cta.href = dashboardUrl;
            cta.textContent = 'Go to my dashboard';
        } else {
            cta.href = signupUrl;
            cta.textContent = 'Join for free to enroll';
        }

        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
    }

    if (modal) {
        modal.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => modal.close()));
        modal.addEventListener('click', (event) => {
            if (event.target === modal) modal.close();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            state.query = searchInput.value.trim().toLowerCase().slice(0, 60);
            renderCourses();
        });
    }
    if (searchForm) {
        searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            document.getElementById('courses').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    const lessonsTotal = courses.reduce((sum, c) => sum + c.lessons, 0);
    const statCourses = document.querySelector('[data-stat="courses"]');
    const statLessons = document.querySelector('[data-stat="lessons"]');
    if (statCourses) statCourses.textContent = String(courses.length);
    if (statLessons) statLessons.textContent = lessonsTotal + '+';
    const statRating = document.querySelector('[data-stat="rating"]');
    if (statRating && courses.length) {
        const avg = courses.reduce((sum, c) => sum + c.rating, 0) / courses.length;
        statRating.textContent = avg.toFixed(1) + '★';
    }

    renderChips();
    renderCourses();
})();
