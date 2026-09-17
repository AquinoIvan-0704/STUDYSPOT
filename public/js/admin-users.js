/* ==========================================================================
   admin-users.js — account list with promote / demote / delete
   ========================================================================== */

(function () {
    const $ = (id) => document.getElementById(id);

    function userMarkup(u, adminCount) {
        const isAdmin = u.role === 'admin';
        const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'unknown';
        const initial = (u.username || '?').charAt(0).toUpperCase();

        // guard rails: you can't demote or delete yourself, or the last admin
        const lastAdmin = isAdmin && adminCount <= 1;
        const lockedReason = u.isYou ? 'This is you' : (lastAdmin ? 'Last remaining admin' : '');

        return `<div class="list-item">
            <div class="user-badge">${SS.esc(initial)}</div>
            <div class="grow">
                <h3>${SS.esc(u.username)} ${u.isYou ? '<span class="badge soft">You</span>' : ''}</h3>
                <div class="meta">
                    ${SS.esc(u.email || 'no email on file')} · joined ${SS.esc(joined)}
                </div>
                <div class="chips">
                    <span class="badge ${isAdmin ? 'soft' : 'grey'}">${isAdmin ? 'Administrator' : 'Member'}</span>
                    <span class="badge grey">${u.spotCount} spot${u.spotCount === 1 ? '' : 's'}</span>
                    <span class="badge grey">${u.reviewCount} review${u.reviewCount === 1 ? '' : 's'}</span>
                    ${u.pendingCount ? `<span class="badge warn">${u.pendingCount} pending</span>` : ''}
                </div>
            </div>
            <div class="actions">
                ${lockedReason
                    ? `<span class="small muted" style="align-self:center">${SS.esc(lockedReason)}</span>`
                    : `<form method="POST" action="/api/users/${encodeURIComponent(u.username)}/role">
                        <input type="hidden" name="role" value="${isAdmin ? 'user' : 'admin'}">
                        <button class="btn btn-ghost btn-sm" type="submit">
                            ${SS.icon('i-shield', 'icon-sm')} ${isAdmin ? 'Make member' : 'Make admin'}</button>
                       </form>
                       <form method="POST" action="/api/users/${encodeURIComponent(u.username)}/delete"
                             data-confirm="Delete ${SS.esc(u.username)}? Their reviews are removed too.">
                        <button class="btn btn-danger btn-sm" type="submit">
                            ${SS.icon('i-trash', 'icon-sm')} Delete</button>
                       </form>`}
            </div>
        </div>`;
    }

    SS.ready(function () {
        document.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-confirm]');
            if (form && !window.confirm(form.dataset.confirm)) e.preventDefault();
        });

        fetch('/api/users')
            .then(r => r.json())
            .then(list => {
                if (!Array.isArray(list)) throw new Error('bad response');

                const admins = list.filter(u => u.role === 'admin').length;
                $('statUsers').textContent = list.length;
                $('statAdmins').textContent = admins;
                $('statReviews').textContent = list.reduce((t, u) => t + (u.reviewCount || 0), 0);

                // admins first, then alphabetical
                list.sort((a, b) =>
                    (b.role === 'admin') - (a.role === 'admin') ||
                    String(a.username).localeCompare(String(b.username)));

                $('userList').innerHTML = list.map(u => userMarkup(u, admins)).join('');
            })
            .catch(() => {
                $('userList').innerHTML = `<div class="empty">Could not load accounts.</div>`;
            });
    });
})();
