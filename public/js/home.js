/* ==========================================================================
   home.js — dashboard: spot preview grid, live search, details panel
   ========================================================================== */

(function () {
    const PREVIEW_COUNT = 3;          // cards shown before a search is typed

    let allSpots = [];
    let shownSpots = [];
    let selectedId = null;

    const $ = (id) => document.getElementById(id);

    /* ---------- rendering ---------- */

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
        return `<span class="rating">${SS.icon('i-star')}
                    <strong>${r.average.toFixed(1)}</strong>
                    (${r.count} review${r.count > 1 ? 's' : ''})
                </span>`;
    }

    function card(spot, index) {
        const wifi = SS.hasWifi(spot.wifi);
        const quiet = SS.isQuiet(spot.noise);

        return `<article class="spot-card${String(spot.id) === String(selectedId) ? ' selected' : ''}" data-id="${SS.esc(spot.id)}">
            ${thumb(spot, index)}
            <div class="spot-body">
                <h3>${SS.esc(spot.name)}</h3>
                <div class="spot-city">${SS.esc(spot.city)}</div>
                <div class="facts">
                    <div class="fact">${SS.icon('i-users')}${SS.esc(spot.seats)} seats available</div>
                    <div class="fact">${SS.icon(wifi ? 'i-wifi' : 'i-wifi-off')}${wifi ? 'Wi-Fi Available' : 'No Wi-Fi'}</div>
                    <div class="fact">${SS.icon(quiet ? 'i-quiet' : 'i-loud')}Noise Level: ${SS.esc(spot.noise)}</div>
                    ${spot.hours ? `<div class="fact">${SS.icon('i-clock')}${SS.esc(spot.hours)}</div>` : ''}
                </div>
            </div>
            <div class="spot-foot">
                ${ratingMarkup(spot)}
                <button class="btn btn-outline btn-sm" data-details="${SS.esc(spot.id)}">View Details</button>
            </div>
        </article>`;
    }

    function renderGrid(spots, opts) {
        opts = opts || {};
        shownSpots = spots;

        if (!spots.length) {
            $('spotGrid').innerHTML = `<div class="empty">${SS.icon('i-search')}${
                opts.searching
                    ? `No study spots match “${SS.esc(opts.query)}”.`
                    : 'No study spots have been added yet.'}</div>`;
            return;
        }
        $('spotGrid').innerHTML = spots.map(card).join('');
    }

    /* ---------- details panel ---------- */

    function row(icon, key, value) {
        return `<div class="row-item">${SS.icon(icon, 'icon-sm')}
            <span class="k">${key}</span><span class="v">${value}</span></div>`;
    }

    function showDetails(id) {
        const i = shownSpots.findIndex(s => String(s.id) === String(id));
        const spot = shownSpots[i];
        if (!spot) return;

        selectedId = spot.id;
        document.querySelectorAll('.spot-card').forEach(c =>
            c.classList.toggle('selected', c.dataset.id === String(id)));

        const av = SS.availability(spot.seats);
        const wifi = SS.hasWifi(spot.wifi);
        const quiet = SS.isQuiet(spot.noise);
        const r = spot.reviews || { average: 0, count: 0 };
        const maps = 'https://www.google.com/maps/search/?api=1&query=' +
                     encodeURIComponent(spot.name + ' ' + spot.city);

        $('panelBody').innerHTML = `
          <div class="card-body">
            ${thumb(spot, i)}
            <div class="panel-title">
                <h3>${SS.esc(spot.name)}</h3>
                <span class="badge ${av.cls}">${av.label}</span>
            </div>
            <div class="rows">
                ${row('i-pin', 'Location', SS.esc(spot.city))}
                ${row('i-users', 'Available Seats', SS.esc(spot.seats))}
                ${row(wifi ? 'i-wifi' : 'i-wifi-off', 'Wi-Fi', wifi ? 'Available' : 'No Wi-Fi')}
                ${row(quiet ? 'i-quiet' : 'i-loud', 'Noise Level', SS.esc(spot.noise))}
                ${spot.hours ? row('i-clock', 'Opening Hours', SS.esc(spot.hours)) : ''}
                ${row('i-star', 'Rating', r.count ? `${r.average.toFixed(1)} / 5 (${r.count})` : 'No reviews yet')}
                ${spot.description ? `<div class="row-item stacked">${SS.icon('i-doc', 'icon-sm')}
                    <span class="k">Description</span>
                    <span class="v">${SS.esc(spot.description)}</span></div>` : ''}
            </div>
            <a class="btn btn-primary btn-block" style="margin-top:18px" href="${maps}" target="_blank" rel="noopener">
                ${SS.icon('i-nav', 'icon-sm')} Get Directions
            </a>
            <a class="btn btn-ghost btn-block" style="margin-top:8px" href="/spots#spot-${SS.esc(spot.id)}">
                ${SS.icon('i-star', 'icon-sm')} Reviews &amp; rating
            </a>
          </div>`;

        if (window.innerWidth <= 1140) {
            document.querySelector('.panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function clearDetails() {
        selectedId = null;
        document.querySelectorAll('.spot-card').forEach(c => c.classList.remove('selected'));
        $('panelBody').innerHTML = `<div class="panel-empty">${SS.icon('i-pin')}
            Select a study spot to see its details.</div>`;
    }

    /* ---------- search ---------- */

    let timer;
    function runSearch(query) {
        const q = String(query || '').trim();
        $('viewAll').href = q ? `/spots?q=${encodeURIComponent(q)}` : '/spots';

        if (!q) {
            $('listTitle').textContent = 'Popular Study Spots';
            renderGrid(allSpots.slice(0, PREVIEW_COUNT));
            if (allSpots.length) showDetails(allSpots[0].id);
            return;
        }

        fetch(`/api/search?q=${encodeURIComponent(q)}`)
            .then(r => r.json())
            .then(results => {
                $('listTitle').textContent = `Results for “${q}”`;
                renderGrid(results || [], { searching: true, query: q });
                if (results && results.length) showDetails(results[0].id); else clearDetails();
            })
            .catch(() => SS.toast('Could not search right now.', 'error'));
    }

    /* ---------- boot ---------- */

    SS.ready(function (user) {
        if (!(user && user.role === 'admin')) {
            $('ctaAdd').innerHTML = SS.icon('i-plus', 'icon-sm') + ' Request Spot';
        }

        $('searchForm').addEventListener('submit', (e) => {
            e.preventDefault();
            runSearch($('searchInput').value);
        });
        $('searchInput').addEventListener('input', (e) => {
            clearTimeout(timer);
            const v = e.target.value;
            timer = setTimeout(() => runSearch(v), 260);
        });
        $('spotGrid').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-details]');
            const card = e.target.closest('.spot-card');
            if (btn) return showDetails(btn.dataset.details);
            if (card) return showDetails(card.dataset.id);
        });
        $('panelClose').addEventListener('click', clearDetails);

        fetch('/api/spots')
            .then(r => r.json())
            .then(spots => {
                allSpots = Array.isArray(spots) ? spots : [];
                $('spotCount').textContent = allSpots.length;
                renderGrid(allSpots.slice(0, PREVIEW_COUNT));
                if (allSpots.length) showDetails(allSpots[0].id);
            })
            .catch(() => {
                $('spotCount').textContent = '0';
                $('spotGrid').innerHTML = `<div class="empty">Could not load study spots.</div>`;
            });
    });
})();
