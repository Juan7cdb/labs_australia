// Configuration
const CONFIG = {
    CREDENTIALS: {
        allowedEmails: [
            "juan.mora@tbtbglobal.com",
            "rodrigo@tbtbglobal.com",
            "andrea.villalba@tbtbglobal.com"
        ],
        password: "1234567890"
    },
    MAPBOX_TOKEN: 'pk.eyJ1IjoianVhbm1vcmF0YnRiIiwiYSI6ImNtanNwYm1qZDR1bHMzZ3B1bjNjbTNoZXYifQ.bG22dEMZDYR_fjzyrLv_dA', // Token provided by user
    DATA_URL: './labs_with_coordinates.json'
};

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMsg = document.getElementById('login-error');
const infoCard = document.getElementById('info-card');
const closeCardBtn = document.getElementById('close-card');
const loadingSpinner = document.getElementById('loading-spinner');
const statsCounter = document.getElementById('stats-counter');
const recordCountEl = document.getElementById('record-count');
const searchContainer = document.getElementById('search-container');
const searchInput = document.getElementById('search-input');

const networkFilterBtn = document.getElementById('network-filter-btn');
const networkFilterContent = document.getElementById('network-filter-content');
const searchResults = document.getElementById('search-results');

let selectedNetworks = ['all']; // Default to all

// State
let map;
let labsData = []; // Store original data for searching
let geojsonData = null; // Store GeoJSON for map

// 1. Authentication Logic
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Check if email is in allowed list and password matches
    if (CONFIG.CREDENTIALS.allowedEmails.includes(email) && password === CONFIG.CREDENTIALS.password) {
        loginOverlay.classList.add('hidden');
        initMap();
    } else {
        errorMsg.textContent = "Incorrect credentials. Please try again.";
        setTimeout(() => { errorMsg.textContent = ""; }, 3000);
    }
});

// 2. Map Initialization
function initMap() {
    // Show spinner immediately when starting map load
    loadingSpinner.classList.add('visible');
    loadingSpinner.innerHTML = '<div class="spinner"></div><p>Starting map...</p>';

    try {
        mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [133.7751, -25.2744], // Center of Australia
            zoom: 4
        });

        // Handle Map Loading Errors (e.g. Invalid Token)
        map.on('error', (e) => {
            console.error("Mapbox Error:", e);
            loadingSpinner.innerHTML = `
                <div style="color: #ef4444; max-width: 300px;">
                    <p><strong>Map Error</strong></p>
                    <p style="font-size: 0.8em;">${e.error ? e.error.message : 'Could not load map.'}</p>
                    <p style="font-size: 0.7em; margin-top: 10px;">Check your Mapbox Token in app.js</p>
                </div>
            `;
        });

        map.on('load', async () => {
            loadingSpinner.innerHTML = '<div class="spinner"></div><p>Loading data...</p>';

            const data = await fetchLabsData();

            if (data) {
                setupMapLayers(data);

                populateNetworkFilter();
                setupSearchListeners();

                // Update counter, show search, and hide spinner
                recordCountEl.innerText = data.features.length.toLocaleString();
                statsCounter.classList.remove('hidden');
                searchContainer.classList.remove('hidden');
                loadingSpinner.classList.remove('visible');
            } else {
                loadingSpinner.innerHTML = `
                    <div style="color: #ef4444;">
                        <p>Error loading data</p>
                    </div>`;
            }
        });

    } catch (err) {
        loadingSpinner.innerHTML = `
            <div style="color: #ef4444;">
                <p>Critical initialization error</p>
                <p style="font-size: 0.8rem">${err.message}</p>
            </div>`;
    }
}

