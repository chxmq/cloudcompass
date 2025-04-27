require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
const port = process.env.PORT || 3000;

// Validate environment variables
const requiredEnvVars = ['GROQ_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars.join(', '));
    // Don't exit in production, just log the error
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(PUBLIC_DIR));

// API Routes
app.get('/api/config', (req, res) => {
    res.json({
        center: [-98.5795, 39.8283],
        zoom: 4
    });
});

// --- fetch helper with timeout ------------------------------------------
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

const SUMMARY_PROMPTS = {
    METAR: "Translate this METAR into simple English. Focus on current conditions only: ",
    TAF: "Translate this TAF forecast into simple English. What's the weather outlook? ",
    PIREP: "Explain this pilot report in simple terms. What did the pilot observe? ",
    SIGMET: "Explain this SIGMET in simple terms. What's the significant weather warning? "
};

async function generateSummary(data, type) {
    try {
        if (!data || (Array.isArray(data) && data.length === 0) || data === '') {
            return 'No data available to summarize.';
        }

        const dataToProcess = (type === 'TAF' && Array.isArray(data)) ? data.join('\n') : data;
        const prompt = SUMMARY_PROMPTS[type] || 'Explain this weather report in simple terms: ';

        if (!process.env.GROQ_API_KEY) {
            console.error('GROQ_API_KEY is not set in environment variables');
            return `Plain English summary temporarily unavailable (API key missing)`;
        }

        const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama3-70b-8192",
                messages: [{
                    role: "system",
                    content: "You are a helpful weather interpreter. Provide clear, No Bold Text to be provided, simple explanations of aviation weather reports in plain English. No technical jargon unless necessary. Keep responses concise and focused on the most important information for pilots."
                }, {
                    role: "user",
                    content: `${prompt}\n\n${dataToProcess}`
                }],
                temperature: 0.5,
                max_tokens: 150,
                top_p: 0.9,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Groq API error (${response.status}):`, errorText);
            throw new Error(`Groq API returned ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.choices || !result.choices[0] || !result.choices[0].message) {
            console.error('Invalid Groq API response:', result);
            throw new Error('Invalid response format from Groq API');
        }

        return result.choices[0].message.content;
    } catch (error) {
        console.error(`Error generating ${type} summary:`, error);
        return `Summary temporarily unavailable (${error.message})`;
    }
}

function filterSigmetsForRoute(sigmetLines, airports) {
    return sigmetLines.filter(sigmet => {
        return airports.some(airport => {
            if (sigmet.includes(airport)) {
                return true;
            }

            const areaMatch = sigmet.match(/AREA ([A-Z0-9]+)/);
            if (areaMatch) {
                const area = areaMatch[1];
                return airports.some(ap => ap.startsWith(area));
            }

            const latLonMatches = sigmet.match(/[NS]\d{2,4}[EW]\d{3,5}/g);
            if (latLonMatches) {
                return true;
            }

            const firMatch = sigmet.match(/([A-Z]{4}) FIR/);
            if (firMatch) {
                return airports.some(ap => ap.startsWith(firMatch[1]));
            }

            return false;
        });
    });
}

// The API prefixes each METAR with a report-type token ("METAR "/"SPECI ") that the rest of
// the app doesn't expect (station code is assumed to be the first 4 characters). Strip it so
// each entry starts directly with the ICAO code.
function normalizeMetarLines(rawText) {
    return rawText
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.trim().replace(/^(METAR|SPECI)\s+/, ''));
}

// TAFs come back as one "TAF <ICAO> ..." header line followed by indented FM/BECMG/TEMPO
// continuation lines with no station prefix of their own. Re-assemble each station's lines
// into a single block and strip the leading report-type token(s), so each entry starts
// directly with the ICAO code and contains the full forecast (matching normalizeMetarLines).
function normalizeTafBlocks(rawText) {
    const lines = rawText.split('\n').filter(line => line.trim().length > 0);
    const blocks = [];

    for (const line of lines) {
        if (/^\S/.test(line)) {
            blocks.push([line.trim()]);
        } else if (blocks.length > 0) {
            blocks[blocks.length - 1].push(line.trim());
        }
    }

    return blocks.map(block => block.join('\n').replace(/^(?:(?:TAF|AMD|COR)\s+)+/i, ''));
}

