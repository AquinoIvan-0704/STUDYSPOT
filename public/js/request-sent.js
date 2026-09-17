/* ==========================================================================
   request-sent.js — shows the spot the user just submitted for approval.
   The id comes from the redirect (/request-sent?id=...); if it's missing we
   fall back to their newest pending request.
   ========================================================================== */

(function () {
    const $ = (id) => document.getElementById(id);

    function summaryMarkup(spot) {
        const av = SS.availability(spot.seats);
        return `<div class="summary-top">
                <div>
                    <h2>${SS.esc(spot.name)}</h2>
                    <div class="where">${SS.icon('i-pin', 'icon-sm')}${SS.esc(spot.city)}</div>
                </div>
                <span class="badge grey push-right">Awaiting approval</span>
            </div>
            <div class="chips">
                <span class="badge ${av.cls}">${av.label}</span>
                <span class="badge grey">${SS.esc(spot.seats)} seats</span>
                <span class="badge grey">Wi-Fi: ${SS.esc(spot.wifi)}</span>
                <span class="badge grey">Noise: ${SS.esc(spot.noise)}</span>
                ${spot.hours ? `<span class="badge grey">${SS.esc(spot.hours)}</span>` : ''}
            </div>
            ${spot.description ? `<p class="note">${SS.esc(spot.description)}</p>` : ''}`;
    }

    SS.ready(function (user) {
        if (!user) { location.href = '/'; return; }

        const wanted = new URLSearchParams(location.search).get('id');

        fetch('/api/my-activity')
            .then(r => r.json())
            .then(data => {
                const pending = Array.isArray(data.pending) ? data.pending : [];
                if (!pending.length) return;

                const spot = (wanted && pending.find(s => String(s.id) === String(wanted)))
                    || pending[pending.length - 1];

                if (!spot) return;
                $('summary').innerHTML = summaryMarkup(spot);
                $('summary').hidden = false;
            })
            .catch(() => { /* the confirmation still reads fine without the summary */ });
    });
})();