// 3. Data Fetching and GeoJSON Conversion
async function fetchLabsData() {
    try {
        console.log("Iniciando fetch de:", CONFIG.DATA_URL);
        const response = await fetch(CONFIG.DATA_URL);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        console.log("JSON cargado, registros:", json.length);

        // Store original data for searching
        labsData = json;

        // Convert to GeoJSON
        const features = json.map(lab => {
            // Validate coordinates
            const lng = parseFloat(lab.longitude);
            const lat = parseFloat(lab.latitude);

            if (isNaN(lng) || isNaN(lat)) {
                return null; // Skip invalid points
            }

            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [lng, lat]
                },
                properties: {
                    id: lab.laboratory,
                    name: lab['ACC Name'],
                    apa: lab['APA Number'],
                    labNetwork: lab['Lab Network'] || '',
                    address: lab.Address || 'No disponible',
                    latitude: lat.toFixed(6),
                    longitude: lng.toFixed(6)
                }
            };
        }).filter(f => f !== null); // Filter out nulls

        geojsonData = {
            type: 'FeatureCollection',
            features: features
        };

        return geojsonData;
    } catch (error) {
        console.error("Error cargando datos:", error);
        loadingSpinner.innerHTML = `
            <div style="color: #ef4444; text-align: center;">
                <p><strong>Error loading data</strong></p>
                <p style="font-size: 0.8em; margin-top: 0.5em;">${error.message}</p>
                <p style="font-size: 0.7em; color: #64748b; margin-top: 1em;">Verify that 'labs_with_coordinates.json' is in the same folder.</p>
            </div>
        `;
        return null;
    }
}

// 4. Map Layers and Interaction
function setupMapLayers(geojsonData) {
    // Check if source already exists to avoid errors on reload
    if (map.getSource('labs')) {
        map.getSource('labs').setData(geojsonData);
        return;
    }

    map.addSource('labs', {
        type: 'geojson',
        data: geojsonData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
    });

    // Cluster Circles
    map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'labs',
        filter: ['has', 'point_count'],
        paint: {
            'circle-color': [
                'step',
                ['get', 'point_count'],
                '#51bbd6',
                100,
                '#f1f075',
                750,
                '#f28cb1'
            ],
            'circle-radius': [
                'step',
                ['get', 'point_count'],
                20,
                100,
                30,
                750,
                40
            ]
        }
    });

    // Cluster Count
    map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'labs',
        filter: ['has', 'point_count'],
        layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
        }
    });

    // Unclustered Points
    map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'labs',
        filter: ['!', ['has', 'point_count']],
        paint: {
            'circle-color': '#4f46e5',
            'circle-radius': 6,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
        }
    });

    // Click on unclustered points to show card
    map.on('click', 'unclustered-point', (e) => {
        const props = e.features[0].properties;
        showInfoCard(props);

        // Fly to point
        map.flyTo({
            center: e.features[0].geometry.coordinates,
            zoom: 12
        });
    });

    // Click on clusters to zoom in
    map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0].properties.cluster_id;
        map.getSource('labs').getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            map.easeTo({
                center: features[0].geometry.coordinates,
                zoom: zoom
            });
        });
    });

    // Cursor behavior
    const layers = ['unclustered-point', 'clusters'];
    layers.forEach(layer => {
        map.on('mouseenter', layer, () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layer, () => {
            map.getCanvas().style.cursor = '';
        });
    });
}

// 5. UI Interaction (Info Card)
function showInfoCard(props) {
    document.getElementById('lab-name').textContent = props.name || 'N/A';
    document.getElementById('lab-acc-name').textContent = props.name || 'N/A';
    document.getElementById('lab-apa').textContent = props.apa || 'N/A';
    document.getElementById('lab-network').textContent = props.labNetwork || '-';
    document.getElementById('lab-address').textContent = props.address || 'N/A';
    document.getElementById('lab-postcode').textContent = props.postal_code || 'N/A';
    document.getElementById('lab-latitude').textContent = props.latitude || 'N/A';
    document.getElementById('lab-longitude').textContent = props.longitude || 'N/A';

    infoCard.classList.remove('card-hidden');
}