// Fetches raw METAR/TAF/PIREP/SIGMET text for a route. Shared by /api/weather and
// /api/consolidated-summary so the two endpoints can't drift out of sync.
async function fetchRouteWeatherData(airports) {
    const weatherData = { metar: [], taf: [], pirep: [], sigmet: [] };

    const metarResponse = await fetchWithTimeout(`https://aviationweather.gov/api/data/metar?ids=${airports.join(',')}&format=raw`);
    if (!metarResponse.ok) {
        throw new Error(`METAR API returned ${metarResponse.status}: ${metarResponse.statusText}`);
    }
    const metarData = await metarResponse.text();
    weatherData.metar = normalizeMetarLines(metarData);

    const tafResponse = await fetchWithTimeout(`https://aviationweather.gov/api/data/taf?ids=${airports.join(',')}&format=raw`);
    if (!tafResponse.ok) {
        throw new Error(`TAF API returned ${tafResponse.status}: ${tafResponse.statusText}`);
    }
    const tafData = await tafResponse.text();
    weatherData.taf = normalizeTafBlocks(tafData);

    try {
        // The PIREP endpoint requires a station + radius rather than a route, so query a
        // reasonable radius around each waypoint and merge/de-duplicate the results.
        const pirepResponses = await Promise.all(airports.map(airport =>
            fetchWithTimeout(`https://aviationweather.gov/api/data/pirep?id=${airport}&distance=200&age=3&format=raw`)
                .then(async response => (response.ok ? response.text() : ''))
                .catch(error => {
                    console.error(`Error fetching PIREP data for ${airport}:`, error);
                    return '';
                })
        ));

        const pirepLines = new Set();
        pirepResponses.forEach(text => {
            text.split('\n').filter(line => line.trim()).forEach(line => pirepLines.add(line));
        });
        weatherData.pirep = [...pirepLines];
    } catch (error) {
        console.error('Error fetching PIREP data:', error);
    }

    try {
        const [domesticSigmetResponse, intlSigmetResponse] = await Promise.all([
            fetchWithTimeout('https://aviationweather.gov/api/data/airsigmet?format=raw'),
            fetchWithTimeout('https://aviationweather.gov/api/data/isigmet?format=raw')
        ]);

        const sigmetLines = [];
        const isContentLine = line => {
            const trimmed = line.trim();
            return trimmed && !trimmed.startsWith('Type:') && !trimmed.startsWith('---');
        };

        if (domesticSigmetResponse.ok) {
            const domesticSigmetData = await domesticSigmetResponse.text();
            sigmetLines.push(...domesticSigmetData.split('\n').filter(isContentLine));
        } else {
            console.error(`Failed to fetch domestic SIGMET data: ${domesticSigmetResponse.status} ${domesticSigmetResponse.statusText}`);
        }

        if (intlSigmetResponse.ok) {
            const intlSigmetData = await intlSigmetResponse.text();
            sigmetLines.push(...intlSigmetData.split('\n').filter(isContentLine));
        } else {
            console.error(`Failed to fetch international SIGMET data: ${intlSigmetResponse.status} ${intlSigmetResponse.statusText}`);
        }

        weatherData.sigmet = filterSigmetsForRoute(sigmetLines, airports);
    } catch (error) {
        console.error('Error fetching SIGMET data:', error);
    }

    return weatherData;
}

