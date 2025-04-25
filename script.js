let map;
let markers = [];
let flightPath;

// Cache for airport coordinates to reduce API calls
const airportCoordinatesCache = {};

// Configuration object
const config = {
    apiKey: '', // Will be set from environment variable or configuration
    apiEndpoint: 'https://airlabs.co/api/v9'
};

// Set the backend URL based on environment
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;

// Add a simple airport coordinates database
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

// Add US state boundaries data (simplified)
const usStatesData = {
    // Simplified coordinates for continental US outline
    outline: [
        [-125, 48], [-123, 48], [-122, 47], [-120, 45], [-117, 43], 
        [-116, 41], [-114, 39], [-112, 37], [-111, 35], [-106, 32],
        [-97, 25], [-80, 25], [-75, 35], [-69, 44], [-67, 45],
        [-70, 43], [-75, 39], [-77, 37], [-81, 31], [-83, 30],
        [-87, 30], [-89, 30], [-94, 29], [-97, 28], [-100, 29],
        [-104, 31], [-107, 32], [-111, 31], [-114, 32], [-117, 33],
        [-120, 34], [-123, 38], [-124, 40], [-124, 42], [-125, 46],
        [-125, 48]
    ]
};

function initMap() {
    console.log('Initializing map...');
    
    // Initialize the map centered on US
    map = L.map('map').setView([39.8283, -98.5795], 4);

    // Add the tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    // Create and add the legend
    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = function(map) {
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

    // Ensure proper sizing
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

function parseFlightPlan(flightPlan) {
    console.log('Parsing flight plan:', flightPlan);
    const parts = flightPlan.split(',');
    const waypoints = [];
    
    // Handle single waypoint case
    if (parts.length === 2) {
        const icao = parts[0].trim().toUpperCase();
        const altitude = parseInt(parts[1].trim());
        
        if (!icao || !/^[A-Z]{3,4}$/.test(icao)) {
            throw new Error(`Invalid airport code: ${icao}`);
        }
        
        if (isNaN(altitude) || altitude < 0 || altitude > 60000) {
            throw new Error(`Invalid altitude: ${parts[1]}`);
        }
        
        waypoints.push({
            icao,
            altitude
        });
        return waypoints;
    }
    
    // Handle multiple waypoints
    if (parts.length % 2 !== 0) {
        throw new Error('Invalid flight plan format. Must contain pairs of airport codes and altitudes.');
    }
    
    for (let i = 0; i < parts.length; i += 2) {
        const icao = parts[i].trim().toUpperCase();
        const altitude = parseInt(parts[i + 1].trim());
        
        if (!icao || !/^[A-Z]{3,4}$/.test(icao)) {
            throw new Error(`Invalid airport code: ${icao}`);
        }
        
        if (isNaN(altitude) || altitude < 0 || altitude > 60000) {
            throw new Error(`Invalid altitude: ${parts[i + 1]}`);
        }
        
        waypoints.push({
            icao,
            altitude
        });
    }
    
    console.log('Parsed waypoints:', waypoints);
    return waypoints;
}

async function fetchWeatherData(flightPlan) {
    // Validate input format
    const waypoints = parseFlightPlan(flightPlan);
    if (waypoints.length === 0) {
        throw new Error('Invalid flight plan format. Please use format: KPHX,10000,VIDP,1000');
    }

    const airports = waypoints.map(wp => wp.icao);
    
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
                <h3>${waypoint.icao} <span style="opacity: 0.8">${waypoint.altitude.toLocaleString()} ft</span></h3>
                <div class="weather-condition-label">${weatherLabel}</div>
                <p>Wind: ${metar ? getWindInfo(metar) : 'N/A'}</p>
                <p>Visibility: ${metar ? getVisibilityInfo(metar) : 'N/A'}</p>
                ${index < waypoints.length - 1 ? `
                    <div class="next-waypoint">
                        Next: ${waypoints[index + 1].icao} at ${waypoints[index + 1].altitude.toLocaleString()} ft
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

// Initialize API key
async function initializeApiKey() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        config.apiKey = data.apiKey;
    } catch (error) {
        console.error('Failed to initialize API key:', error);
        // Fallback to local database only
    }
}

// Update the getAirportCoordinates function to use AirLabs API
async function getAirportCoordinates(airportCode) {
    if (!airportCode) {
        console.error('Airport code is undefined');
        return null;
    }

    // First check cache
    if (airportCoordinatesCache[airportCode]) {
        return airportCoordinatesCache[airportCode];
    }

    try {
        if (!config.apiKey) {
            // If no API key, fallback to local database
            if (airportCoordinates[airportCode]) {
                return airportCoordinates[airportCode];
            }
            return null; // Return null instead of throwing error
        }

        // Using AirLabs API
        const response = await fetch(`${config.apiEndpoint}/airports?iata_code=${airportCode}&api_key=${config.apiKey}`);
        const data = await response.json();
        
        if (data.error) {
            console.warn(`API Error for ${airportCode}: ${data.error.message}`);
            return null; // Return null instead of throwing error
        }

        if (data.response && data.response.length > 0) {
            const airport = data.response[0];
            const coordinates = {
                lat: parseFloat(airport.lat),
                lng: parseFloat(airport.lng),
                name: airport.name
            };
            
            // Cache the result
            airportCoordinatesCache[airportCode] = coordinates;
            return coordinates;
        } else {
            // Fallback to local database if API doesn't have the airport
            if (airportCoordinates[airportCode]) {
                return airportCoordinates[airportCode];
            }
            return null; // Return null instead of throwing error
        }
    } catch (error) {
        console.warn(`Error fetching coordinates for ${airportCode}:`, error);
        
        // Fallback to local database if API call fails
        if (airportCoordinates[airportCode]) {
            return airportCoordinates[airportCode];
        }
        return null;
    }
}

function drawGrid(ctx, width, height, minLat, maxLat, minLng, maxLng) {
    // Draw light grid lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;

    // Draw latitude lines every 5 degrees
    for (let lat = Math.floor(minLat/5)*5; lat <= maxLat; lat += 5) {
        ctx.beginPath();
        const y = height - ((lat - minLat) / (maxLat - minLat)) * height;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        // Label latitude
        ctx.fillStyle = '#999';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${lat}°N`, 5, y - 5);
    }

    // Draw longitude lines every 5 degrees
    for (let lng = Math.floor(minLng/5)*5; lng <= maxLng; lng += 5) {
        ctx.beginPath();
        const x = ((lng - minLng) / (maxLng - minLng)) * width;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        // Label longitude
        ctx.fillStyle = '#999';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${lng}°W`, x, height - 5);
    }
}

function drawUSMap(ctx, width, height, minLat, maxLat, minLng, maxLng) {
    // Function to convert lat/lng to canvas coordinates
    function projectPoint(lat, lng) {
        const x = ((lng - minLng) / (maxLng - minLng)) * width;
        const y = height - ((lat - minLat) / (maxLat - minLat)) * height;
        return [x, y];
    }

    // Draw US outline
    ctx.beginPath();
    usStatesData.outline.forEach((point, index) => {
        const [x, y] = projectPoint(point[1], point[0]);
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.closePath();
    
    // Fill with a light color
    ctx.fillStyle = 'rgba(240, 240, 240, 0.8)';
    ctx.fill();
    
    // Draw outline
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawMapBackground(ctx, width, height, bounds) {
    // Draw base background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);

    // Draw water background
    ctx.fillStyle = '#e6f3ff';
    ctx.fillRect(0, 0, width, height);

    // Draw US map
    drawUSMap(ctx, width, height, bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng);

    // Draw subtle gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(240, 240, 255, 0.1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

function drawFlightPath(waypoints) {
    console.log('Drawing flight path for waypoints:', waypoints);
    
    // Clear existing markers and path
    if (flightPath) {
        map.removeLayer(flightPath);
    }
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Filter out waypoints without valid coordinates
    const validWaypoints = waypoints.filter(wp => wp.lat && wp.lng);
    console.log('Valid waypoints:', validWaypoints);
    
    if (validWaypoints.length === 0) {
        console.error('No valid waypoints to display');
        return;
    }

    // Create the flight path
    const pathCoordinates = validWaypoints.map(wp => [wp.lat, wp.lng]);
    flightPath = L.polyline(pathCoordinates, {
        color: 'rgba(59, 130, 246, 0.8)',
        weight: 3,
        dashArray: '5, 5'
    }).addTo(map);

    // Add markers for each waypoint
    validWaypoints.forEach((waypoint, index) => {
        // Determine marker type based on position
        let markerType;
        if (index === 0) {
            markerType = 'departure';
        } else if (index === validWaypoints.length - 1) {
            markerType = 'arrival';
        } else {
            markerType = 'waypoint';
        }
        
        // Create custom icon
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div class="marker-container">
                    <div class="marker ${markerType}"></div>
                    <div class="marker-label">
                        <div class="airport-code">${waypoint.icao}</div>
                        <div class="altitude">${(waypoint.altitude/1000).toFixed(1)}K ft</div>
                    </div>
                </div>
            `,
            iconSize: [60, 40],
            iconAnchor: [30, 20]
        });

        // Add marker to map
        const marker = L.marker([waypoint.lat, waypoint.lng], {icon}).addTo(map);
        markers.push(marker);
    });

    // Fit map bounds to show all waypoints
    if (validWaypoints.length === 1) {
        // For single waypoint, center on it with a reasonable zoom level
        map.setView([validWaypoints[0].lat, validWaypoints[0].lng], 10);
    } else {
        // For multiple waypoints, fit bounds to show all
        const bounds = L.latLngBounds(validWaypoints.map(wp => [wp.lat, wp.lng]));
        map.fitBounds(bounds, {padding: [50, 50]});
    }
}

