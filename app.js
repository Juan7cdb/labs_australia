// Configuration
const CONFIG = {
    CREDENTIALS: {
        email: "juan.mora@tbtbglobal.com",
        password: "1234567890"
    },
    MAPBOX_TOKEN: 'pk.eyJ1IjoianVhbmRhdmlkbTAxIiwiYSI6ImNtNWJtdmtkbzBic2syanNjZzloMWJucGkifQ.YmX4q044T4OUnw3JExU-0g', // Placeholder - User should update if needed
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

// State
let map;

// 1. Authentication Logic
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (email === CONFIG.CREDENTIALS.email && password === CONFIG.CREDENTIALS.password) {
        loginOverlay.classList.add('hidden');
        initMap();
    } else {
        errorMsg.textContent = "Credenciales incorrectas. Intente de nuevo.";
        setTimeout(() => { errorMsg.textContent = ""; }, 3000);
    }
});

// 2. Map Initialization
function initMap() {
    // Show spinner immediately when starting map load
    loadingSpinner.classList.add('visible');
    loadingSpinner.innerHTML = '<div class="spinner"></div><p>Iniciando mapa...</p>';

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
                    <p><strong>Error del Mapa</strong></p>
                    <p style="font-size: 0.8em;">${e.error ? e.error.message : 'No se pudo cargar el mapa.'}</p>
                    <p style="font-size: 0.7em; margin-top: 10px;">Verifique su Token de Mapbox en app.js</p>
                </div>
            `;
        });

        map.on('load', async () => {
            loadingSpinner.innerHTML = '<div class="spinner"></div><p>Cargando datos...</p>';

            const data = await fetchLabsData();

            if (data) {
                setupMapLayers(data);

                // Update counter and hide spinner
                recordCountEl.innerText = data.features.length.toLocaleString();
                statsCounter.classList.remove('hidden');
                loadingSpinner.classList.remove('visible');
            } else {
                loadingSpinner.innerHTML = `
                    <div style="color: #ef4444;">
                        <p>Error cargando datos</p>
                    </div>`;
            }
        });

    } catch (err) {
        loadingSpinner.innerHTML = `
            <div style="color: #ef4444;">
                <p>Error crítico de inicialización</p>
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
                    location: lab['Suburb / Town'] || 'No disponible',
                    dates: `${lab['From Date']} - ${lab['To Date']}`,
                    acc: lab.ACC,
                    apa: lab['APA Number']
                }
            };
        }).filter(f => f !== null); // Filter out nulls

        return {
            type: 'FeatureCollection',
            features: features
        };
    } catch (error) {
        console.error("Error cargando datos:", error);
        loadingSpinner.innerHTML = `
            <div style="color: #ef4444; text-align: center;">
                <p><strong>Error cargando datos</strong></p>
                <p style="font-size: 0.8em; margin-top: 0.5em;">${error.message}</p>
                <p style="font-size: 0.7em; color: #64748b; margin-top: 1em;">Verifique que 'labs_with_coordinates.json' esté en la misma carpeta.</p>
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
    document.getElementById('lab-name').textContent = props.name;
    document.getElementById('lab-location').textContent = props.location;
    document.getElementById('lab-dates').textContent = props.dates;
    document.getElementById('lab-acc').textContent = props.acc;
    document.getElementById('lab-apa').textContent = props.apa;

    infoCard.classList.remove('card-hidden');
}

closeCardBtn.addEventListener('click', () => {
    infoCard.classList.add('card-hidden');
});
