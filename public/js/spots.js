/* ==========================================================================
   spots.js — full spot listing
   search · filters · sorting · pagination · admin edit/delete · reviews
   ========================================================================== */

(function () {
    const PAGE_SIZE = 6;

    let me = null;
    let loaded = [];                    // everything the server returned
    let visible = [];                   // after filters + sort
    let shown = PAGE_SIZE;
    let sortBy = 'rating';
    const filters = new Set();
    const openReviews = new Set();
    const myReviews = {};               // spotId -> the review this user left

    const $ = (id) => document.getElementById(id);
    const isAdmin = () => !!(me && me.role === 'admin');

    /* ---------- filtering + sorting ---------- */

    function passesFilters(spot) {
        if (filters.has('wifi')  && !SS.hasWifi(spot.wifi)) return false;
        if (filters.has('quiet') && !SS.isQuiet(spot.noise)) return false;
        if (filters.has('seats') && (Number(spot.seats) || 0) < 10) return false;
        if (filters.has('open')  && SS.isOpenNow(spot.hours) !== true) return false;
        return true;
    }

    function sorted(list) {
        const copy = list.slice();
        const rating = (s) => (s.reviews && s.reviews.average) || 0;
        const count  = (s) => (s.reviews && s.reviews.count) || 0;

        switch (sortBy) {
            case 'seats':   return copy.sort((a, b) => (Number(b.seats) || 0) - (Number(a.seats) || 0));
            case 'name':    return copy.sort((a, b) => String(a.name).localeCompare(String(b.name)));
            case 'newest':  return copy.sort((a, b) =>
                                new Date(b.createdAt || 0) - new Date(a.createdAt || 0) || Number(b.id) - Number(a.id));
            case 'reviews': return copy.sort((a, b) => count(b) - count(a));
            case 'rating':
            default:        return copy.sort((a, b) => rating(b) - rating(a) || count(b) - count(a));
        }
    }

    /* ---------- markup ---------- */

    function thumb(spot, index) {
        const av = SS.availability(spot.seats);
        const style = spot.image ? ` style="background-image:url('${SS.esc(spot.image)}')"` : '';
        return `<a class="thumb v${(index % 3) + 1}" href="/spot/${SS.esc(spot.id)}"${style}>
                    <span class="badge ${av.cls}">${av.label}</span>
                    ${spot.image ? '' : SS.icon('i-book')}
                </a>`;
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

    function starInput(spotId, current) {
        let html = `<div class="star-input">`;
        for (let n = 5; n >= 1; n--) {
            const checked = Number(current) === n ? ' checked' : '';
            html += `<input type="radio" id="star${n}-${SS.esc(spotId)}" name="rating" value="${n}" required${checked}>
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
        const mine = myReviews[String(spot.id)];
        return `<form class="review-form" method="POST" action="/api/spots/${SS.esc(spot.id)}/reviews">
            ${mine ? `<p class="small muted" style="margin-bottom:10px">
                ${SS.icon('i-info', 'icon-sm')} You already reviewed this spot — saving replaces your review.</p>` : ''}
            <div class="review-row">
                <div>
                    <label class="form-label">Your rating</label>
                    ${starInput(spot.id, mine && mine.rating)}
                </div>
                <div class="grow">
                    <label class="form-label" for="comment-${SS.esc(spot.id)}">Your review</label>
                    <input type="text" id="comment-${SS.esc(spot.id)}" name="comment"
                           placeholder="How was it?" maxlength="500" required
                           value="${mine ? SS.esc(mine.comment) : ''}">
                </div>
                <button type="submit" class="btn btn-primary">
                    ${SS.icon('i-send', 'icon-sm')} ${mine ? 'Update' : 'Post'}</button>
            </div>
        </form>`;
    }

    function reviewMarkup(review) {
        const isMine = me && String(review.username).toLowerCase() === String(me.username).toLowerCase();
        const canDelete = me && (isAdmin() || isMine);
        const edited = review.updatedAt ? ' · edited' : '';

        return `<div class="review${isMine ? ' is-mine' : ''}">
            <div class="review-top">
                <strong>${SS.esc(review.username)}</strong>
                ${isMine ? '<span class="badge soft">You</span>' : ''}
                <span class="review-stars">${SS.stars(review.rating)}</span>
                <span class="review-when">${SS.esc(SS.when(review.updatedAt || review.createdAt))}${edited}</span>
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
        const open = SS.isOpenNow(spot.hours);

        return `<article class="card spot-row" id="spot-${SS.esc(spot.id)}" data-id="${SS.esc(spot.id)}">
            ${thumb(spot, index)}
            <div class="spot-row-main">
                <div class="spot-row-head">
                    <h3><a href="/spot/${SS.esc(spot.id)}">${SS.esc(spot.name)}</a></h3>
                    ${open === true ? '<span class="badge ok">Open now</span>' : ''}
                    ${open === false ? '<span class="badge grey">Closed</span>' : ''}
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
                    <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener"
                       href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' ' + spot.city)}">
                        ${SS.icon('i-nav', 'icon-sm')} Directions</a>
                    <button class="btn btn-ghost btn-sm" data-toggle-reviews="${SS.esc(spot.id)}">
                        ${SS.icon('i-star', 'icon-sm')} Reviews (${count})
                    </button>
                    <a class="btn btn-outline btn-sm" href="/spot/${SS.esc(spot.id)}">
                        ${SS.icon('i-chev', 'icon-sm')} View Details</a>
                </div>

                <div class="reviews-block" data-reviews="${SS.esc(spot.id)}" hidden>
                    <h4>Reviews</h4>
                    <div class="review-list" data-review-list="${SS.esc(spot.id)}">
                        <p class="small muted">Loading…</p>
                    </div>
                    <div data-review-form="${SS.esc(spot.id)}"></div>
                </div>
            </div>
        </article>`;
    }

    /* ---------- rendering ---------- */

    function render() {
        visible = sorted(loaded.filter(passesFilters));

        const total = visible.length;
        $('resultCount').textContent = total
            ? `${total} spot${total > 1 ? 's' : ''}${filters.size ? ' match' : ''}`
            : '';
        $('clearFilters').classList.toggle('hidden', filters.size === 0);

        if (!total) {
            $('spotRows').innerHTML = `<div class="empty">${SS.icon('i-search')}
                No study spots match what you're looking for.</div>`;
            $('showMore').classList.add('hidden');
            return;
        }

        const page = visible.slice(0, shown);
        $('spotRows').innerHTML = page.map(rowMarkup).join('');

        const more = total - page.length;
        $('showMore').classList.toggle('hidden', more <= 0);
        $('showMore').textContent = more > 0 ? `Show ${Math.min(more, PAGE_SIZE)} more (${more} left)` : '';

        openReviews.forEach(id => {
            const block = document.querySelector(`[data-reviews="${CSS.escape(id)}"]`);
            if (block) { block.hidden = false; loadReviews(id); }
        });
    }

    function loadReviews(spotId) {
        const listHost = document.querySelector(`[data-review-list="${CSS.escape(String(spotId))}"]`);
        const formHost = document.querySelector(`[data-review-form="${CSS.escape(String(spotId))}"]`);
        if (!listHost) return;

        fetch(`/api/spots/${encodeURIComponent(spotId)}/reviews`)
            .then(r => r.json())
            .then(data => {
                const list = Array.isArray(data) ? data : (data.reviews || []);
                if (data && data.mine) myReviews[String(spotId)] = data.mine;
                else delete myReviews[String(spotId)];

                listHost.innerHTML = list.length
                    ? list.map(reviewMarkup).join('')
                    : `<p class="small muted">No reviews yet — be the first.</p>`;

                const spot = loaded.find(s => String(s.id) === String(spotId));
                if (formHost && spot) formHost.innerHTML = reviewFormMarkup(spot);
            })
            .catch(() => { listHost.innerHTML = `<p class="small muted">Could not load reviews.</p>`; });
    }

    function load(query) {
        const url = query ? `/api/search?q=${encodeURIComponent(query)}` : '/api/spots';
        return fetch(url)
            .then(r => r.json())
            .then(list => { loaded = Array.isArray(list) ? list : []; shown = PAGE_SIZE; render(); })
            .catch(() => {
                $('spotRows').innerHTML = `<div class="empty">Could not load study spots.</div>`;
            });
    }

    /* ---------- boot ---------- */

    SS.ready(function (user) {
        me = user;
        if (!isAdmin()) $('addBtn').innerHTML = SS.icon('i-plus', 'icon-sm') + ' Request Spot';

        const params = new URLSearchParams(location.search);
        const initial = params.get('q') || '';
        if (initial) $('searchInput').value = initial;

        // the dashboard hero chips link here with ?filter=wifi etc.
        (params.get('filter') || '').split(',').filter(Boolean).forEach(f => filters.add(f));
        if (params.get('sort')) sortBy = params.get('sort');
        $('sortSelect').value = sortBy;
        document.querySelectorAll('[data-filter]').forEach(btn =>
            btn.classList.toggle('active', filters.has(btn.dataset.filter)));

        let timer;
        $('searchInput').addEventListener('input', (e) => {
            clearTimeout(timer);
            const v = e.target.value.trim();
            timer = setTimeout(() => load(v), 260);
        });

        $('sortSelect').addEventListener('change', (e) => { sortBy = e.target.value; shown = PAGE_SIZE; render(); });

        $('filterBar').addEventListener('click', (e) => {
            const chip = e.target.closest('[data-filter]');
            if (chip) {
                const f = chip.dataset.filter;
                filters.has(f) ? filters.delete(f) : filters.add(f);
                chip.classList.toggle('active', filters.has(f));
                shown = PAGE_SIZE;
                return render();
            }
            if (e.target.closest('#clearFilters')) {
                filters.clear();
                document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                shown = PAGE_SIZE;
                render();
            }
        });

        $('showMore').addEventListener('click', () => { shown += PAGE_SIZE; render(); });

        $('spotRows').addEventListener('click', (e) => {
            const toggle = e.target.closest('[data-toggle-reviews]');
            if (!toggle) return;
            const id = String(toggle.dataset.toggleReviews);
            const block = document.querySelector(`[data-reviews="${CSS.escape(id)}"]`);
            if (!block) return;

            const nowOpen = block.hidden;
            block.hidden = !nowOpen;
            if (nowOpen) { openReviews.add(id); loadReviews(id); } else { openReviews.delete(id); }
        });

        document.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-confirm]');
            if (form && !window.confirm(form.dataset.confirm)) e.preventDefault();
        });

        load(initial).then(() => {
            if (location.hash.startsWith('#spot-')) {
                const id = location.hash.replace('#spot-', '');
                // make sure the spot is on screen even if it sits past the first page
                const idx = visible.findIndex(s => String(s.id) === String(id));
                if (idx >= shown) { shown = idx + 1; render(); }

                const toggle = document.querySelector(`[data-toggle-reviews="${CSS.escape(id)}"]`);
                if (toggle) toggle.click();
                const el = document.getElementById('spot-' + id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
})();
