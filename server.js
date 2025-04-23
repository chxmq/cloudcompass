document.addEventListener('DOMContentLoaded', function() {
    const routeInput = document.getElementById('routeInput');
    const searchBtn = document.getElementById('searchBtn');
    const metarContent = document.getElementById('metarContent');
    const tafContent = document.getElementById('tafContent');
    const pirepContent = document.getElementById('pirepContent');
    const sigmetContent = document.getElementById('sigmetContent');
    const summaryContent = document.getElementById('summaryContent');
    const mapContainer = document.getElementById('map');
    const mapLoading = document.querySelector('.map-loading');
    
    let map;
    let mapboxToken;
    let markers = [];
    
    // Fetch configuration from server (including Mapbox token)
    async function fetchConfig() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Failed to fetch config:', error);
            showError('Failed to load configuration. Please try again later.');
            return null;
        }
    }
    
    // Initialize map after getting token from server
    async function initializeMap() {
        mapLoading.style.display = 'block';
        
        try {
            // Get config from server instead of using hardcoded token
            const config = await fetchConfig();
            if (!config || !config.mapboxToken) {
                throw new Error('Could not load Mapbox token from server');
            }
            
            mapboxgl.accessToken = config.mapboxToken;
            
            map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/outdoors-v12',
                center: [-98.5795, 39.8283], // Center of US
                zoom: 3
            });

            map.addControl(new mapboxgl.NavigationControl());
            
            map.on('load', function() {
                mapLoading.style.display = 'none';
                
                // Add source for flight path
                map.addSource('flight-path', {
                    'type': 'geojson',
                    'data': {
                        'type': 'Feature',
                        'properties': {},
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': []
                        }
                    }
                });
                
                // Add layer for flight path
                map.addLayer({
                    'id': 'flight-path',
                    'type': 'line',
                    'source': 'flight-path',
                    'layout': {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    'paint': {
                        'line-color': '#3887be',
                        'line-width': 5,
                        'line-opacity': 0.75
                    }
                });
            });
        } catch (error) {
            console.error('Map initialization error:', error);
            mapLoading.style.display = 'none';
            mapContainer.innerHTML = `<div class="error-message">Failed to load map: ${error.message}</div>`;
        }
    }
    
    // Simple airport coordinate lookup (a more complete version would use an API)
    function getAirportCoordinates(icao) {
        // This is a very simplified mapping for example purposes
        const airports = {
            'KPHX': [-112.0118, 33.4342],   // Phoenix
            'KLAX': [-118.4085, 33.9416],   // Los Angeles
            'KJFK': [-73.7781, 40.6413],    // New York JFK
            'KORD': [-87.9073, 41.9742],    // Chicago O'Hare
            'KATL': [-84.4277, 33.6407],    // Atlanta
            'KSFO': [-122.3750, 37.6188],   // San Francisco
            'KDFW': [-97.0403, 32.8998],    // Dallas
            'KMIA': [-80.2781, 25.7933],    // Miami
            'KDEN': [-104.6737, 39.8561],   // Denver
            'KSEA': [-122.3088, 47.4502],   // Seattle
            'KBOS': [-71.0054, 42.3629],    // Boston
            'KLAS': [-115.1522, 36.0804],   // Las Vegas
            'KSLC': [-111.9822, 40.7884],   // Salt Lake City
            'KMSP': [-93.2215, 44.8803],    // Minneapolis
            'KBXK': [-112.6856, 33.4200],   // Buckeye Municipal
            'KPSP': [-116.5060, 33.8295]    // Palm Springs
        };
        
        return airports[icao] || null;
    }
    
    // Update flight path on map
    function updateFlightPath(route) {
        if (!map || !map.loaded()) {
            setTimeout(() => updateFlightPath(route), 500);
            return;
        }
        
        // Clear existing markers
        markers.forEach(marker => marker.remove());
        markers = [];
        
        // Parse route
        const routeParts = route.split(',');
        const coordinates = [];
        const bounds = new mapboxgl.LngLatBounds();
        
        for (let i = 0; i < routeParts.length; i += 2) {
            const airport = routeParts[i].trim().toUpperCase();
            const altitude = routeParts[i+1] ? parseInt(routeParts[i+1].trim()) : 'N/A';
            
            // Skip invalid airport codes
            if (!/^[A-Z]{3,4}$/.test(airport)) continue;
            
            // Get airport coordinates
            const airportCoords = getAirportCoordinates(airport);
            
            if (airportCoords) {
                coordinates.push(airportCoords);
                bounds.extend(airportCoords);
                
                // Create marker
                const marker = new mapboxgl.Marker({ color: '#FF5733' })
                    .setLngLat(airportCoords)
                    .setPopup(new mapboxgl.Popup().setHTML(`<h3>${airport}</h3><p>Altitude: ${altitude} ft</p>`))
                    .addTo(map);
                
                markers.push(marker);
            }
        }
        
        // Update flight path on map
        if (coordinates.length > 1) {
            const source = map.getSource('flight-path');
            if (source) {
                source.setData({
                    'type': 'Feature',
                    'properties': {},
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': coordinates
                    }
                });
                
                // Fit map to show all points with padding
                map.fitBounds(bounds, { padding: 50 });
            }
        }
    }
    
    // Show weather reports on page
    function displayWeatherData(data) {
        // METAR reports
        if (data.summaries.metar && data.summaries.metar.length > 0) {
            let metarHTML = '<div class="reports">';
            data.summaries.metar.forEach(item => {
                metarHTML += `
                    <div class="report">
                        <div class="report-raw">${item.raw}</div>
                        <div class="report-summary">
                            <span class="summary-title">In Plain English:</span>
                            <span class="summary-text">${item.summary}</span>
                        </div>
                    </div>`;
            });
            metarHTML += '</div>';
            metarContent.innerHTML = metarHTML;
        } else {
            metarContent.innerHTML = '<div class="no-data">No METAR data available for this route</div>';
        }
        
        // TAF reports
        if (data.summaries.taf && data.summaries.taf.length > 0) {
            let tafHTML = '<div class="reports">';
            data.summaries.taf.forEach(item => {
                tafHTML += `
                    <div class="report">
                        <div class="report-header">${item.airport}</div>
                        <div class="report-raw">${Array.isArray(item.raw) ? item.raw.join('<br>') : item.raw}</div>
                        <div class="report-summary">
                            <span class="summary-title">In Plain English:</span>
                            <span class="summary-text">${item.summary}</span>
                        </div>
                    </div>`;
            });
            tafHTML += '</div>';
            tafContent.innerHTML = tafHTML;
        } else {
            tafContent.innerHTML = '<div class="no-data">No TAF data available for this route</div>';
        }
        
        // PIREP reports
        if (data.summaries.pirep && data.summaries.pirep.length > 0) {
            let pirepHTML = '<div class="reports">';
            data.summaries.pirep.forEach(item => {
                pirepHTML += `
                    <div class="report">
                        <div class="report-raw">${item.raw}</div>
                        <div class="report-summary">
                            <span class="summary-title">In Plain English:</span>
                            <span class="summary-text">${item.summary}</span>
                        </div>
                    </div>`;
            });
            pirepHTML += '</div>';
            pirepContent.innerHTML = pirepHTML;
        } else {
            pirepContent.innerHTML = '<div class="no-data">No PIREP data available for this route</div>';
        }
        
        // SIGMET reports
        if (data.summaries.sigmet && data.summaries.sigmet.length > 0) {
            let sigmetHTML = '<div class="reports">';
            data.summaries.sigmet.forEach(item => {
                sigmetHTML += `
                    <div class="report">
                        <div class="report-raw">${item.raw}</div>
                        <div class="report-summary">
                            <span class="summary-title">In Plain English:</span>
                            <span class="summary-text">${item.summary}</span>
                        </div>
                    </div>`;
            });
            sigmetHTML += '</div>';
            sigmetContent.innerHTML = sigmetHTML;
        } else {
            sigmetContent.innerHTML = '<div class="no-data">No SIGMET data available for this route</div>';
        }
        
        // Generate route summary
        const routeParts = routeInput.value.split(',');
        let summaryHTML = '<div class="route-summary">';
        summaryHTML += '<h3>Your Flight Plan</h3>';
        summaryHTML += '<ul class="route-list">';
        
        for (let i = 0; i < routeParts.length; i += 2) {
            if (i + 1 < routeParts.length) {
                summaryHTML += `<li><strong>${routeParts[i].trim().toUpperCase()}</strong> at ${routeParts[i+1].trim()} feet</li>`;
            }
        }
        
        summaryHTML += '</ul>';
        summaryHTML += '</div>';
        summaryContent.innerHTML = summaryHTML;
    }
    
    // Show error message
    function showError(message) {
        metarContent.innerHTML = `<div class="error-message">${message}</div>`;
        tafContent.innerHTML = `<div class="error-message">${message}</div>`;
        pirepContent.innerHTML = `<div class="error-message">${message}</div>`;
        sigmetContent.innerHTML = `<div class="error-message">${message}</div>`;
    }
    
    // Handle search button click
    searchBtn.addEventListener('click', async function() {
        const route = routeInput.value.trim();
        
        if (!route) {
            showError('Please enter a valid flight plan');
            return;
        }
        
        // Show loading state
        searchBtn.classList.add('loading');
        metarContent.innerHTML = '<div class="loading">Loading weather data...</div>';
        tafContent.innerHTML = '<div class="loading">Loading forecast data...</div>';
        pirepContent.innerHTML = '<div class="loading">Loading pilot reports...</div>';
        sigmetContent.innerHTML = '<div class="loading">Loading weather warnings...</div>';
        
        try {
            // Update map with route
            updateFlightPath(route);
            
            // Fetch weather data from server
            const response = await fetch(`/api/weather?route=${encodeURIComponent(route)}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || `Server returned ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            displayWeatherData(data);
            
        } catch (error) {
            console.error('Error fetching weather data:', error);
            showError(`Failed to fetch weather data: ${error.message}`);
        } finally {
            searchBtn.classList.remove('loading');
        }
    });
    
    // Initialize the map when page loads
    initializeMap();
    
    // Allow pressing Enter in input field to trigger search
    routeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });
});