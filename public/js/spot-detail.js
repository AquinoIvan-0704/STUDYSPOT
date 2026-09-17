/* ==========================================================================
   spot-detail.js — the full page for one study spot (/spot/:id)
   Everything about the spot, plus its reviews and the review form.
   ========================================================================== */

(function () {
    const $ = (id) => document.getElementById(id);
    const spotId = decodeURIComponent(location.pathname.split('/').pop());

    let me = null;
    let spot = null;

    const isAdmin = () => !!(me && me.role === 'admin');

    /* ---------- pieces ---------- */

    function row(icon, key, value) {
        return `<div class="row-item">${SS.icon(icon, 'icon-sm')}
            <span class="k">${key}</span><span class="v">${value}</span></div>`;
    }

    function bannerMarkup() {
        const av = SS.availability(spot.seats);
        const open = SS.isOpenNow(spot.hours);
        const style = spot.image ? ` style="background-image:url('${SS.esc(spot.image)}')"` : '';

        return `<div class="detail-banner">
            <div class="thumb v1"${style}></div>
            <div class="banner-text">
                <div class="banner-badges">
                    <span class="badge ${av.cls}">${av.label}</span>
                    ${open === true ? '<span class="badge ok">Open now</span>' : ''}
                    ${open === false ? '<span class="badge grey">Closed now</span>' : ''}
                </div>
                <h1>${SS.esc(spot.name)}</h1>
                <div class="where">${SS.icon('i-pin', 'icon-sm')}${SS.esc(spot.city)}</div>
            </div>
        </div>`;
    }

    function infoMarkup() {
        const wifi = SS.hasWifi(spot.wifi);
        const quiet = SS.isQuiet(spot.noise);
        const added = spot.createdAt ? new Date(spot.createdAt).toLocaleDateString() : null;

        return `<div class="card card-pad">
            <h2>Details</h2>
            <div class="rows" style="margin-top:6px">
                ${row('i-pin', 'Location', SS.esc(spot.city))}
                ${row('i-users', 'Available seats', SS.esc(spot.seats))}
                ${row(wifi ? 'i-wifi' : 'i-wifi-off', 'Wi-Fi', wifi ? 'Available' : 'No Wi-Fi')}
                ${row(quiet ? 'i-quiet' : 'i-loud', 'Noise level', SS.esc(spot.noise))}
                ${spot.hours ? row('i-clock', 'Opening hours', SS.esc(spot.hours)) : ''}
                ${spot.addedBy ? row('i-user', 'Added by', SS.esc(spot.addedBy)) : ''}
                ${added ? row('i-calendar', 'Listed since', SS.esc(added)) : ''}
                ${spot.description ? `<div class="row-item stacked">${SS.icon('i-doc', 'icon-sm')}
                    <span class="k">About this spot</span>
                    <span class="v">${SS.esc(spot.description)}</span></div>` : ''}
            </div>

            <div class="detail-actions">
                <a class="btn btn-primary" target="_blank" rel="noopener"
                   href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' ' + spot.city)}">
                    ${SS.icon('i-nav', 'icon-sm')} Get directions
                </a>
            </div>

            ${isAdmin() ? `<div class="detail-admin">
                <a class="btn btn-ghost btn-sm" href="/edit-spot/${SS.esc(spot.id)}">
                    ${SS.icon('i-edit', 'icon-sm')} Edit</a>
                <form method="POST" action="/api/delete-spot/${SS.esc(spot.id)}" style="flex:1"
                      data-confirm="Delete “${SS.esc(spot.name)}”? This also removes its reviews.">
                    <button class="btn btn-danger btn-sm btn-block" type="submit">
                        ${SS.icon('i-trash', 'icon-sm')} Delete</button>
                </form>
            </div>` : ''}
        </div>`;
    }

    function starInput(current) {
        let html = `<div class="star-input">`;
        for (let n = 5; n >= 1; n--) {
            html += `<input type="radio" id="star${n}" name="rating" value="${n}" required${Number(current) === n ? ' checked' : ''}>
                     <label for="star${n}" title="${n} star${n > 1 ? 's' : ''}">★</label>`;
        }
        return html + `</div>`;
    }

    function summaryMarkup(list) {
        if (!list.length) {
            return `<div class="rating-summary"><p class="small muted">
                No ratings yet — yours would be the first.</p></div>`;
        }
        const avg = list.reduce((t, r) => t + (Number(r.rating) || 0), 0) / list.length;
        const buckets = [5, 4, 3, 2, 1].map(n => ({
            n, count: list.filter(r => Number(r.rating) === n).length
        }));

        return `<div class="rating-summary">
            <div class="rating-score">
                <div class="big">${avg.toFixed(1)}</div>
                <div class="stars">${SS.stars(avg)}</div>
                <div class="count">${list.length} review${list.length > 1 ? 's' : ''}</div>
            </div>
            <div class="rating-bars">
                ${buckets.map(b => `<div class="rating-bar">
                    <span>${b.n}★</span>
                    <span class="track"><span class="fill" style="width:${list.length ? (b.count / list.length) * 100 : 0}%"></span></span>
                    <span class="n">${b.count}</span>
                </div>`).join('')}
            </div>
        </div>`;
    }

    function reviewMarkup(review) {
        const isMine = me && String(review.username).toLowerCase() === String(me.username).toLowerCase();
        const canDelete = me && (isAdmin() || isMine);

        return `<div class="review${isMine ? ' is-mine' : ''}">
            <div class="review-top">
                <strong>${SS.esc(review.username)}</strong>
                ${isMine ? '<span class="badge soft">You</span>' : ''}
                <span class="review-stars">${SS.stars(review.rating)}</span>
                <span class="review-when">${SS.esc(SS.when(review.updatedAt || review.createdAt))}${review.updatedAt ? ' · edited' : ''}</span>
            </div>
            <p>${SS.esc(review.comment)}</p>
            ${canDelete ? `<form method="POST" action="/api/reviews/${SS.esc(review.id)}/delete"
                                 data-confirm="Delete this review?" style="margin-top:6px">
                <button class="btn btn-danger btn-sm" type="submit">
                    ${SS.icon('i-trash', 'icon-sm')} Delete</button></form>` : ''}
        </div>`;
    }

    function reviewsMarkup(list, mine) {
        return `<div class="card">
            <div class="card-head"><h2>Ratings &amp; reviews</h2></div>
            <div class="card-body">
                ${summaryMarkup(list)}

                <div class="review-list" style="margin-top:18px">
                    ${list.length ? list.map(reviewMarkup).join('')
                                  : `<p class="small muted">No reviews yet — be the first to write one.</p>`}
                </div>

                ${me ? `<form class="review-form" method="POST" action="/api/spots/${SS.esc(spot.id)}/reviews">
                    ${mine ? `<p class="small muted" style="margin-bottom:10px">
                        ${SS.icon('i-info', 'icon-sm')} You already reviewed this spot — saving replaces it.</p>` : ''}
                    <div class="review-row">
                        <div>
                            <label class="form-label">Your rating</label>
                            ${starInput(mine && mine.rating)}
                        </div>
                        <div class="grow">
                            <label class="form-label" for="comment">Your review</label>
                            <input type="text" id="comment" name="comment" maxlength="500" required
                                   placeholder="How was it?" value="${mine ? SS.esc(mine.comment) : ''}">
                        </div>
                        <button type="submit" class="btn btn-primary">
                            ${SS.icon('i-send', 'icon-sm')} ${mine ? 'Update' : 'Post'}</button>
                    </div>
                </form>`
                : `<div class="login-prompt">${SS.icon('i-lock', 'icon-sm')}
                    <a href="/">Log in</a> to rate and review this spot.</div>`}
            </div>
        </div>`;
    }

    /* ---------- boot ---------- */

    function notFound() {
        $('detail').classList.add('hidden');
        $('notFound').classList.remove('hidden');
        document.title = 'Spot not found — StudySpot';
    }

    SS.ready(function (user) {
        me = user;

        document.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-confirm]');
            if (form && !window.confirm(form.dataset.confirm)) e.preventDefault();
        });

        fetch(`/api/spot/${encodeURIComponent(spotId)}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(data => {
                if (!data || !data.name) return notFound();
                spot = data;
                document.title = `${spot.name} — StudySpot`;

                return fetch(`/api/spots/${encodeURIComponent(spotId)}/reviews`)
                    .then(r => r.json())
                    .then(payload => {
                        const list = Array.isArray(payload) ? payload : (payload.reviews || []);
                        const mine = (payload && payload.mine) || null;

                        $('detail').innerHTML =
                            `<div>${bannerMarkup()}${reviewsMarkup(list, mine)}</div>
                             <div>${infoMarkup()}</div>`;
                    });
            })
            .catch(notFound);
    });
})();
