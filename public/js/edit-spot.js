/* ==========================================================================
   edit-spot.js — loads one spot into the edit form (admin only)
   ========================================================================== */

(function () {
    const $ = (id) => document.getElementById(id);
    const spotId = decodeURIComponent(location.pathname.split('/').pop());

    SS.ready(function () {
        $('editForm').action = `/api/edit-spot/${encodeURIComponent(spotId)}`;
        $('deleteForm').action = `/api/delete-spot/${encodeURIComponent(spotId)}`;

        document.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-confirm]');
            if (form && !window.confirm(form.dataset.confirm)) e.preventDefault();
        });

        fetch(`/api/spot/${encodeURIComponent(spotId)}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(spot => {
                if (!spot || !spot.name) return notFound();

                $('editingWhat').textContent = `Editing “${spot.name}” in ${spot.city}`;
                $('name').value = spot.name || '';
                $('city').value = spot.city || '';
                $('seats').value = spot.seats ?? 0;
                $('wifi').value = SS.hasWifi(spot.wifi) ? 'Available' : 'No Wi-Fi';
                $('noise').value = ['Quiet', 'Moderate', 'Loud'].includes(spot.noise) ? spot.noise : 'Moderate';
                $('hours').value = spot.hours || '';
                $('description').value = spot.description || '';
                if ($('image')) $('image').value = spot.image || '';
            })
            .catch(notFound);

        function notFound() {
            $('editingWhat').textContent = 'Spot not found';
            $('notFound').classList.remove('hidden');
            $('editForm').classList.add('hidden');
            $('deleteForm').classList.add('hidden');
        }
    });
})();