closeCardBtn.addEventListener('click', () => {
    infoCard.classList.add('card-hidden');
});

// 6. Search and Filter Functionality


function populateNetworkFilter() {
    const networks = new Set();

    labsData.forEach(lab => {
        const network = lab['Lab Network'];
        if (network && network.trim() !== '') {
            networks.add(network.trim());
        }
    });

    // Sort networks alphabetically
    const sortedNetworks = Array.from(networks).sort();

    // Clear existing content
    networkFilterContent.innerHTML = '';

    // Add "Watch all labs" option
    // Default is checked
    const allOption = createCheckboxOption('all', 'Watch all labs', true);
    networkFilterContent.appendChild(allOption);

    // Add separator or just list others
    sortedNetworks.forEach(network => {
        const isSelected = selectedNetworks.includes(network);
        const option = createCheckboxOption(network, network, isSelected);
        networkFilterContent.appendChild(option);
    });
}

function createCheckboxOption(value, labelText, isChecked) {
    const item = document.createElement('div');
    item.className = 'dropdown-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = value;
    checkbox.checked = isChecked;

    // Checkbox Listener
    checkbox.addEventListener('change', (e) => {
        handleNetworkSelection(value, e.target.checked);
    });

    // Label
    const label = document.createElement('span');
    label.textContent = labelText;

    // Click on item toggles checkbox
    item.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
            handleNetworkSelection(value, checkbox.checked);
        }
    });

    item.appendChild(checkbox);
    item.appendChild(label);

    return item;
}

function handleNetworkSelection(value, isChecked) {
    if (value === 'all') {
        if (isChecked) {
            selectedNetworks = ['all'];
            // Uncheck all other checkboxes in UI
            const checkboxes = networkFilterContent.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                if (cb.value !== 'all') cb.checked = false;
            });
        } else {
            // "All" cannot be unchecked manually without selecting something else. 
            // If user unchecks "All" and nothing else is selected, maybe keep it checked?
            // User requirement: "Watch all labs" default.
            // Let's allow uncheck, which means 0 selected. 
            selectedNetworks = selectedNetworks.filter(n => n !== 'all');
        }
    } else {
        // Specific network
        if (isChecked) {
            selectedNetworks = selectedNetworks.filter(n => n !== 'all');
            selectedNetworks.push(value);

            // Uncheck "All" in UI
            const allCheckbox = networkFilterContent.querySelector('input[value="all"]');
            if (allCheckbox) allCheckbox.checked = false;
        } else {
            selectedNetworks = selectedNetworks.filter(n => n !== value);
        }
    }

    // If nothing selected, maybe fallback to All?
    // "Selecting a specific network will automatically deselect 'Watch all labs'." - Done
    // "Selecting 'Watch all labs' will automatically deselect all specific networks" - Done

    if (selectedNetworks.length === 0) {
        // Optional: Force All if nothing selected.
        // selectedNetworks = ['all'];
        // const allCheckbox = networkFilterContent.querySelector('input[value="all"]');
        // if (allCheckbox) allCheckbox.checked = true;
    }

    updateFilterButtonText();
    performSearch();
    updateMapData();
}

function updateFilterButtonText() {
    if (selectedNetworks.includes('all') || selectedNetworks.length === 0) {
        networkFilterBtn.childNodes[0].nodeValue = 'Watch all labs';
    } else {
        const count = selectedNetworks.length;
        networkFilterBtn.childNodes[0].nodeValue = `${count} Network${count > 1 ? 's' : ''} selected`;
    }
}

function setupSearchListeners() {
    // Search input listener
    searchInput.addEventListener('input', performSearch);

    // Toggle Dropdown
    networkFilterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        networkFilterContent.classList.toggle('hidden-dropdown');
    });

    // Click outside to close results and dropdown
    document.addEventListener('click', (e) => {
        // Close search results
        if (!searchContainer.contains(e.target)) {
            searchResults.classList.add('search-results-hidden');
            networkFilterContent.classList.add('hidden-dropdown');
        }
    });
}

