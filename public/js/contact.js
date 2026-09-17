/* ==========================================================================
   contact.js — sends the contact form to /api/contact (saved for admins)
   ========================================================================== */

(function () {
    const $ = (id) => document.getElementById(id);

    SS.ready(function (user) {
        // pre-fill for signed-in members
        if (user) {
            if (!$('name').value)  $('name').value = user.username || '';
            if (!$('email').value) $('email').value = user.email || '';
        }

        $('contactForm').addEventListener('submit', function (e) {
            e.preventDefault();

            const payload = {
                name: $('name').value.trim(),
                email: $('email').value.trim(),
                subject: $('subject').value.trim(),
                body: $('body').value.trim()
            };

            if (!payload.name || !payload.email || !payload.body) {
                SS.toast('Name, email and message are required.', 'error');
                return;
            }

            const btn = $('sendBtn');
            btn.classList.add('is-loading');
            btn.textContent = 'Sending…';

            fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(r => r.json().then(data => ({ ok: r.ok, data })))
                .then(({ ok, data }) => {
                    if (!ok) throw new Error(data.error || 'Failed');
                    $('contactForm').reset();
                    $('sent').classList.remove('hidden');
                    $('sent').scrollIntoView({ behavior: 'smooth', block: 'center' });
                    SS.toast('Message sent.');
                })
                .catch(err => SS.toast(err.message || 'Could not send your message.', 'error'))
                .finally(() => {
                    btn.classList.remove('is-loading');
                    btn.innerHTML = SS.icon('i-send', 'icon-sm') + ' Send message';
                });
        });
    });
})();
