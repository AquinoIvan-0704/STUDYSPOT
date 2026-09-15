document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.querySelector('button');
    const searchInput = document.querySelector('input[type="text"]');
    const spotsContainer = document.getElementById('spots-container');

    const fetchSpots = async (query = '') => {
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const results = await response.json();
            
            spotsContainer.innerHTML = '';
            
            if (results.length === 0) {
                spotsContainer.innerHTML = '<p>No study spots found.</p>';
                return;
            }

            results.forEach(spot => {
                const spotDiv = document.createElement('div');
                spotDiv.innerHTML = `
                    <h3>${spot.name}</h3>
                    <p>${spot.city}</p>
                    <p>${spot.seats} seats available | Wi-Fi: ${spot.wifi} | Noise: ${spot.noise}</p>
                    <hr>
                `;
                spotsContainer.appendChild(spotDiv);
            });
        } catch (error) {
            console.error('Error fetching spots:', error);
        }
    };

    fetchSpots();

    if (searchButton && searchInput) {
        searchButton.addEventListener('click', () => {
            const query = searchInput.value.trim();
            fetchSpots(query);
        });
    }
});