let map;
let markers = [];
let flightPath;

// Cache for airport coordinates to reduce repeated lookups
const airportCoordinatesCache = {};

// Set the backend URL based on environment
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;

// Local airport coordinates database (used to plot waypoints on the map)
const airportCoordinates = {
    // Major International Airports
    'KATL': { lat: 33.6367, lng: -84.4281, name: 'Hartsfield-Jackson Atlanta International' },
    'KORD': { lat: 41.9786, lng: -87.9048, name: "O'Hare International" },
    'KDFW': { lat: 32.8969, lng: -97.0381, name: 'Dallas/Fort Worth International' },
    'KDEN': { lat: 39.8617, lng: -104.6731, name: 'Denver International' },
    'KJFK': { lat: 40.6397, lng: -73.7789, name: 'John F. Kennedy International' },
    'KLAX': { lat: 33.9425, lng: -118.4081, name: 'Los Angeles International' },
    'KMIA': { lat: 25.7933, lng: -80.2906, name: 'Miami International' },
    'KLAS': { lat: 36.0840, lng: -115.1537, name: 'Las Vegas Harry Reid International' },
    'KSFO': { lat: 37.6189, lng: -122.3750, name: 'San Francisco International' },
    'KPHX': { lat: 33.4342, lng: -112.0119, name: 'Phoenix Sky Harbor International' },
    'KIAH': { lat: 29.9844, lng: -95.3414, name: 'George Bush Intercontinental' },
    'KMCO': { lat: 28.4294, lng: -81.3089, name: 'Orlando International' },
    'KSEA': { lat: 47.4490, lng: -122.3093, name: 'Seattle-Tacoma International' },
    'KEWR': { lat: 40.6895, lng: -74.1745, name: 'Newark Liberty International' },
    'KBOS': { lat: 42.3656, lng: -71.0096, name: 'Boston Logan International' },

    // Major Regional Airports
    'KMDW': { lat: 41.7868, lng: -87.7522, name: 'Chicago Midway International' },
    'KBWI': { lat: 39.1754, lng: -76.6682, name: 'Baltimore/Washington International' },
    'KSLC': { lat: 40.7884, lng: -111.9778, name: 'Salt Lake City International' },
    'KSAN': { lat: 32.7336, lng: -117.1897, name: 'San Diego International' },
    'KTPA': { lat: 27.9755, lng: -82.5332, name: 'Tampa International' },
    'KPDX': { lat: 45.5898, lng: -122.5951, name: 'Portland International' },
    'KDET': { lat: 42.4095, lng: -83.0097, name: 'Detroit Metropolitan' },
    'KCLT': { lat: 35.2141, lng: -80.9431, name: 'Charlotte Douglas International' },
    'KPHF': { lat: 37.1319, lng: -76.4930, name: 'Newport News/Williamsburg International' },
    'KMSP': { lat: 44.8820, lng: -93.2218, name: 'Minneapolis-Saint Paul International' },

    // Secondary Airports
    'KOAK': { lat: 37.7214, lng: -122.2208, name: 'Oakland International' },
    'KSJC': { lat: 37.3639, lng: -121.9289, name: 'Norman Y. Mineta San Jose International' },
    'KBUR': { lat: 34.2007, lng: -118.3590, name: 'Hollywood Burbank' },
    'KONT': { lat: 34.0558, lng: -117.6011, name: 'Ontario International' },
    'KAUS': { lat: 30.1975, lng: -97.6664, name: 'Austin-Bergstrom International' },
    'KSAT': { lat: 29.5337, lng: -98.4690, name: 'San Antonio International' },
    'KDAL': { lat: 32.8481, lng: -96.8518, name: 'Dallas Love Field' },
    'KHOU': { lat: 29.6454, lng: -95.2789, name: 'William P. Hobby' },
    'KSNA': { lat: 33.6762, lng: -117.8677, name: 'John Wayne Airport' },
    'KPBI': { lat: 26.6832, lng: -80.0956, name: 'Palm Beach International' },

    // Popular Regional Airports
    'KFLL': { lat: 26.0726, lng: -80.1527, name: 'Fort Lauderdale-Hollywood International' },
    'KRDU': { lat: 35.8776, lng: -78.7875, name: 'Raleigh-Durham International' },
    'KCVG': { lat: 39.0489, lng: -84.6678, name: 'Cincinnati/Northern Kentucky International' },
    'KMKE': { lat: 42.9472, lng: -87.8966, name: 'Milwaukee Mitchell International' },
    'KMEM': { lat: 35.0424, lng: -89.9767, name: 'Memphis International' },
    'KPIT': { lat: 40.4915, lng: -80.2329, name: 'Pittsburgh International' },
    'KIND': { lat: 39.7173, lng: -86.2944, name: 'Indianapolis International' },
    'KCLE': { lat: 41.4117, lng: -81.8497, name: 'Cleveland Hopkins International' },
    'KCMH': { lat: 39.9980, lng: -82.8918, name: 'John Glenn Columbus International' },
    'KBNA': { lat: 36.1245, lng: -86.6782, name: 'Nashville International' }
};

