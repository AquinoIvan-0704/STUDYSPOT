/* ==========================================================================
   profile.js — account details plus the user's spots, requests and reviews
   ========================================================================== */

(function () {
    const $ = (id) => document.getElementById(id);

    function row(icon, key, value) {
        return `<div class="row-item">${SS.icon(icon, 'icon-sm')}
            <span class="k">${key}</span><span class="v">${value}</span></div>`;
    }

    function identityMarkup(user) {
        const initial = (user.username || '?').trim().charAt(0).toUpperCase();
        const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—';

        return `<div class="avatar">${SS.esc(initial)}</div>
            <h2>${SS.esc(user.username)}</h2>
            <div class="role">
                <span class="badge ${user.role === 'admin' ? 'soft' : 'grey'}">
                    ${user.role === 'admin' ? 'Administrator' : 'Member'}
                </span>
            </div>
            <div class="profile-meta rows">
                ${row('i-user', 'Username', SS.esc(user.username))}
                ${row('i-mail', 'Email', SS.esc(user.email || 'Not set'))}
                ${row('i-shield', 'Role', SS.esc(user.role || 'user'))}
                ${row('i-calendar', 'Joined', SS.esc(joined))}
            </div>`;
    }

    function spotItem(spot, pending) {
        const av = SS.availability(spot.seats);
        return `<div class="list-item">
            <div class="grow">
                <h3>${SS.esc(spot.name)}</h3>
                <div class="meta">${SS.esc(spot.city)}
                    · ${SS.esc(SS.when(spot.createdAt || spot.requestedAt))}</div>
                <div class="chips">
                    <span class="badge ${pending ? 'grey' : av.cls}">${pending ? 'Awaiting approval' : av.label}</span>
                    <span class="badge grey">${SS.esc(spot.seats)} seats</span>
                    <span class="badge grey">Wi-Fi: ${SS.esc(spot.wifi)}</span>
                    <span class="badge grey">Noise: ${SS.esc(spot.noise)}</span>
                </div>
            </div>
            ${pending ? '' : `<div class="actions">
                <a class="btn btn-ghost btn-sm" href="/spots#spot-${SS.esc(spot.id)}">
                    ${SS.icon('i-chev', 'icon-sm')} View</a>
            </div>`}
        </div>`;
    }

    function reviewItem(review) {
        return `<div class="review">
            <div class="review-top">
                <strong>${SS.esc(review.spotName)}</strong>
                <span class="review-stars">${SS.stars(review.rating)}</span>
                <span class="review-when">${SS.esc(SS.when(review.createdAt))}</span>
            </div>
            <p>${SS.esc(review.comment)}</p>
            <form method="POST" action="/api/reviews/${SS.esc(review.id)}/delete"
                  data-confirm="Delete this review?" style="margin-top:6px">
                <button class="btn btn-danger btn-sm" type="submit">
                    ${SS.icon('i-trash', 'icon-sm')} Delete</button>
            </form>
        </div>`;
    }

    const emptyBox = (text) => `<div class="empty">${text}</div>`;

    SS.ready(function (user) {
        if (!user) {
            location.href = '/';
            return;
        }

        document.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-confirm]');
            if (form && !window.confirm(form.dataset.confirm)) e.preventDefault();
        });

        fetch('/api/my-activity')
            .then(r => r.json())
            .then(data => {
                $('identity').innerHTML = identityMarkup(data.user || user);

                $('statSpots').textContent = data.spots.length;
                $('statPending').textContent = data.pending.length;
                $('statReviews').textContent = data.reviews.length;

                $('myPending').innerHTML = data.pending.length
                    ? data.pending.map(s => spotItem(s, true)).join('')
                    : emptyBox('No pending requests. <a href="/add-spot">Suggest a spot</a>.');

                $('mySpots').innerHTML = data.spots.length
                    ? data.spots.map(s => spotItem(s, false)).join('')
                    : emptyBox('Nothing published under your name yet.');

                $('myReviews').innerHTML = data.reviews.length
                    ? data.reviews.map(reviewItem).join('')
                    : emptyBox('You haven\'t reviewed a spot yet. <a href="/spots">Browse spots</a>.');
            })
            .catch(() => {
                $('identity').innerHTML = identityMarkup(user);
                SS.toast('Could not load your activity.', 'error');
            });
    });
})();
