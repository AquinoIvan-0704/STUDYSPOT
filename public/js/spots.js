/* ==========================================================================
   spots.js — full spot listing: search, admin edit/delete, reviews
   ========================================================================== */

(function () {
    let me = null;
    let spots = [];
    const openReviews = new Set();     // spot ids whose review block is expanded

    const $ = (id) => document.getElementById(id);
    const isAdmin = () => !!(me && me.role === 'admin');

    /* ---------- markup ---------- */

    function thumb(spot, index) {
        const av = SS.availability(spot.seats);
        const style = spot.image ? ` style="background-image:url('${SS.esc(spot.image)}')"` : '';
        return `<div class="thumb v${(index % 3) + 1}"${style}>
                    <span class="badge ${av.cls}">${av.label}</span>
                    ${SS.icon('i-book')}
                </div>`;
    }

    function ratingMarkup(spot) {
        const r = spot.reviews || { average: 0, count: 0 };
        if (!r.count) return `<span class="rating"><span class="none">No reviews yet</span></span>`;
        return `<span class="rating">${SS.icon('i-star')}<strong>${r.average.toFixed(1)}</strong>
                (${r.count} review${r.count > 1 ? 's' : ''})</span>`;
    }

    function adminActions(spot) {
        if (!isAdmin()) return '';
        return `<div class="admin-actions">
            <a class="btn btn-ghost btn-sm" href="/edit-spot/${SS.esc(spot.id)}">
                ${SS.icon('i-edit', 'icon-sm')} Edit</a>
            <form method="POST" action="/api/delete-spot/${SS.esc(spot.id)}"
                  data-confirm="Delete “${SS.esc(spot.name)}”? This also removes its reviews.">
                <button type="submit" class="btn btn-danger btn-sm">
                    ${SS.icon('i-trash', 'icon-sm')} Delete</button>
            </form>
        </div>`;
    }

    function starInput(spotId) {
        let html = `<div class="star-input">`;
        for (let n = 5; n >= 1; n--) {
            html += `<input type="radio" id="star${n}-${SS.esc(spotId)}" name="rating" value="${n}" required>
                     <label for="star${n}-${SS.esc(spotId)}" title="${n} star${n > 1 ? 's' : ''}">★</label>`;
        }
        return html + `</div>`;
    }

    function reviewFormMarkup(spot) {
        if (!me) {
            return `<div class="login-prompt">
                ${SS.icon('i-lock', 'icon-sm')} <a href="/">Log in</a> to leave a review.
            </div>`;
        }
        return `<form class="review-form" method="POST" action="/api/spots/${SS.esc(spot.id)}/reviews">
            <div class="review-row">
                <div>
                    <label class="form-label">Your rating</label>
                    ${starInput(spot.id)}
                </div>
                <div class="grow">
                    <label class="form-label" for="comment-${SS.esc(spot.id)}">Your review</label>
                    <input type="text" id="comment-${SS.esc(spot.id)}" name="comment"
                           placeholder="How was it?" maxlength="500" required>
                </div>
                <button type="submit" class="btn btn-primary">
                    ${SS.icon('i-send', 'icon-sm')} Post</button>
            </div>
        </form>`;
    }

    function reviewMarkup(review) {
        const canDelete = me && (isAdmin() ||
            String(review.username).toLowerCase() === String(me.username).toLowerCase());

        return `<div class="review">
            <div class="review-top">
                <strong>${SS.esc(review.username)}</strong>
                <span class="review-stars">${SS.stars(review.rating)}</span>
                <span class="review-when">${SS.esc(SS.when(review.createdAt))}</span>
            </div>
            <p>${SS.esc(review.comment)}</p>
            ${canDelete ? `<form method="POST" action="/api/reviews/${SS.esc(review.id)}/delete"
                                 data-confirm="Delete this review?" style="margin-top:6px">
                <button class="btn btn-danger btn-sm" type="submit">
                    ${SS.icon('i-trash', 'icon-sm')} Delete</button></form>` : ''}
        </div>`;
    }

    function rowMarkup(spot, index) {
        const wifi = SS.hasWifi(spot.wifi);
        const quiet = SS.isQuiet(spot.noise);
        const count = (spot.reviews && spot.reviews.count) || 0;
        const open = openReviews.has(String(spot.id));

        return `<article class="card spot-row" id="spot-${SS.esc(spot.id)}" data-id="${SS.esc(spot.id)}">
            ${thumb(spot, index)}
            <div class="spot-row-main">
                <div class="spot-row-head">
                    <h3>${SS.esc(spot.name)}</h3>
                    ${adminActions(spot)}
                </div>
                <div class="spot-city">${SS.icon('i-pin', 'icon-sm')} ${SS.esc(spot.city)}</div>

                <div class="fact-row">
                    <span class="fact">${SS.icon('i-users')}${SS.esc(spot.seats)} seats</span>
                    <span class="fact">${SS.icon(wifi ? 'i-wifi' : 'i-wifi-off')}${wifi ? 'Wi-Fi Available' : 'No Wi-Fi'}</span>
                    <span class="fact">${SS.icon(quiet ? 'i-quiet' : 'i-loud')}${SS.esc(spot.noise)}</span>
                    ${spot.hours ? `<span class="fact">${SS.icon('i-clock')}${SS.esc(spot.hours)}</span>` : ''}
                </div>
                ${spot.description ? `<p class="small muted" style="margin-top:10px">${SS.esc(spot.description)}</p>` : ''}

                <div class="spot-row-foot">
                    ${ratingMarkup(spot)}
                    <button class="btn btn-outline btn-sm" data-toggle-reviews="${SS.esc(spot.id)}">
                        ${SS.icon('i-star', 'icon-sm')} ${open ? 'Hide' : 'Reviews'} (${count})
                    </button>
                </div>

                <div class="reviews-block" data-reviews="${SS.esc(spot.id)}" ${open ? '' : 'hidden'}>
                    <h4>Reviews</h4>
                    <div class="review-list" data-review-list="${SS.esc(spot.id)}">
                        <p class="small muted">Loading…</p>
                    </div>
                    ${reviewFormMarkup(spot)}
                </div>
            </div>
        </article>`;
    }

    /* ---------- data ---------- */

    function render(list) {
        spots = list;
        $('resultCount').textContent = list.length
            ? `${list.length} spot${list.length > 1 ? 's' : ''}`
            : '';

        if (!list.length) {
            $('spotRows').innerHTML = `<div class="empty">${SS.icon('i-search')}No study spots found.</div>`;
            return;
        }
        $('spotRows').innerHTML = list.map(rowMarkup).join('');
        openReviews.forEach(id => loadReviews(id));
    }

    function loadReviews(spotId) {
        const host = document.querySelector(`[data-review-list="${CSS.escape(String(spotId))}"]`);
        if (!host) return;

        fetch(`/api/spots/${encodeURIComponent(spotId)}/reviews`)
            .then(r => r.json())
            .then(list => {
                host.innerHTML = (list && list.length)
                    ? list.map(reviewMarkup).join('')
                    : `<p class="small muted">No reviews yet — be the first.</p>`;
            })
            .catch(() => { host.innerHTML = `<p class="small muted">Could not load reviews.</p>`; });
    }

    function load(query) {
        const url = query ? `/api/search?q=${encodeURIComponent(query)}` : '/api/spots';
        return fetch(url)
            .then(r => r.json())
            .then(list => render(Array.isArray(list) ? list : []))
            .catch(() => {
                $('spotRows').innerHTML = `<div class="empty">Could not load study spots.</div>`;
            });
    }

    /* ---------- boot ---------- */

    SS.ready(function (user) {
        me = user;
        if (!isAdmin()) {
            $('addBtn').innerHTML = SS.icon('i-plus', 'icon-sm') + ' Request Spot';
        }

        const params = new URLSearchParams(location.search);
        const initial = params.get('q') || '';
        if (initial) $('searchInput').value = initial;

        let timer;
        $('searchInput').addEventListener('input', (e) => {
            clearTimeout(timer);
            const v = e.target.value.trim();
            timer = setTimeout(() => load(v), 260);
        });

        // expand / collapse reviews
        $('spotRows').addEventListener('click', (e) => {
            const toggle = e.target.closest('[data-toggle-reviews]');
            if (!toggle) return;
            const id = String(toggle.dataset.toggleReviews);
            const block = document.querySelector(`[data-reviews="${CSS.escape(id)}"]`);
            if (!block) return;

            const nowOpen = block.hasAttribute('hidden');
            block.toggleAttribute('hidden', !nowOpen);
            if (nowOpen) { openReviews.add(id); loadReviews(id); } else { openReviews.delete(id); }

            const count = toggle.textContent.match(/\((\d+)\)/);
            toggle.innerHTML = SS.icon('i-star', 'icon-sm') +
                ` ${nowOpen ? 'Hide' : 'Reviews'} (${count ? count[1] : 0})`;
        });

        // confirm before destructive form posts
        document.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-confirm]');
            if (form && !window.confirm(form.dataset.confirm)) e.preventDefault();
        });

        load(initial).then(() => {
            // deep link from the dashboard: /spots#spot-3 opens that spot's reviews
            if (location.hash.startsWith('#spot-')) {
                const id = location.hash.replace('#spot-', '');
                const el = document.getElementById('spot-' + id);
                const toggle = document.querySelector(`[data-toggle-reviews="${CSS.escape(id)}"]`);
                if (toggle) toggle.click();
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
})();
