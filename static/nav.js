(function () {
    const header = document.querySelector('.site-nav');
    if (!header) return;

    const toggle = header.querySelector('.nav-toggle');
    const menu = header.querySelector('.nav-links');

    // Mobile menu
    function setOpen(open) {
        header.classList.toggle('is-open', open);
        if (toggle) {
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        }
    }

    if (toggle && menu) {
        toggle.addEventListener('click', () => setOpen(!header.classList.contains('is-open')));
        menu.addEventListener('click', (event) => {
            if (event.target.closest('a')) setOpen(false);
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && header.classList.contains('is-open')) {
                setOpen(false);
                toggle.focus();
            }
        });
        document.addEventListener('click', (event) => {
            if (!header.contains(event.target)) setOpen(false);
        });
    }

    // Shadow once the page is scrolled
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Highlight the section currently in view (home page only)
    if (!menu || !('IntersectionObserver' in window)) return;
    const links = Array.from(menu.querySelectorAll('a[href^="/#"]'));
    const sections = links
        .map((link) => document.getElementById(link.getAttribute('href').slice(2)))
        .filter(Boolean);
    if (!sections.length) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                links.forEach((link) => {
                    const active = link.getAttribute('href') === '/#' + entry.target.id;
                    if (active) link.setAttribute('aria-current', 'true');
                    else link.removeAttribute('aria-current');
                });
            });
        },
        { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((section) => observer.observe(section));
})();