// Update the updateMap function to handle the waypoints correctly
async function updateMap(waypoints, weatherData) {
    console.log('Updating map with waypoints:', waypoints);
    try {
        // Get coordinates for all waypoints
        const waypointsWithCoords = [];
        for (const waypoint of waypoints) {
            console.log('Getting coordinates for:', waypoint.icao);
            const coords = await getAirportCoordinates(waypoint.icao);
            console.log('Coordinates received:', coords);
            if (coords) {
                waypointsWithCoords.push({
                    ...waypoint,
                    ...coords
                });
            } else {
                console.warn(`No coordinates found for airport ${waypoint.icao}`);
            }
        }

        console.log('Waypoints with coordinates:', waypointsWithCoords);
        
        if (waypointsWithCoords.length === 0) {
            console.warn('No valid waypoints found');
            return; // Just return without showing error
        }

        // Draw the flight path
        drawFlightPath(waypointsWithCoords);
    } catch (error) {
        console.error('Error updating map:', error);
        // Don't show error message to user
    }
}

// Add a function to clear all previous data
function clearAllData() {
    // Clear map data
    if (flightPath) {
        map.removeLayer(flightPath);
    }
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Clear weather cards
    document.getElementById('metarContent').innerHTML = '<div class="no-data">Loading METAR reports...</div>';
    document.getElementById('tafContent').innerHTML = '<div class="no-data">Loading TAF reports...</div>';
    document.getElementById('pirepContent').innerHTML = '<div class="no-data">Loading PIREP reports...</div>';
    document.getElementById('sigmetContent').innerHTML = '<div class="no-data">Loading SIGMET reports...</div>';
    
    // Clear route summary
    document.getElementById('summaryContent').innerHTML = '<div class="no-data">Loading route summary...</div>';
}

