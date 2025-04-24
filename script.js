let map;
let markers = [];
let flightPath;
let mapboxConfig;

// Cache for airport coordinates to reduce API calls
const airportCoordinatesCache = {};

// Set the backend URL based on environment
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;

async function initMap() {
    try {
        // Fetch the Mapbox configuration from the server
        if (!mapboxConfig) {
            try {
                const response = await fetch(`${BACKEND_URL}/api/config`);
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                mapboxConfig = await response.json();
                if (!mapboxConfig.token) {
                    throw new Error('Mapbox configuration not available');
                }
            } catch (error) {
                console.error('Error fetching config:', error);
                showError('Map initialization failed. Please check your environment configuration.');
                return;
            }
        }

        console.log('Initializing map with configuration:', mapboxConfig);
        
        if (!mapboxConfig.token) {
            throw new Error('Mapbox access token is not set');
        }

        mapboxgl.accessToken = mapboxConfig.token;
        map = new mapboxgl.Map({
            container: 'map',
            style: mapboxConfig.style,
            center: mapboxConfig.center,
            zoom: mapboxConfig.zoom
        });

        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl());

        // Add error handling for map load
        map.on('load', () => {
            console.log('Map loaded successfully');
            // Hide loading message
            const loadingElement = document.querySelector('.map-loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        });

        map.on('error', (e) => {
            console.error('Map error:', e);
            showError('Failed to load map. Please check console for details.');
            // Hide loading message on error
            const loadingElement = document.querySelector('.map-loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        });

    } catch (error) {
        console.error('Error initializing map:', error);
        showError('Failed to initialize map. Please check console for details.');
        // Hide loading message on error
        const loadingElement = document.querySelector('.map-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

function parseFlightPlan(flightPlan) {
    const parts = flightPlan.split(',');
    const waypoints = [];
    
    if (parts.length % 2 !== 0) {
        throw new Error('Invalid flight plan format. Must contain pairs of airport codes and altitudes.');
    }
    
    for (let i = 0; i < parts.length; i += 2) {
        const airport = parts[i].trim();
        const altitude = parseInt(parts[i + 1].trim());
        
        if (!airport || !/^[A-Z]{3,4}$/.test(airport)) {
            throw new Error(`Invalid airport code: ${airport}`);
        }
        
        if (isNaN(altitude) || altitude < 0 || altitude > 60000) {
            throw new Error(`Invalid altitude: ${parts[i + 1]}`);
        }
        
        waypoints.push({
            airport,
            altitude
        });
    }
    
    return waypoints;
}

async function fetchWeatherData(flightPlan) {
    // Validate input format
    const waypoints = parseFlightPlan(flightPlan);
    if (waypoints.length === 0) {
        throw new Error('Invalid flight plan format. Please use format: KPHX,10000,VIDP,1000');
    }

    const airports = waypoints.map(wp => wp.airport);
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/weather?route=${encodeURIComponent(flightPlan)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || `Server returned ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        return { weatherData: data, waypoints };
    } catch (error) {
        console.error('Error fetching weather data:', error);
        throw error;
    }
}

function decodeMETAR(metar) {
    const decoded = {
        station: metar.substring(0, 4),
        time: metar.substring(5, 11),
        wind: metar.match(/KT(\d{3}|VRB)(\d{2,3})/),
        visibility: metar.match(/ (\d+)SM/),
        weather: metar.match(/[+-]?(RA|SN|DZ|FG|BR|HZ|FU|SA|DU|TS|SQ|FC|SS|DS)/g),
        clouds: metar.match(/ (FEW|SCT|BKN|OVC)(\d{3})/g),
        temperature: metar.match(/ (\d{2})\/(\d{2})/),
        altimeter: metar.match(/A(\d{4})/)
    };

    return decoded;
}

function formatPIREP(pirep) {
    const altitude = pirep.match(/FL(\d{3})/);
    const location = pirep.match(/\/OV ([A-Z]{2,3})(\d{2,3})(\d{2,3})/);
    const time = pirep.match(/(\d{2})(\d{2})Z/);
    const weather = pirep.match(/\/TP ([A-Z]+)/);
    const remarks = pirep.match(/\/RMK (.+)/);
    const turbulence = pirep.match(/\/TB ([A-Z]+)/);
    const icing = pirep.match(/\/IC ([A-Z]+)/);

    let formatted = '<div class="pirep-item">';
    if (altitude) formatted += `<p><strong>Altitude:</strong> FL${altitude[1]}</p>`;
    if (location) formatted += `<p><strong>Location:</strong> ${location[1]} ${location[2]}${location[3]}</p>`;
    if (time) formatted += `<p><strong>Time:</strong> ${time[1]}:${time[2]}Z</p>`;
    if (weather) formatted += `<p><strong>Type:</strong> ${weather[1]}</p>`;
    if (turbulence) formatted += `<p><strong>Turbulence:</strong> ${turbulence[1]}</p>`;
    if (icing) formatted += `<p><strong>Icing:</strong> ${icing[1]}</p>`;
    if (remarks) formatted += `<p><strong>Remarks:</strong> ${remarks[1]}</p>`;
    formatted += '</div>';

    return formatted;
}

function formatSIGMET(sigmet) {
    let formatted = '<div class="sigmet-details">';
    
    // Extract SIGMET ID and type
    const idMatch = sigmet.match(/([A-Z]{1,2}\d{1,2})/);
    const typeMatch = sigmet.match(/SIGMET|AIRMET|WST/);
    
    if (idMatch) {
        formatted += `<p><strong>ID:</strong> ${idMatch[1]}</p>`;
    }
    
    if (typeMatch) {
        formatted += `<p><strong>Type:</strong> ${typeMatch[0]}</p>`;
    }

    // Extract validity period
    const validMatch = sigmet.match(/VALID (\d{6})\/(\d{6})/);
    if (validMatch) {
        const startTime = validMatch[1];
        const endTime = validMatch[2];
        formatted += `<p><strong>Valid:</strong> ${formatTime(startTime)} to ${formatTime(endTime)}</p>`;
    }

    // Extract affected area
    const areaMatch = sigmet.match(/AREA ([A-Z0-9]+)/);
    if (areaMatch) {
        formatted += `<p><strong>Area:</strong> ${areaMatch[1]}</p>`;
    }

    // Extract FIR if present
    const firMatch = sigmet.match(/([A-Z]{4}) FIR/);
    if (firMatch) {
        formatted += `<p><strong>FIR:</strong> ${firMatch[1]}</p>`;
    }

    // Extract weather phenomenon
    const wxMatch = sigmet.match(/\b(TS|TURB|ICE|MTW|DS|SS|VA|TC|RDOACT)\b/);
    if (wxMatch) {
        formatted += `<p><strong>Phenomenon:</strong> ${getWeatherPhenomenonDescription(wxMatch[1])}</p>`;
    }

    // Extract intensity/descriptor if present
    const intensityMatch = sigmet.match(/\b(ISOL|OCNL|FRQ|OBSC|EMBD|SQL)\b/);
    if (intensityMatch) {
        formatted += `<p><strong>Intensity:</strong> ${getIntensityDescription(intensityMatch[1])}</p>`;
    }

    // Extract movement
    const movementMatch = sigmet.match(/MOV ([NSEW]{1,2}) (\d+)KT/);
    if (movementMatch) {
        formatted += `<p><strong>Movement:</strong> ${movementMatch[1]} at ${movementMatch[2]} knots</p>`;
    }

    // Extract altitude information
    const altitudeMatch = sigmet.match(/(\d{3})\/(\d{3})/);
    if (altitudeMatch) {
        formatted += `<p><strong>Altitude:</strong> FL${altitudeMatch[1]} to FL${altitudeMatch[2]}</p>`;
    }

    formatted += '</div>';
    return formatted;
}

function formatTime(timeStr) {
    const day = timeStr.substring(0, 2);
    const hour = timeStr.substring(2, 4);
    const minute = timeStr.substring(4, 6);
    return `${day}/${hour}:${minute}Z`;
}

function getWeatherPhenomenonDescription(code) {
    const phenomena = {
        'TS': 'Thunderstorm',
        'TURB': 'Turbulence',
        'ICE': 'Icing',
        'MTW': 'Mountain Wave',
        'DS': 'Dust Storm',
        'SS': 'Sand Storm',
        'VA': 'Volcanic Ash',
        'TC': 'Tropical Cyclone',
        'RDOACT': 'Radioactive Cloud'
    };
    return phenomena[code] || code;
}

function getIntensityDescription(code) {
    const intensities = {
        'ISOL': 'Isolated',
        'OCNL': 'Occasional',
        'FRQ': 'Frequent',
        'OBSC': 'Obscured',
        'EMBD': 'Embedded',
        'SQL': 'Squall Line'
    };
    return intensities[code] || code;
}

function updateUI(data) {
    const { weatherData, waypoints } = data;
    
    // Update METAR section
    const metarContent = document.getElementById('metarContent');
    if (weatherData.metar && weatherData.metar.length > 0) {
        metarContent.innerHTML = weatherData.metar
            .map((metar, index) => `
                <div class="weather-item">
                    <h3 class="airport-header">${metar.substring(0, 4)}</h3>
                    <div class="raw-data">${metar}</div>
                    <div class="decoded-data">
                        <div class="technical-decode">${formatDecodedMetar(decodeMETAR(metar))}</div>
                        <div class="plain-english">
                            <h4>In Plain English:</h4>
                            ${weatherData.summaries.metar[index] || 'Summary unavailable'}
                        </div>
                    </div>
                </div>
            `).join('');
    } else {
        metarContent.innerHTML = '<div class="no-data">No METAR data available for this route</div>';
    }

    // Update TAF section
    const tafContent = document.getElementById('tafContent');
    if (weatherData.taf && weatherData.taf.length > 0) {
        // Group TAFs by airport
        const tafsByAirport = {};
        weatherData.taf.forEach(taf => {
            const airport = taf.substring(0, 4);
            if (!tafsByAirport[airport]) {
                tafsByAirport[airport] = [];
            }
            tafsByAirport[airport].push(taf);
        });

        // Create HTML for each airport's TAF
        const tafHtml = Object.entries(tafsByAirport).map(([airport, tafs]) => {
            const summary = weatherData.summaries.taf.find(s => s.airport === airport);
            return `
                <div class="weather-item">
                    <h3 class="airport-header">${airport} Forecast</h3>
                    <div class="raw-data">${tafs.join('\n')}</div>
                    <div class="decoded-data">
                        <div class="plain-english">
                            <h4>In Plain English:</h4>
                            ${summary ? summary.summary : 'Summary unavailable'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        tafContent.innerHTML = tafHtml;
    } else {
        tafContent.innerHTML = '<div class="no-data">No TAF data available for this route</div>';
    }

    // Update PIREP section
    const pirepContent = document.getElementById('pirepContent');
    if (weatherData.pirep && weatherData.pirep.length > 0) {
        pirepContent.innerHTML = weatherData.pirep
            .map((pirep, index) => `
                <div class="weather-item">
                    <h3 class="airport-header">Pilot Report</h3>
                    <div class="raw-data">${pirep}</div>
                    <div class="decoded-data">
                        <div class="technical-decode">${formatPIREP(pirep)}</div>
                        <div class="plain-english">
                            <h4>In Plain English:</h4>
                            ${weatherData.summaries.pirep[index] || 'Summary unavailable'}
                        </div>
                    </div>
                </div>
            `).join('');
    } else {
        pirepContent.innerHTML = '<div class="no-data">No PIREPs available for this route</div>';
    }

    // Update SIGMET section
    const sigmetContent = document.getElementById('sigmetContent');
    if (weatherData.sigmet && weatherData.sigmet.length > 0) {
        sigmetContent.innerHTML = weatherData.sigmet
            .map((sigmet, index) => `
                <div class="weather-item">
                    <h3 class="airport-header">Significant Weather</h3>
                    <div class="raw-data">${sigmet}</div>
                    <div class="decoded-data">
                        <div class="technical-decode">${formatSIGMET(sigmet)}</div>
                        <div class="plain-english">
                            <h4>In Plain English:</h4>
                            ${weatherData.summaries.sigmet[index] || 'Summary unavailable'}
                        </div>
                    </div>
                </div>
            `).join('');
    } else {
        sigmetContent.innerHTML = '<div class="no-data">No SIGMETs affecting this route</div>';
    }

    // Update map and summary
    generateWeatherSummary(weatherData, waypoints);
    updateMap(waypoints, weatherData);
}

function formatDecodedMetar(decoded) {
    let html = '<div class="decoded-metar">';
    if (decoded.wind) {
        html += `<p>Wind: ${decoded.wind[1]}° at ${decoded.wind[2]} knots</p>`;
    }
    if (decoded.visibility) {
        html += `<p>Visibility: ${decoded.visibility[1]} statute miles</p>`;
    }
    if (decoded.weather) {
        html += `<p>Weather: ${decoded.weather.join(', ')}</p>`;
    }
    if (decoded.clouds) {
        html += `<p>Clouds: ${decoded.clouds.join(', ')}</p>`;
    }
    if (decoded.temperature) {
        html += `<p>Temperature: ${decoded.temperature[1]}°C / Dewpoint: ${decoded.temperature[2]}°C</p>`;
    }
    if (decoded.altimeter) {
        html += `<p>Altimeter: ${decoded.altimeter[1]} inHg</p>`;
    }
    html += '</div>';
    return html;
}

function generateWeatherSummary(weatherData, waypoints) {
    let summary = '<div class="summary-content">';

    waypoints.forEach((waypoint, index) => {
        const metar = weatherData.metar.find(m => m.startsWith(waypoint.airport));
        let weatherCondition = 'vfr';
        let weatherLabel = 'VFR';
        
        if (metar) {
            const decoded = decodeMETAR(metar);
            
            if (decoded.weather && decoded.weather.some(w => ['TS', 'SQ', 'FC'].includes(w))) {
                weatherCondition = 'severe-wx';
                weatherLabel = 'SEVERE-WX';
            } else if (decoded.weather || (decoded.clouds && decoded.clouds.some(c => c.includes('BKN') || c.includes('OVC')))) {
                weatherCondition = 'sig-wx';
                weatherLabel = 'SIG-WX';
            }
        }

        summary += `
            <div class="summary-item ${weatherCondition}">
                <h3>${waypoint.airport} <span style="opacity: 0.8">${waypoint.altitude.toLocaleString()} ft</span></h3>
                <div class="weather-condition-label">${weatherLabel}</div>
                <p>Wind: ${metar ? getWindInfo(metar) : 'N/A'}</p>
                <p>Visibility: ${metar ? getVisibilityInfo(metar) : 'N/A'}</p>
                ${index < waypoints.length - 1 ? `
                    <div class="next-waypoint">
                        Next: ${waypoints[index + 1].airport} at ${waypoints[index + 1].altitude.toLocaleString()} ft
                    </div>
                ` : ''}
            </div>
        `;
    });

    summary += '</div>';
    document.getElementById('summaryContent').innerHTML = summary;
}

function getWindInfo(metar) {
    const windMatch = metar.match(/(\d{3}|VRB)(\d{2,3})KT/);
    if (windMatch) {
        const direction = windMatch[1];
        const speed = windMatch[2];
        return `${direction}° at ${speed} knots`;
    }
    return 'N/A';
}

function getVisibilityInfo(metar) {
    const visMatch = metar.match(/ (\d+)SM/);
    if (visMatch) {
        return `${visMatch[1]} SM`;
    }
    return 'N/A';
}

function calculateTotalDistance(waypoints) {
    // This is a placeholder - you'll need to implement actual distance calculation
    // based on the coordinates of the waypoints
    return 'N/A';
}

async function updateMap(waypoints, weatherData) {
    // Clear existing markers and flight path
    markers.forEach(marker => marker.remove());
    markers = [];
    if (flightPath) {
        flightPath.remove();
    }

    let bounds = new mapboxgl.LngLatBounds();

    for (let i = 0; i < waypoints.length; i++) {
        const waypoint = waypoints[i];
        const coordinates = await getAirportCoordinates(waypoint.airport);
        
        if (coordinates) {
            const [lng, lat] = coordinates;
            bounds.extend([lng, lat]);

            // Create marker
            const marker = new mapboxgl.Marker({
                color: '#FF0000',
                scale: 0.8
            })
                .setLngLat([lng, lat])
                .setPopup(new mapboxgl.Popup({ offset: 25 })
                    .setHTML(`<strong>${waypoint.airport}</strong><br>Altitude: ${waypoint.altitude}ft`))
                .addTo(map);

            markers.push(marker);

            // Add weather circle
            if (weatherData && weatherData[waypoint.airport]) {
                const weather = weatherData[waypoint.airport];
                const radius = 50000; // 50km radius
                
                map.addLayer({
                    id: `weather-circle-${waypoint.airport}`,
                    type: 'circle',
                    source: {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            properties: {},
                            geometry: {
                                type: 'Point',
                                coordinates: [lng, lat]
                            }
                        }
                    },
                    paint: {
                        'circle-radius': radius,
                        'circle-color': '#FF0000',
                        'circle-opacity': 0.1,
                        'circle-stroke-width': 1,
                        'circle-stroke-color': '#FF0000'
                    }
                });
            }
        }
    }

    // Add flight path
    if (waypoints.length > 1) {
        const coordinates = [];
        for (const waypoint of waypoints) {
            const coords = await getAirportCoordinates(waypoint.airport);
            if (coords) {
                coordinates.push(coords);
            }
        }

        if (coordinates.length > 1) {
            map.addLayer({
                id: 'flight-path',
                type: 'line',
                source: {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'LineString',
                            coordinates: coordinates
                        }
                    }
                },
                paint: {
                    'line-color': '#FF0000',
                    'line-width': 2,
                    'line-dasharray': [2, 2]
                }
            });
        }
    }

    // Fit map to bounds
    if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
            padding: 50
        });
    }
}

async function getAirportCoordinates(airportCode) {
    // Check cache first
    if (airportCoordinatesCache[airportCode]) {
        return airportCoordinatesCache[airportCode];
    }

    try {
        // Use OpenSky Network's API for airport coordinates
        const response = await fetch(`https://opensky-network.org/api/airports?icao=${airportCode}`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            const airport = data[0];
            const coordinates = [airport.longitude, airport.latitude];
            
            // Cache the result
            airportCoordinatesCache[airportCode] = coordinates;
            return coordinates;
        }
    } catch (error) {
        console.error(`Error fetching coordinates for ${airportCode}:`, error);
    }
    
    return null;
}

// Listen for language changes and update content
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all weather cards with empty states
    document.getElementById('metarContent').innerHTML = '<div class="no-data">Enter a flight plan to see METAR reports</div>';
    document.getElementById('tafContent').innerHTML = '<div class="no-data">Enter a flight plan to see TAF reports</div>';
    document.getElementById('pirepContent').innerHTML = '<div class="no-data">Enter a flight plan to see PIREP reports</div>';
    document.getElementById('sigmetContent').innerHTML = '<div class="no-data">Enter a flight plan to see SIGMET reports</div>';
    document.getElementById('summaryContent').innerHTML = '<div class="no-data">Enter a flight plan to see route summary and weather conditions</div>';

    // Add event listener for language changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList.contains('translated-ltr') || target.classList.contains('translated-rtl')) {
                    // Reinitialize any dynamic content that needs to be translated
                    const routeInput = document.getElementById('routeInput');
                    if (routeInput.value) {
                        searchBtn.click();
                    }
                }
            }
        });
    });

    // Start observing the body for language changes
    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
    });

    // Add event listeners
    const searchBtn = document.getElementById('searchBtn');
    const routeInput = document.getElementById('routeInput');
    
    searchBtn.addEventListener('click', async () => {
        const routeInput = document.getElementById('routeInput').value.trim();
        
        if (!routeInput) {
            showError('Please enter a flight plan');
            return;
        }

        // Validate flight plan format
        const parts = routeInput.split(',');
        if (parts.length % 2 !== 0) {
            showError('Invalid flight plan format. Must contain pairs of airport codes and altitudes.');
            return;
        }

        // Validate airport codes
        for (let i = 0; i < parts.length; i += 2) {
            const airport = parts[i].trim();
            if (!/^[A-Z]{3,4}$/.test(airport)) {
                showError(`Invalid airport code: ${airport}. Must be 3-4 uppercase letters.`);
                return;
            }
        }

        // Validate altitudes
        for (let i = 1; i < parts.length; i += 2) {
            const altitude = parseInt(parts[i].trim());
            if (isNaN(altitude) || altitude < 0 || altitude > 60000) {
                showError(`Invalid altitude: ${parts[i]}. Must be a number between 0 and 60000 feet.`);
                return;
            }
        }

        try {
            // Add loading state
            searchBtn.classList.add('loading');
            searchBtn.disabled = true;
            
            const data = await fetchWeatherData(routeInput);
            updateUI(data);
            await updateMap(data.waypoints, data.weatherData);
        } catch (error) {
            showError(error.message);
        } finally {
            // Remove loading state
            searchBtn.classList.remove('loading');
            searchBtn.disabled = false;
        }
    });

    routeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });

    // Initialize Mapbox map
    initMap();
});

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const searchContainer = document.querySelector('.search-container');
    const existingError = searchContainer.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    searchContainer.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
} 