app.get('/api/weather', async (req, res) => {
    const { route } = req.query;

    if (!route) {
        return res.status(400).json({
            error: 'Route parameter is required',
            details: 'Please provide a valid flight plan in the format: KPHX,10000,VIDP,1000'
        });
    }

    const routeParts = route.split(',');
    if (routeParts.length % 2 !== 0) {
        return res.status(400).json({
            error: 'Invalid route format',
            details: 'Route must contain pairs of airport codes and altitudes'
        });
    }

    const airports = [];
    for (let i = 0; i < routeParts.length; i += 2) {
        const airport = routeParts[i].trim();
        if (!airport || !/^[A-Z]{3,4}$/.test(airport)) {
            return res.status(400).json({
                error: 'Invalid airport code',
                details: `Airport code "${airport}" is invalid. Must be 3-4 uppercase letters.`
            });
        }
        airports.push(airport);
    }

    for (let i = 1; i < routeParts.length; i += 2) {
        const altitude = parseInt(routeParts[i].trim());
        if (isNaN(altitude) || altitude < 0 || altitude > 60000) {
            return res.status(400).json({
                error: 'Invalid altitude',
                details: `Altitude "${routeParts[i]}" is invalid. Must be a number between 0 and 60000 feet.`
            });
        }
    }

    try {
        const weatherData = await fetchRouteWeatherData(airports);

        // Group TAFs by airport for summaries
        const tafsByAirport = {};
        weatherData.taf.forEach(taf => {
            if (taf.length >= 4) {
                const airport = taf.substring(0, 4);
                if (!tafsByAirport[airport]) {
                    tafsByAirport[airport] = [];
                }
                tafsByAirport[airport].push(taf);
            }
        });

        const [metarSummaries, tafSummaries, pirepSummaries, sigmetSummaries] = await Promise.all([
            Promise.all(weatherData.metar.map(metar => generateSummary(metar, 'METAR'))),
            Promise.all(Object.entries(tafsByAirport).map(async ([airport, tafs]) => ({
                airport,
                summary: await generateSummary(tafs, 'TAF')
            }))),
            Promise.all(weatherData.pirep.map(pirep => generateSummary(pirep, 'PIREP'))),
            Promise.all(weatherData.sigmet.map(sigmet => generateSummary(sigmet, 'SIGMET')))
        ]);

        res.json({
            ...weatherData,
            summaries: {
                metar: metarSummaries,
                taf: tafSummaries,
                pirep: pirepSummaries,
                sigmet: sigmetSummaries
            }
        });
    } catch (error) {
        console.error('Error processing weather request:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

async function generateConsolidatedSummary(weatherData, waypoints) {
    try {
        if (!process.env.GROQ_API_KEY) {
            console.error('GROQ_API_KEY is not set in environment variables');
            return 'Summary temporarily unavailable (API key missing)';
        }

        if ((!weatherData.metar || weatherData.metar.length === 0) &&
            (!weatherData.taf || weatherData.taf.length === 0) &&
            (!weatherData.pirep || weatherData.pirep.length === 0) &&
            (!weatherData.sigmet || weatherData.sigmet.length === 0)) {
            return 'Insufficient weather data available to generate a consolidated summary.';
        }

        const prompt = `Analyze this aviation weather data and provide a comprehensive summary of the flight plan and weather conditions. Focus on:
1. Overall flight conditions
2. Key weather hazards or concerns
3. Best and worst segments of the route
4. Recommendations for the flight

Flight Plan: ${waypoints.map(wp => `${wp.icao} at ${wp.altitude}ft`).join(' → ')}

Weather Data:
METARs: ${weatherData.metar.join('\n') || 'None available'}
TAFs: ${weatherData.taf.join('\n') || 'None available'}
PIREPs: ${weatherData.pirep.join('\n') || 'None available'}
SIGMETs: ${weatherData.sigmet.join('\n') || 'None available'}

Provide a clear, concise summary in plain English.`;

        const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama3-70b-8192",
                messages: [{
                    role: "system",
                    content: "You are an experienced aviation weather analyst. Provide clear, concise summaries of flight conditions and weather hazards. Focus on actionable insights for pilots. Keep technical jargon to a minimum unless necessary."
                }, {
                    role: "user",
                    content: prompt
                }],
                temperature: 0.5,
                max_tokens: 500,
                top_p: 0.9,
                stream: false
            })
        }, 15000);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Groq API error (${response.status}):`, errorText);
            throw new Error(`Groq API returned ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.choices || !result.choices[0] || !result.choices[0].message) {
            console.error('Invalid Groq API response:', result);
            throw new Error('Invalid response format from Groq API');
        }

        return result.choices[0].message.content;
    } catch (error) {
        console.error('Error generating consolidated summary:', error);
        return `Summary temporarily unavailable (${error.message})`;
    }
}

app.get('/api/consolidated-summary', async (req, res) => {
    const { route } = req.query;

    if (!route) {
        return res.status(400).json({
            error: 'Route parameter is required',
            details: 'Please provide a valid flight plan in the format: KPHX,10000,VIDP,1000'
        });
    }

    const routeParts = route.split(',');
    if (routeParts.length % 2 !== 0) {
        return res.status(400).json({
            error: 'Invalid route format',
            details: 'Route must contain pairs of airport codes and altitudes'
        });
    }

    const waypoints = [];
    const airports = [];

    for (let i = 0; i < routeParts.length; i += 2) {
        const icao = routeParts[i].trim();
        const altitude = parseInt(routeParts[i + 1].trim());

        if (!icao || !/^[A-Z]{3,4}$/.test(icao)) {
            return res.status(400).json({
                error: 'Invalid airport code',
                details: `Airport code "${icao}" is invalid. Must be 3-4 uppercase letters.`
            });
        }

        if (isNaN(altitude) || altitude < 0 || altitude > 60000) {
            return res.status(400).json({
                error: 'Invalid altitude',
                details: `Altitude "${routeParts[i + 1]}" is invalid. Must be a number between 0 and 60000 feet.`
            });
        }

        waypoints.push({ icao, altitude });
        airports.push(icao);
    }

    try {
        const weatherData = await fetchRouteWeatherData(airports);
        const summary = await generateConsolidatedSummary(weatherData, waypoints);
        res.json({ summary });
    } catch (error) {
        console.error('Error generating consolidated summary:', error);
        res.status(500).json({
            error: 'Failed to generate summary',
            details: error.message
        });
    }
});

// Handle client-side routing - serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