// Listen for language changes and update content
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApiKey();
    initMap();
    
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
            
            // Clear previous data before fetching new data
            clearAllData();
            
            const data = await fetchWeatherData(routeInput);
            updateUI(data);
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

    // Add read aloud functionality
    const readAloudBtn = document.getElementById('readAloudBtn');
    let speechSynthesis = window.speechSynthesis;
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

        // Get all the text content from the summary
        const summaryItems = summaryContent.querySelectorAll('.summary-item');
        let textToRead = '';

        summaryItems.forEach((item, index) => {
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

        // Create and speak the utterance
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
document.addEventListener('DOMContentLoaded', function() {
    const notesButton = document.getElementById('notesButton');
    const notesPanel = document.querySelector('.notes-panel');
    const closeNotes = document.querySelector('.close-notes');
    const notesTextarea = document.getElementById('notesTextarea');
    const notesStatus = document.querySelector('.notes-status');
    const notesHeader = document.querySelector('.notes-header');
    
    // Load saved notes
    const savedNotes = localStorage.getItem('flightNotes');
    if (savedNotes) {
        notesTextarea.value = savedNotes;
    }
    
    // Load saved position
    const savedPosition = localStorage.getItem('notesPosition');
    if (savedPosition) {
        const { x, y } = JSON.parse(savedPosition);
        notesPanel.style.left = `${x}px`;
        notesPanel.style.top = `${y}px`;
        notesPanel.style.right = 'auto';
        notesPanel.style.bottom = 'auto';
    }
    
    // Toggle notes panel
    notesButton.addEventListener('click', () => {
        notesPanel.classList.toggle('show');
    });
    
    // Close notes panel
    closeNotes.addEventListener('click', () => {
        notesPanel.classList.remove('show');
    });
    
    // Auto-save notes
    let saveTimeout;
    notesTextarea.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        notesStatus.textContent = 'Saving...';
        
        saveTimeout = setTimeout(() => {
            localStorage.setItem('flightNotes', notesTextarea.value);
            notesStatus.textContent = 'Auto-saved';
            
            // Show saved status briefly
            setTimeout(() => {
                notesStatus.style.opacity = '0.7';
            }, 2000);
        }, 1000);
    });
    
    // Dragging functionality
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

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        
        // Save position
        const rect = notesPanel.getBoundingClientRect();
        localStorage.setItem('notesPosition', JSON.stringify({
            x: rect.left,
            y: rect.top
        }));
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }
    
    // Close notes panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!notesPanel.contains(e.target) && !notesButton.contains(e.target)) {
            notesPanel.classList.remove('show');
        }
    });
}); 