// Escapes text pulled from external sources (raw weather data, LLM summaries) before it's
// dropped into innerHTML, so it can never be interpreted as markup.
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function initMap() {
    map = L.map('map').setView([39.8283, -98.5795], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML = `
            <div class="legend-item">
                <div class="legend-dot departure"></div>
                <div class="legend-label">Departure Airport</div>
            </div>
            <div class="legend-item">
                <div class="legend-dot waypoint"></div>
                <div class="legend-label">Layover/Waypoint</div>
            </div>
            <div class="legend-item">
                <div class="legend-dot arrival"></div>
                <div class="legend-label">Arrival Airport</div>
            </div>
        `;
        return div;
    };

    legend.addTo(map);

    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

async function fetchWeatherData(flightPlan) {
    const waypoints = FlightPlanUtils.parseFlightPlan(flightPlan);

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
    return {
        station: metar.substring(0, 4),
        time: metar.substring(5, 11),
        wind: metar.match(/KT(\d{3}|VRB)(\d{2,3})/),
        visibility: metar.match(/ (\d+)SM/),
        weather: metar.match(/[+-]?(RA|SN|DZ|FG|BR|HZ|FU|SA|DU|TS|SQ|FC|SS|DS)/g),
        clouds: metar.match(/ (FEW|SCT|BKN|OVC)(\d{3})/g),
        temperature: metar.match(/ (\d{2})\/(\d{2})/),
        altimeter: metar.match(/A(\d{4})/)
    };
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
    if (altitude) formatted += `<p><strong>Altitude:</strong> FL${escapeHtml(altitude[1])}</p>`;
    if (location) formatted += `<p><strong>Location:</strong> ${escapeHtml(location[1])} ${escapeHtml(location[2])}${escapeHtml(location[3])}</p>`;
    if (time) formatted += `<p><strong>Time:</strong> ${escapeHtml(time[1])}:${escapeHtml(time[2])}Z</p>`;
    if (weather) formatted += `<p><strong>Type:</strong> ${escapeHtml(weather[1])}</p>`;
    if (turbulence) formatted += `<p><strong>Turbulence:</strong> ${escapeHtml(turbulence[1])}</p>`;
    if (icing) formatted += `<p><strong>Icing:</strong> ${escapeHtml(icing[1])}</p>`;
    if (remarks) formatted += `<p><strong>Remarks:</strong> ${escapeHtml(remarks[1])}</p>`;
    formatted += '</div>';

    return formatted;
}

function formatSIGMET(sigmet) {
    let formatted = '<div class="sigmet-details">';

    const idMatch = sigmet.match(/([A-Z]{1,2}\d{1,2})/);
    const typeMatch = sigmet.match(/SIGMET|AIRMET|WST/);

    if (idMatch) {
        formatted += `<p><strong>ID:</strong> ${escapeHtml(idMatch[1])}</p>`;
    }

    if (typeMatch) {
        formatted += `<p><strong>Type:</strong> ${escapeHtml(typeMatch[0])}</p>`;
    }

    const validMatch = sigmet.match(/VALID (\d{6})\/(\d{6})/);
    if (validMatch) {
        formatted += `<p><strong>Valid:</strong> ${formatTime(validMatch[1])} to ${formatTime(validMatch[2])}</p>`;
    }

    const areaMatch = sigmet.match(/AREA ([A-Z0-9]+)/);
    if (areaMatch) {
        formatted += `<p><strong>Area:</strong> ${escapeHtml(areaMatch[1])}</p>`;
    }

    const firMatch = sigmet.match(/([A-Z]{4}) FIR/);
    if (firMatch) {
        formatted += `<p><strong>FIR:</strong> ${escapeHtml(firMatch[1])}</p>`;
    }

    const wxMatch = sigmet.match(/\b(TS|TURB|ICE|MTW|DS|SS|VA|TC|RDOACT)\b/);
    if (wxMatch) {
        formatted += `<p><strong>Phenomenon:</strong> ${escapeHtml(getWeatherPhenomenonDescription(wxMatch[1]))}</p>`;
    }

    const intensityMatch = sigmet.match(/\b(ISOL|OCNL|FRQ|OBSC|EMBD|SQL)\b/);
    if (intensityMatch) {
        formatted += `<p><strong>Intensity:</strong> ${escapeHtml(getIntensityDescription(intensityMatch[1]))}</p>`;
    }

    const movementMatch = sigmet.match(/MOV ([NSEW]{1,2}) (\d+)KT/);
    if (movementMatch) {
        formatted += `<p><strong>Movement:</strong> ${escapeHtml(movementMatch[1])} at ${escapeHtml(movementMatch[2])} knots</p>`;
    }

    const altitudeMatch = sigmet.match(/(\d{3})\/(\d{3})/);
    if (altitudeMatch) {
        formatted += `<p><strong>Altitude:</strong> FL${escapeHtml(altitudeMatch[1])} to FL${escapeHtml(altitudeMatch[2])}</p>`;
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

async function updateUI(data) {
    const { weatherData, waypoints } = data;
    const routeInputEl = document.getElementById('routeInput');

    // Update consolidated summary
    try {
        const response = await fetch(`${BACKEND_URL}/api/consolidated-summary?route=${encodeURIComponent(routeInputEl.value)}`);
        if (response.ok) {
            const summaryData = await response.json();
            const consolidatedSummary = document.getElementById('consolidatedSummary');
            consolidatedSummary.innerHTML = `
                <div class="summary-section">
                    <h3><i class="fas fa-plane"></i> Flight Analysis</h3>
                    <p>${escapeHtml(summaryData.summary)}</p>
                </div>
                <div class="weather-highlights">
                    <div class="weather-highlight">
                        <i class="fas fa-cloud-sun"></i>
                        <h4>Overall Conditions</h4>
                        <p>${escapeHtml(getOverallConditions(weatherData))}</p>
                    </div>
                    <div class="weather-highlight">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h4>Key Hazards</h4>
                        <p>${escapeHtml(getKeyHazards(weatherData))}</p>
                    </div>
                    <div class="weather-highlight">
                        <i class="fas fa-chart-line"></i>
                        <h4>Route Analysis</h4>
                        <p>${escapeHtml(getRouteAnalysis(waypoints))}</p>
                    </div>
                </div>
            `;
        } else {
            throw new Error('Failed to fetch consolidated summary');
        }
    } catch (error) {
        console.error('Error fetching consolidated summary:', error);
        document.getElementById('consolidatedSummary').innerHTML = `
            <div class="no-data">Unable to generate comprehensive summary</div>
        `;
    }

    // Update METAR section
    const metarContent = document.getElementById('metarContent');
    if (weatherData.metar && weatherData.metar.length > 0) {
        metarContent.innerHTML = weatherData.metar
            .map((metar, index) => `
                <div class="weather-item">
                    <h3 class="airport-header">${escapeHtml(metar.substring(0, 4))}</h3>
                    <div class="raw-data">${escapeHtml(metar)}</div>
                    <div class="decoded-data">
                        <div class="technical-decode">${formatDecodedMetar(decodeMETAR(metar))}</div>
                        <div class="plain-english">
                            <h4>In Plain English:</h4>
                            ${escapeHtml(weatherData.summaries.metar[index]) || 'Summary unavailable'}
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
        const tafsByAirport = {};
        weatherData.taf.forEach(taf => {
            const airport = taf.substring(0, 4);
            if (!tafsByAirport[airport]) {
                tafsByAirport[airport] = [];
            }
            tafsByAirport[airport].push(taf);
        });

        const tafHtml = Object.entries(tafsByAirport).map(([airport, tafs]) => {
            const summary = weatherData.summaries.taf.find(s => s.airport === airport);
            return `
                <div class="weather-item">
                    <h3 class="airport-header">${escapeHtml(airport)} Forecast</h3>
                    <div class="raw-data">${escapeHtml(tafs.join('\n'))}</div>
                    <div class="decoded-data">
                        <div class="plain-english">
                            <h4>In Plain English:</h4>
                            ${summary ? escapeHtml(summary.summary) : 'Summary unavailable'}
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
                    <div class="raw-data">${escapeHtml(pirep)}</div>
                    <div class="decoded-data">
                        <div class="technical-decode">${formatPIREP(pirep)}</div>
                        <div class="plain-english">
                            <h4>In Plain English:</h4>
                            ${escapeHtml(weatherData.summaries.pirep[index]) || 'Summary unavailable'}
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
                    <div class="raw-data">${escapeHtml(sigmet)}</div>
                    <div class="decoded-data">
                        <div class="technical-decode">${formatSIGMET(sigmet)}</div>
                        <div class="plain-english">
                            <h4>In Plain English:</h4>
                            ${escapeHtml(weatherData.summaries.sigmet[index]) || 'Summary unavailable'}
                        </div>
                    </div>
                </div>
            `).join('');
    } else {
        sigmetContent.innerHTML = '<div class="no-data">No SIGMETs affecting this route</div>';
    }

    generateWeatherSummary(weatherData, waypoints);
    updateMap(waypoints, weatherData);
}

function formatDecodedMetar(decoded) {
    let html = '<div class="decoded-metar">';
    if (decoded.wind) {
        html += `<p>Wind: ${escapeHtml(decoded.wind[1])}° at ${escapeHtml(decoded.wind[2])} knots</p>`;
    }
    if (decoded.visibility) {
        html += `<p>Visibility: ${escapeHtml(decoded.visibility[1])} statute miles</p>`;
    }
    if (decoded.weather) {
        html += `<p>Weather: ${escapeHtml(decoded.weather.join(', '))}</p>`;
    }
    if (decoded.clouds) {
        html += `<p>Clouds: ${escapeHtml(decoded.clouds.join(', '))}</p>`;
    }
    if (decoded.temperature) {
        html += `<p>Temperature: ${escapeHtml(decoded.temperature[1])}°C / Dewpoint: ${escapeHtml(decoded.temperature[2])}°C</p>`;
    }
    if (decoded.altimeter) {
        html += `<p>Altimeter: ${escapeHtml(decoded.altimeter[1])} inHg</p>`;
    }
    html += '</div>';
    return html;
}

function generateWeatherSummary(weatherData, waypoints) {
    let summary = '<div class="summary-content">';

    waypoints.forEach((waypoint, index) => {
        const metar = weatherData.metar.find(m => m.startsWith(waypoint.icao));
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
                <h3>${escapeHtml(waypoint.icao)} <span style="opacity: 0.8">${waypoint.altitude.toLocaleString()} ft</span></h3>
                <div class="weather-condition-label">${weatherLabel}</div>
                <p>Wind: ${metar ? escapeHtml(getWindInfo(metar)) : 'N/A'}</p>
                <p>Visibility: ${metar ? escapeHtml(getVisibilityInfo(metar)) : 'N/A'}</p>
                ${index < waypoints.length - 1 ? `
                    <div class="next-waypoint">
                        Next: ${escapeHtml(waypoints[index + 1].icao)} at ${waypoints[index + 1].altitude.toLocaleString()} ft
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
        return `${windMatch[1]}° at ${windMatch[2]} knots`;
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

// Looks up airport coordinates from the local database so waypoints can be plotted on the map.
async function getAirportCoordinates(airportCode) {
    if (!airportCode) {
        return null;
    }

    if (airportCoordinatesCache[airportCode]) {
        return airportCoordinatesCache[airportCode];
    }

    const coordinates = airportCoordinates[airportCode];
    if (coordinates) {
        airportCoordinatesCache[airportCode] = coordinates;
        return coordinates;
    }

    console.warn(`No coordinates found for airport ${airportCode}; it won't be plotted on the map.`);
    return null;
}

function drawFlightPath(waypoints) {
    if (flightPath) {
        map.removeLayer(flightPath);
    }
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    const validWaypoints = waypoints.filter(wp => wp.lat && wp.lng);

    if (validWaypoints.length === 0) {
        console.warn('No valid waypoints to display on the map');
        return;
    }

    const pathCoordinates = validWaypoints.map(wp => [wp.lat, wp.lng]);
    flightPath = L.polyline(pathCoordinates, {
        color: 'rgba(59, 130, 246, 0.8)',
        weight: 3,
        dashArray: '5, 5'
    }).addTo(map);

    validWaypoints.forEach((waypoint, index) => {
        let markerType;
        if (index === 0) {
            markerType = 'departure';
        } else if (index === validWaypoints.length - 1) {
            markerType = 'arrival';
        } else {
            markerType = 'waypoint';
        }

        const icon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div class="marker-container">
                    <div class="marker ${markerType}"></div>
                    <div class="marker-label">
                        <div class="airport-code">${escapeHtml(waypoint.icao)}</div>
                        <div class="altitude">${(waypoint.altitude / 1000).toFixed(1)}K ft</div>
                    </div>
                </div>
            `,
            iconSize: [60, 40],
            iconAnchor: [30, 20]
        });

        const marker = L.marker([waypoint.lat, waypoint.lng], { icon }).addTo(map);
        markers.push(marker);
    });

    if (validWaypoints.length === 1) {
        map.setView([validWaypoints[0].lat, validWaypoints[0].lng], 10);
    } else {
        const bounds = L.latLngBounds(validWaypoints.map(wp => [wp.lat, wp.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

async function updateMap(waypoints) {
    try {
        const waypointsWithCoords = [];
        for (const waypoint of waypoints) {
            const coords = await getAirportCoordinates(waypoint.icao);
            if (coords) {
                waypointsWithCoords.push({ ...waypoint, ...coords });
            }
        }

        if (waypointsWithCoords.length === 0) {
            return;
        }

        drawFlightPath(waypointsWithCoords);
    } catch (error) {
        console.error('Error updating map:', error);
    }
}

function clearAllData() {
    if (flightPath) {
        map.removeLayer(flightPath);
    }
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    document.getElementById('metarContent').innerHTML = '<div class="no-data">Loading METAR reports...</div>';
    document.getElementById('tafContent').innerHTML = '<div class="no-data">Loading TAF reports...</div>';
    document.getElementById('pirepContent').innerHTML = '<div class="no-data">Loading PIREP reports...</div>';
    document.getElementById('sigmetContent').innerHTML = '<div class="no-data">Loading SIGMET reports...</div>';
    document.getElementById('summaryContent').innerHTML = '<div class="no-data">Loading route summary...</div>';
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();

    document.getElementById('metarContent').innerHTML = '<div class="no-data">Enter a flight plan to see METAR reports</div>';
    document.getElementById('tafContent').innerHTML = '<div class="no-data">Enter a flight plan to see TAF reports</div>';
    document.getElementById('pirepContent').innerHTML = '<div class="no-data">Enter a flight plan to see PIREP reports</div>';
    document.getElementById('sigmetContent').innerHTML = '<div class="no-data">Enter a flight plan to see SIGMET reports</div>';
    document.getElementById('summaryContent').innerHTML = '<div class="no-data">Enter a flight plan to see route summary and weather conditions</div>';

    const searchBtn = document.getElementById('searchBtn');
    const routeInput = document.getElementById('routeInput');

    // Re-run the search when Google Translate swaps content, so dynamically inserted
    // weather text gets translated too.
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList.contains('translated-ltr') || target.classList.contains('translated-rtl')) {
                    if (routeInput.value) {
                        searchBtn.click();
                    }
                }
            }
        });
    });

    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
    });

    searchBtn.addEventListener('click', async () => {
        const flightPlanValue = routeInput.value.trim();

        if (!flightPlanValue) {
            showError('Please enter a flight plan');
            return;
        }

        try {
            FlightPlanUtils.parseFlightPlan(flightPlanValue);
        } catch (error) {
            showError(error.message);
            return;
        }

        try {
            searchBtn.classList.add('loading');
            searchBtn.disabled = true;

            clearAllData();

            const data = await fetchWeatherData(flightPlanValue);
            updateUI(data);
        } catch (error) {
            showError(error.message);
        } finally {
            searchBtn.classList.remove('loading');
            searchBtn.disabled = false;
        }
    });

    routeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });

    // Read aloud functionality
    const readAloudBtn = document.getElementById('readAloudBtn');
    const speechSynthesis = window.speechSynthesis;
    let isReading = false;

    readAloudBtn.addEventListener('click', () => {
        if (isReading) {
            speechSynthesis.cancel();
            isReading = false;
            readAloudBtn.innerHTML = '<i class="fas fa-volume-up"></i> Read Aloud';
            readAloudBtn.disabled = false;
            return;
        }

        const summaryContent = document.getElementById('summaryContent');
        if (!summaryContent || summaryContent.querySelector('.no-data')) {
            return;
        }

        isReading = true;
        readAloudBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Reading';
        readAloudBtn.disabled = false;

        const summaryItems = summaryContent.querySelectorAll('.summary-item');
        let textToRead = '';

        summaryItems.forEach((item) => {
            const airport = item.querySelector('h3').textContent;
            const weatherLabel = item.querySelector('.weather-condition-label').textContent;
            const wind = item.querySelector('p:nth-of-type(1)').textContent;
            const visibility = item.querySelector('p:nth-of-type(2)').textContent;

            textToRead += `At ${airport}, ${weatherLabel}. ${wind}. ${visibility}. `;

            const nextWaypoint = item.querySelector('.next-waypoint');
            if (nextWaypoint) {
                textToRead += `Next waypoint: ${nextWaypoint.textContent}. `;
            }
        });

        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.onend = () => {
            isReading = false;
            readAloudBtn.innerHTML = '<i class="fas fa-volume-up"></i> Read Aloud';
            readAloudBtn.disabled = false;
        };
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            isReading = false;
            readAloudBtn.innerHTML = '<i class="fas fa-volume-up"></i> Read Aloud';
            readAloudBtn.disabled = false;
        };

        speechSynthesis.speak(utterance);
    });
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

// Notes functionality
document.addEventListener('DOMContentLoaded', function () {
    const notesButton = document.getElementById('notesButton');
    const notesPanel = document.querySelector('.notes-panel');
    const closeNotes = document.querySelector('.close-notes');
    const notesTextarea = document.getElementById('notesTextarea');
    const notesStatus = document.querySelector('.notes-status');
    const notesHeader = document.querySelector('.notes-header');

    const savedNotes = localStorage.getItem('flightNotes');
    if (savedNotes) {
        notesTextarea.value = savedNotes;
    }

    const savedPosition = localStorage.getItem('notesPosition');
    if (savedPosition) {
        const { x, y } = JSON.parse(savedPosition);
        notesPanel.style.left = `${x}px`;
        notesPanel.style.top = `${y}px`;
        notesPanel.style.right = 'auto';
        notesPanel.style.bottom = 'auto';
    }

    function setNotesOpen(open) {
        notesPanel.classList.toggle('show', open);
        notesButton.setAttribute('aria-expanded', String(open));
    }

    notesButton.addEventListener('click', () => {
        setNotesOpen(!notesPanel.classList.contains('show'));
    });

    closeNotes.addEventListener('click', () => {
        setNotesOpen(false);
    });

    let saveTimeout;
    notesTextarea.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        notesStatus.textContent = 'Saving...';

        saveTimeout = setTimeout(() => {
            localStorage.setItem('flightNotes', notesTextarea.value);
            notesStatus.textContent = 'Auto-saved';

            setTimeout(() => {
                notesStatus.style.opacity = '0.7';
            }, 2000);
        }, 1000);
    });

    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    notesHeader.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === notesHeader || e.target === notesHeader.querySelector('h3')) {
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();

            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, notesPanel);
        }
    }

    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;

        const rect = notesPanel.getBoundingClientRect();
        localStorage.setItem('notesPosition', JSON.stringify({
            x: rect.left,
            y: rect.top
        }));
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }

    document.addEventListener('click', (e) => {
        if (!notesPanel.contains(e.target) && !notesButton.contains(e.target)) {
            setNotesOpen(false);
        }
    });
});

function getOverallConditions(weatherData) {
    const conditions = [];
    if (weatherData.metar.some(metar => metar.includes('TS'))) {
        conditions.push('Thunderstorms');
    }
    if (weatherData.metar.some(metar => metar.includes('RA'))) {
        conditions.push('Rain');
    }
    if (weatherData.metar.some(metar => metar.includes('SN'))) {
        conditions.push('Snow');
    }
    if (weatherData.metar.some(metar => metar.includes('FG'))) {
        conditions.push('Fog');
    }
    return conditions.length > 0 ? conditions.join(', ') : 'Generally good conditions';
}

function getKeyHazards(weatherData) {
    const hazards = [];
    if (weatherData.sigmet.length > 0) {
        hazards.push('SIGMETs in effect');
    }
    if (weatherData.pirep.some(pirep => pirep.includes('TURB'))) {
        hazards.push('Turbulence reported');
    }
    if (weatherData.pirep.some(pirep => pirep.includes('IC'))) {
        hazards.push('Icing reported');
    }
    return hazards.length > 0 ? hazards.join(', ') : 'No significant hazards reported';
}

function getRouteAnalysis(waypoints) {
    const altitudes = waypoints.map(wp => wp.altitude);
    const maxAlt = Math.max(...altitudes);
    const minAlt = Math.min(...altitudes);
    return `Altitude range: ${minAlt.toLocaleString()}ft - ${maxAlt.toLocaleString()}ft`;
}
