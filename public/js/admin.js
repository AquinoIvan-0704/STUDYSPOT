/* ==========================================================================
   admin.js — pending spot requests + contact messages
   ========================================================================== */

(function () {
    const $ = (id) => document.getElementById(id);

    function pendingMarkup(spot) {
        const av = SS.availability(spot.seats);
        return `<div class="list-item">
            <div class="grow">
                <h3>${SS.esc(spot.name)}</h3>
                <div class="meta">
                    ${SS.esc(spot.city)}
                    ${spot.submittedBy ? ` · requested by <strong>${SS.esc(spot.submittedBy)}</strong>` : ''}
                    ${spot.requestedAt ? ` · ${SS.esc(SS.when(spot.requestedAt))}` : ''}
                </div>
                <div class="chips">
                    <span class="badge ${av.cls}">${av.label}</span>
                    <span class="badge grey">${SS.esc(spot.seats)} seats</span>
                    <span class="badge grey">Wi-Fi: ${SS.esc(spot.wifi)}</span>
                    <span class="badge grey">Noise: ${SS.esc(spot.noise)}</span>
                    ${spot.hours ? `<span class="badge grey">${SS.esc(spot.hours)}</span>` : ''}
                </div>
                ${spot.description ? `<p class="body-text">${SS.esc(spot.description)}</p>` : ''}
            </div>
            <div class="actions">
                <form method="POST" action="/api/approve-spot/${SS.esc(spot.id)}">
                    <button class="btn btn-primary btn-sm" type="submit">
                        ${SS.icon('i-check', 'icon-sm')} Approve</button>
                </form>
                <form method="POST" action="/api/decline-spot/${SS.esc(spot.id)}"
                      data-confirm="Decline “${SS.esc(spot.name)}”?">
                    <button class="btn btn-danger btn-sm" type="submit">
                        ${SS.icon('i-x', 'icon-sm')} Decline</button>
                </form>
            </div>
        </div>`;
    }

    function messageMarkup(msg) {
        return `<div class="list-item">
            <div class="grow">
                <h3>${SS.esc(msg.subject || 'No subject')}</h3>
                <div class="meta">
                    From <strong>${SS.esc(msg.name)}</strong> &lt;${SS.esc(msg.email)}&gt;
                    ${msg.fromUser ? ` · account: ${SS.esc(msg.fromUser)}` : ''}
                    · ${SS.esc(SS.when(msg.createdAt))}
                </div>
                <p class="body-text">${SS.esc(msg.body)}</p>
            </div>
            <div class="actions">
                <a class="btn btn-ghost btn-sm" href="mailto:${SS.esc(msg.email)}?subject=${encodeURIComponent('Re: ' + (msg.subject || 'StudySpot'))}">
                    ${SS.icon('i-mail', 'icon-sm')} Reply</a>
                <form method="POST" action="/api/messages/${SS.esc(msg.id)}/delete"
                      data-confirm="Delete this message?">
                    <button class="btn btn-danger btn-sm" type="submit">
                        ${SS.icon('i-trash', 'icon-sm')} Delete</button>
                </form>
            </div>
        </div>`;
    }

    SS.ready(function () {
        document.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-confirm]');
            if (form && !window.confirm(form.dataset.confirm)) e.preventDefault();
        });

        fetch('/api/pending-spots')
            .then(r => r.json())
            .then(list => {
                $('statPending').textContent = list.length;
                $('pendingList').innerHTML = list.length
                    ? list.map(pendingMarkup).join('')
                    : `<div class="empty">${SS.icon('i-check')}Nothing waiting — the queue is clear.</div>`;
            })
            .catch(() => {
                $('pendingList').innerHTML = `<div class="empty">Could not load requests.</div>`;
            });

        fetch('/api/messages')
            .then(r => r.json())
            .then(list => {
                $('statMessages').textContent = list.length;
                $('messageList').innerHTML = list.length
                    ? list.map(messageMarkup).join('')
                    : `<div class="empty">${SS.icon('i-inbox')}No messages yet.</div>`;
            })
            .catch(() => {
                $('messageList').innerHTML = `<div class="empty">Could not load messages.</div>`;
            });

        fetch('/api/spots')
            .then(r => r.json())
            .then(list => { $('statSpots').textContent = list.length; })
            .catch(() => {});
    });
})();
