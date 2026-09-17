/* ==========================================================================
   ui.js — shared front-end helpers used by every page.
   Provides: icon sprite, HTML escaping, cached current-user, role-aware
   top bar + footer, toasts, flash messages, small formatters.
   Every page loads this first:  <script src="/js/ui.js" defer></script>
   ========================================================================== */

const SS = (function () {

    /* ---------- icon sprite (injected once, so pages stay clean) ---------- */

    const SPRITE = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-home" viewBox="0 0 24 24"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></symbol>
<symbol id="i-mail" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></symbol>
<symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></symbol>
<symbol id="i-user" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></symbol>
<symbol id="i-users" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></symbol>
<symbol id="i-wifi" viewBox="0 0 24 24"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></symbol>
<symbol id="i-wifi-off" viewBox="0 0 24 24"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></symbol>
<symbol id="i-quiet" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m23 9-6 6M17 9l6 6"/></symbol>
<symbol id="i-loud" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></symbol>
<symbol id="i-star" viewBox="0 0 24 24"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></symbol>
<symbol id="i-chev" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
<symbol id="i-back" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
<symbol id="i-doc" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></symbol>
<symbol id="i-nav" viewBox="0 0 24 24"><path d="M3 11 22 2l-9 19-2-8z"/></symbol>
<symbol id="i-logout" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></symbol>
<symbol id="i-login" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></symbol>
<symbol id="i-book" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></symbol>
<symbol id="i-edit" viewBox="0 0 24 24"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></symbol>
<symbol id="i-alert" viewBox="0 0 24 24"><path d="m10.29 3.86-8.47 14.14A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></symbol>
<symbol id="i-inbox" viewBox="0 0 24 24"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></symbol>
<symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></symbol>
<symbol id="i-send" viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-google" viewBox="0 0 24 24"><path d="M21 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-7.2z"/></symbol>
</defs></svg>`;

    const BRAND = `
<a href="/studyspot" class="brand">
  <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
    <path d="M20 3.5c-6.35 0-11.5 5.15-11.5 11.5 0 8.6 11.5 21.5 11.5 21.5S31.5 23.6 31.5 15c0-6.35-5.15-11.5-11.5-11.5z"
          fill="none" stroke="#2563eb" stroke-width="2.6"/>
    <path d="M13.8 11.4h4.3c1 0 1.9.8 1.9 1.9v7.4c0-1-.9-1.9-1.9-1.9h-4.3z" fill="#2563eb"/>
    <path d="M26.2 11.4h-4.3c-1 0-1.9.8-1.9 1.9v7.4c0-1 .9-1.9 1.9-1.9h4.3z" fill="#2563eb" opacity=".72"/>
  </svg>
  <div>
    <div class="brand-name">Study<span>Spot</span></div>
    <div class="brand-tag">Find. Study. Succeed.</div>
  </div>
</a>`;

    /* ---------- helpers ---------- */

    /** Escape user-supplied text before it goes anywhere near innerHTML. */
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    const icon = (name, extra) => `<svg class="icon ${extra || ''}"><use href="#${name}"/></svg>`;

    /** Availability is derived from the seat count — the data has no status field. */
    function availability(seats) {
        const n = Number(seats) || 0;
        if (n <= 0) return { cls: 'full', label: 'Full' };
        if (n < 10)  return { cls: 'warn', label: 'Almost Full' };
        return { cls: 'ok', label: 'Available' };
    }

    const hasWifi = (s) => String(s || '').toLowerCase().includes('available');
    const isQuiet = (s) => String(s || '').toLowerCase().includes('quiet');

    function stars(n) {
        const r = Math.round(Number(n) || 0);
        return '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);
    }

    /**
     * Works out whether a spot is open, from an hours string like
     * "8:00 AM - 6:00 PM" or "08:00-18:00".
     * Returns true / false, or null when the hours aren't set or can't be read —
     * callers must treat null as "unknown", never as closed.
     */
    function isOpenNow(hours) {
        const text = String(hours || '').trim();
        if (!text) return null;

        const parts = text.split(/[-–—]|\bto\b/i);
        if (parts.length < 2) return null;

        const toMinutes = (chunk) => {
            const m = String(chunk).trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
            if (!m) return null;
            let h = parseInt(m[1], 10);
            const min = m[2] ? parseInt(m[2], 10) : 0;
            const ampm = (m[3] || '').toLowerCase();
            if (h > 23 || min > 59) return null;
            if (ampm === 'pm' && h < 12) h += 12;
            if (ampm === 'am' && h === 12) h = 0;
            return h * 60 + min;
        };

        const open = toMinutes(parts[0]);
        const close = toMinutes(parts[1]);
        if (open === null || close === null) return null;

        const now = new Date();
        const mins = now.getHours() * 60 + now.getMinutes();
        // handles places that close after midnight
        return close > open ? (mins >= open && mins < close) : (mins >= open || mins < close);
    }

    function when(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d)) return '';
        const mins = Math.floor((Date.now() - d.getTime()) / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return mins + 'm ago';
        if (mins < 1440) return Math.floor(mins / 60) + 'h ago';
        if (mins < 10080) return Math.floor(mins / 1440) + 'd ago';
        return d.toLocaleDateString();
    }

    /* ---------- theme (light / dark) ---------- */

    const THEME_KEY = 'studyspot-theme';

    /** What the user picked: 'light', 'dark', or null meaning "follow the OS". */
    function storedTheme() {
        try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
    }

    /** What is actually on screen right now. */
    function activeTheme() {
        const chosen = document.documentElement.getAttribute('data-theme');
        if (chosen) return chosen;
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* private mode */ }
    }

    function toggleTheme() {
        const next = activeTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        return next;
    }

    const themeButtonMarkup = (extra) =>
        `<button type="button" class="btn btn-ghost btn-icon theme-toggle ${extra || ''}"
                 data-theme-toggle aria-label="Switch between light and dark mode"
                 title="Light / dark mode">
            ${icon('i-moon', 'icon-sm i-light')}${icon('i-sun', 'icon-sm i-dark')}
         </button>`;

    function wireThemeToggles() {
        document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
            if (btn._wired) return;
            btn._wired = true;
            btn.addEventListener('click', toggleTheme);
        });
    }

    /* ---------- current user (fetched once, shared by every script) ---------- */

    let userPromise = null;
    function user() {
        if (!userPromise) {
            userPromise = fetch('/api/current-user')
                .then(r => r.ok ? r.json() : null)
                .catch(() => null);
        }
        return userPromise;
    }

    /* ---------- toast + flash messages ---------- */

    let toastEl;
    function toast(message, kind) {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'toast';
            document.body.appendChild(toastEl);
        }
        toastEl.innerHTML = icon(kind === 'error' ? 'i-alert' : 'i-check', 'icon-sm') + esc(message);
        toastEl.classList.add('show');
        clearTimeout(toastEl._t);
        toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 3200);
    }

    /* Server redirects carry ?ok= / ?error= so every action gives feedback. */
    function readFlash() {
        const p = new URLSearchParams(location.search);
        const ok = p.get('ok'), err = p.get('error');
        if (!ok && !err) return;
        toast(ok || err, err ? 'error' : 'ok');
        p.delete('ok'); p.delete('error');
        const rest = p.toString();
        history.replaceState({}, '', location.pathname + (rest ? '?' + rest : ''));
    }

    /* ---------- top bar + footer ---------- */

    function navLinks(u) {
        const admin = !!(u && u.role === 'admin');
        const links = [
            { key: 'home',    href: '/studyspot', label: 'Home',  icon: 'i-home' },
            { key: 'spots',   href: '/spots',     label: 'Spots', icon: 'i-pin' },
            { key: 'add',     href: '/add-spot',  label: admin ? 'Add Spot' : 'Request Spot', icon: 'i-plus' }
        ];
        if (admin) links.push({ key: 'pending', href: '/admin/pending', label: 'Review Requests', icon: 'i-doc' });
        if (admin) links.push({ key: 'users', href: '/admin/users', label: 'Users', icon: 'i-users' });
        links.push({ key: 'about',   href: '/about',   label: 'About',   icon: 'i-info' });
        links.push({ key: 'contact', href: '/contact', label: 'Contact', icon: 'i-chat' });
        return links;
    }

    function buildTopbar(u) {
        const host = document.querySelector('[data-topbar]');
        if (!host) return;
        const active = host.getAttribute('data-topbar') || '';

        const nav = navLinks(u).map(l =>
            `<a class="navlink${l.key === active ? ' active' : ''}" href="${l.href}">
                ${icon(l.icon, 'icon-sm')}${esc(l.label)}
             </a>`).join('');

        const actions = u
            ? `<a class="btn btn-ghost" href="/profile">${icon('i-user', 'icon-sm')}${esc(u.username || 'Profile')}</a>
               <a class="btn btn-ghost btn-icon" href="/logout" title="Log out" aria-label="Log out">${icon('i-logout', 'icon-sm')}</a>`
            : `<a class="btn btn-primary" href="/">${icon('i-login', 'icon-sm')}Login</a>`;

        host.classList.add('topbar');
        host.innerHTML = `<div class="shell topbar-inner">
            ${BRAND}
            <nav class="mainnav">${nav}</nav>
            <div class="topbar-actions">${themeButtonMarkup()}${actions}</div>
        </div>`;
    }

    function buildFooter() {
        const host = document.querySelector('[data-footer]');
        if (!host) return;
        host.classList.add('site-footer');
        host.innerHTML = `<div class="shell">
            <span>&copy; ${new Date().getFullYear()} StudySpot — find. study. succeed.</span>
            <nav>
                <a href="/studyspot">Home</a>
                <a href="/spots">Spots</a>
                <a href="/about">About</a>
                <a href="/contact">Contact</a>
            </nav>
        </div>`;
    }

    /* ---------- stale-server check ---------- */

    // Bumped whenever the server gains new routes. Node loads server.js once at
    // startup, so editing it changes nothing until the process restarts — this
    // catches that instead of leaving you with mysterious 404s.
    const APP_VERSION = '3.0.0';

    function checkServerVersion() {
        fetch('/api/version')
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(data => {
                if (data.version !== APP_VERSION) throw new Error(data.version);
            })
            .catch((err) => {
                const running = (err && err.message && err.message !== 'Failed to fetch')
                    ? err.message : 'an older build';
                const bar = document.createElement('div');
                bar.className = 'stale-banner';
                bar.innerHTML = `${icon('i-alert', 'icon-sm')}
                    <span><strong>The server is running ${esc(running)} — these pages are v${APP_VERSION}.</strong>
                    Stop it and run <code>npm run dev</code> again, or links to new pages will 404.</span>`;
                document.body.insertAdjacentElement('afterbegin', bar);
            });
    }

    /* ---------- boot ---------- */

    const readyQueue = [];
    /** Run a page script once the user is known and the chrome is built. */
    function ready(fn) { readyQueue.push(fn); }

    document.addEventListener('DOMContentLoaded', () => {
        document.body.insertAdjacentHTML('afterbegin', SPRITE);
        document.body.classList.add('has-footer');
        buildFooter();
        readFlash();
        checkServerVersion();

        user().then(u => {
            buildTopbar(u);
            if (!document.querySelector('[data-topbar]')) {
                document.body.insertAdjacentHTML('beforeend', themeButtonMarkup('floating'));
            }
            wireThemeToggles();
            readyQueue.forEach(fn => {
                try { fn(u); } catch (e) { console.error('[StudySpot]', e); }
            });
        });
    });

    return { esc, icon, availability, hasWifi, isQuiet, isOpenNow, stars, when, user, toast, ready,
             theme: { active: activeTheme, apply: applyTheme, toggle: toggleTheme } };
})();