// Update Map Data based on filters
function updateMapData() {
    // If "all" is selected or array is empty (implicit all?), show all data
    if (selectedNetworks.includes('all')) {
        map.getSource('labs').setData(geojsonData);
        return;
    }

    // Filter the data
    const filteredFeatures = geojsonData.features.filter(feature => {
        const labId = feature.properties.id;
        const lab = labsData.find(l => l.laboratory === labId);

        if (!lab) return false;

        // Network filter
        if (selectedNetworks.length > 0) {
            const labNetwork = lab['Lab Network'] || '';
            // Trim and check
            if (!selectedNetworks.includes(labNetwork.trim())) {
                return false;
            }
        }

        return true;
    });

    // Update the map source with filtered data
    const filteredGeoJSON = {
        type: 'FeatureCollection',
        features: filteredFeatures
    };

    map.getSource('labs').setData(filteredGeoJSON);
}

function performSearch() {
    const query = searchInput.value.trim().toLowerCase();

    // Clear results if query is empty
    if (!query) {
        searchResults.classList.add('search-results-hidden');
        searchResults.innerHTML = '';
        return;
    }

    // Filter labs based on query and state
    const filtered = labsData.filter(lab => {

        // Multi-select Network filter
        // If 'all' is NOT selected, we must check if lab is in selectedNetworks
        if (!selectedNetworks.includes('all') && selectedNetworks.length > 0) {
            const labNetwork = (lab['Lab Network'] || '').trim();
            if (!selectedNetworks.includes(labNetwork)) {
                return false;
            }
        }

        // Text search filter (if query exists)
        if (query) {
            const name = (lab['ACC Name'] || '').toLowerCase();
            const acc = (lab.ACC || '').toString().toLowerCase();
            const apa = (lab['APA Number'] || '').toString().toLowerCase();
            const address = (lab.Address || '').toLowerCase();
            const suburb = (lab['Suburb / Town'] || '').toLowerCase();
            const network = (lab['Lab Network'] || '').toLowerCase();

            return name.includes(query) ||
                acc.includes(query) ||
                apa.includes(query) ||
                address.includes(query) ||
                suburb.includes(query) ||
                network.includes(query);
        }

        return true;
    });

    displaySearchResults(filtered);
}

function displaySearchResults(results) {
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="no-results">No results found</div>';
        searchResults.classList.remove('search-results-hidden');
        return;
    }

    // Limit to 50 results for performance
    const limitedResults = results.slice(0, 50);

    searchResults.innerHTML = limitedResults.map(lab => {
        const name = lab['ACC Name'] || 'No name';
        const location = lab['Suburb / Town'] || 'Location not available';

        return `
            <div class="search-result-item" data-lab-id="${lab.laboratory}">
                <div class="result-name">${name}</div>
                <div class="result-location">${location}</div>
            </div>
        `;
    }).join('');

    // Add click listeners to results
    searchResults.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const labId = item.dataset.labId;
            navigateToLab(labId);
        });
    });

    searchResults.classList.remove('search-results-hidden');
}

function navigateToLab(labId) {
    // Find the lab in the data
    const lab = labsData.find(l => l.laboratory === labId);

    if (!lab) return;

    const lng = parseFloat(lab.longitude);
    const lat = parseFloat(lab.latitude);

    if (isNaN(lng) || isNaN(lat)) return;

    // Fly to the location
    map.flyTo({
        center: [lng, lat],
        zoom: 14,
        duration: 2000
    });

    // Show info card
    showInfoCard({
        name: lab['ACC Name'],
        apa: lab['APA Number'],
        labNetwork: lab['Lab Network'] || '',
        address: lab.Address || 'Not available',
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6)
    });

    // Hide search results
    searchResults.classList.add('search-results-hidden');
    searchInput.value = '';
}
