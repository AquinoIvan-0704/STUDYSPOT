/* ==========================================================================
   auth.js — login / register panel switching
   Desktop: the cover panel slides across.  Mobile: the panels just swap.
   ========================================================================== */

(function () {
    const $ = (id) => document.getElementById(id);

    document.addEventListener('DOMContentLoaded', function () {
        const card = $('authCard');
        const cover = $('authCover');
        const overlayLogin = $('overlayLogin');
        const overlayRegister = $('overlayRegister');
        const strip = $('switchStrip');

        let animating = false;
        const PHASE = 600;

        function showRegister() {
            if (animating || card.classList.contains('show-register')) return;
            animating = true;

            card.classList.add('show-register');
            overlayLogin.classList.remove('visible');
            cover.classList.remove('parked-left');
            cover.classList.add('covering');

            setTimeout(() => {
                cover.classList.remove('covering');
                cover.classList.add('parked-right');
                overlayRegister.classList.add('visible');
                animating = false;
            }, PHASE);

            renderStrip();
            focusFirst('.auth-panel.register');
        }

        function showLogin() {
            if (animating || !card.classList.contains('show-register')) return;
            animating = true;

            card.classList.remove('show-register');
            overlayRegister.classList.remove('visible');
            cover.classList.remove('parked-right');
            cover.classList.add('covering');

            setTimeout(() => {
                cover.classList.remove('covering');
                cover.classList.add('parked-left');
                overlayLogin.classList.add('visible');
                animating = false;
            }, PHASE);

            renderStrip();
            focusFirst('.auth-panel.login');
        }

        function focusFirst(selector) {
            // only steal focus on wider screens, where the panel is already visible
            if (window.innerWidth <= 860) return;
            const input = document.querySelector(selector + ' input');
            if (input) setTimeout(() => input.focus(), PHASE);
        }

        /* the small text toggle shown on phones, where the cover panel is hidden */
        function renderStrip() {
            const onRegister = card.classList.contains('show-register');
            strip.innerHTML = onRegister
                ? `Already have an account? <button type="button" id="stripLogin">Log in</button>`
                : `New here? <button type="button" id="stripRegister">Create an account</button>`;

            const a = $('stripLogin'), b = $('stripRegister');
            if (a) a.addEventListener('click', showLogin);
            if (b) b.addEventListener('click', showRegister);
        }

        $('toRegister').addEventListener('click', showRegister);
        $('toLogin').addEventListener('click', showLogin);
        renderStrip();

        // /signup opens straight on the register panel
        if (location.pathname === '/signup' || location.hash === '#register') {
            card.classList.add('show-register');
            cover.classList.remove('parked-left');
            cover.classList.add('parked-right');
            overlayLogin.classList.remove('visible');
            overlayRegister.classList.add('visible');
            renderStrip();
        }

        // client-side check so people get told before the round trip
        $('registerForm').addEventListener('submit', function (e) {
            const u = $('reg-username').value.trim();
            const p = $('reg-password').value;
            if (u.length < 3) { e.preventDefault(); SS.toast('Username must be at least 3 characters.', 'error'); }
            else if (p.length < 6) { e.preventDefault(); SS.toast('Password must be at least 6 characters.', 'error'); }
        });
    });
})();
