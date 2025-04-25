require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
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

// Serve static files from the current directory
app.use(express.static(__dirname));

// API Routes
app.get('/api/config', (req, res) => {
    // Return a simple config without Mapbox
    res.json({
        center: [-98.5795, 39.8283],
        zoom: 4
    });
});

async function generateSummary(data, type) {
    try {
        if (!data || (Array.isArray(data) && data.length === 0) || data === '') {
            return 'No data available to summarize.';
        }

        // Handle array data properly
        let dataToProcess = data;
        if (type === 'TAF' && Array.isArray(data)) {
            dataToProcess = data.join('\n');
        }

        let prompt;
        switch(type) {
            case 'METAR':
                prompt = "Translate this METAR into simple English. Focus on current conditions only: ";
                break;
            case 'TAF':
                prompt = "Translate this TAF forecast into simple English. What's the weather outlook? ";
                break;
            case 'PIREP':
                prompt = "Explain this pilot report in simple terms. What did the pilot observe? ";
                break;
            case 'SIGMET':
                prompt = "Explain this SIGMET in simple terms. What's the significant weather warning? ";
                break;
            default:
                prompt = "Explain this weather report in simple terms: ";
        }

        if (!process.env.GROQ_API_KEY) {
            console.error('GROQ_API_KEY is not set in environment variables');
            return `Plain English summary temporarily unavailable (API key missing)`;
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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

app.get('/api/weather', async (req, res) => {
    const { route } = req.query;
    
    if (!route) {
        return res.status(400).json({ 
            error: 'Route parameter is required',
            details: 'Please provide a valid flight plan in the format: KPHX,10000,VIDP,1000'
        });
    }

    try {
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

        const results = {
            metar: [],
            taf: [],
            pirep: [],
            sigmet: [],
            summaries: {
                metar: [],
                taf: [],
                pirep: [],
                sigmet: []
            }
        };

        // Fetch METAR data
        const metarResponse = await fetch(`https://aviationweather.gov/cgi-bin/data/metar.php?ids=${airports.join(',')}&format=raw`);
        if (!metarResponse.ok) {
            throw new Error(`METAR API returned ${metarResponse.status}: ${metarResponse.statusText}`);
        }
        const metarData = await metarResponse.text();
        results.metar = metarData.split('\n').filter(line => line.trim());
        
        // Generate METAR summaries
        for (const metar of results.metar) {
            const summary = await generateSummary(metar, 'METAR');
            results.summaries.metar.push(summary);
        }

        // Fetch TAF data
        const tafResponse = await fetch(`https://aviationweather.gov/cgi-bin/data/taf.php?ids=${airports.join(',')}&format=raw`);
        if (!tafResponse.ok) {
            throw new Error(`TAF API returned ${tafResponse.status}: ${tafResponse.statusText}`);
        }
        const tafData = await tafResponse.text();
        results.taf = tafData.split('\n').filter(line => line.trim());
        
        // Group TAFs by airport for summaries
        const tafsByAirport = {};
        results.taf.forEach(taf => {
            if (taf.length >= 4) {
                const airport = taf.substring(0, 4);
                if (!tafsByAirport[airport]) {
                    tafsByAirport[airport] = [];
                }
                tafsByAirport[airport].push(taf);
            }
        });

        // Generate TAF summaries
        for (const airport in tafsByAirport) {
            const summary = await generateSummary(tafsByAirport[airport], 'TAF');
            results.summaries.taf.push({
                airport,
                summary
            });
        }

        // Fetch PIREP data
        try {
            const pirepResponse = await fetch('https://aviationweather.gov/cgi-bin/data/pirep.php?format=raw');
            if (!pirepResponse.ok) {
                throw new Error(`PIREP API returned ${pirepResponse.status}: ${pirepResponse.statusText}`);
            }
            const pirepData = await pirepResponse.text();
            const pirepLines = pirepData.split('\n').filter(line => line.trim());
            
            // Filter PIREPs relevant to our route
            results.pirep = pirepLines.filter(line => {
                const isRelevant = airports.some(airport => {
                    if (line.includes(airport)) {
                        return true;
                    }
                    
                    const fixMatch = line.match(/\/OV ([A-Z]{2,3})(\d{2,3})(\d{2,3})/);
                    if (fixMatch) {
                        const fix = fixMatch[1];
                        return airports.some(ap => ap.startsWith(fix));
                    }
                    
                    return false;
                });
                return isRelevant;
            });

            // Generate PIREP summaries
            for (const pirep of results.pirep) {
                const summary = await generateSummary(pirep, 'PIREP');
                results.summaries.pirep.push(summary);
            }
        } catch (error) {
            console.error('Error fetching PIREP data:', error);
            results.pirep = [];
        }

        // Fetch SIGMET data (domestic and international)
        try {
            const domesticSigmetResponse = await fetch('https://aviationweather.gov/api/data/airsigmet?format=raw');
            if (!domesticSigmetResponse.ok) {
                throw new Error(`Failed to fetch domestic SIGMET data: ${domesticSigmetResponse.status} ${domesticSigmetResponse.statusText}`);
            }
            const domesticSigmetData = await domesticSigmetResponse.text();
            
            const intlSigmetResponse = await fetch('https://aviationweather.gov/api/data/isigmet?format=raw');
            if (!intlSigmetResponse.ok) {
                throw new Error(`Failed to fetch international SIGMET data: ${intlSigmetResponse.status} ${intlSigmetResponse.statusText}`);
            }
            const intlSigmetData = await intlSigmetResponse.text();
            
            // Process domestic SIGMETs
            const domesticSigmets = domesticSigmetData.split('\n').filter(line => {
                const trimmedLine = line.trim();
                return trimmedLine && !trimmedLine.startsWith('Type:') && !trimmedLine.startsWith('---');
            });

            // Process international SIGMETs
            const intlSigmets = intlSigmetData.split('\n').filter(line => {
                const trimmedLine = line.trim();
                return trimmedLine && !trimmedLine.startsWith('Type:') && !trimmedLine.startsWith('---');
            });

            // Filter SIGMETs relevant to our route
            results.sigmet = [...domesticSigmets, ...intlSigmets].filter(sigmet => {
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

            // Generate SIGMET summaries
            for (const sigmet of results.sigmet) {
                const summary = await generateSummary(sigmet, 'SIGMET');
                results.summaries.sigmet.push(summary);
            }
        } catch (error) {
            console.error('Error fetching SIGMET data:', error);
            results.sigmet = [];
        }

        res.json(results);
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

        // Check if we have any data to summarize
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

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
        console.error('Error generating consolidated summary:', error);
        return `Summary temporarily unavailable (${error.message})`;
    }
}

// Add endpoint for consolidated summary
app.get('/api/consolidated-summary', async (req, res) => {
    const { route } = req.query;
    
    if (!route) {
        return res.status(400).json({ 
            error: 'Route parameter is required',
            details: 'Please provide a valid flight plan in the format: KPHX,10000,VIDP,1000'
        });
    }

    try {
        const routeParts = route.split(',');
        if (routeParts.length % 2 !== 0) {
            return res.status(400).json({ 
                error: 'Invalid route format',
                details: 'Route must contain pairs of airport codes and altitudes'
            });
        }

        // Parse and validate waypoints
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
                    details: `Altitude "${routeParts[i+1]}" is invalid. Must be a number between 0 and 60000 feet.`
                });
            }
            
            waypoints.push({ icao, altitude });
            airports.push(icao);
        }

        // Fetch weather data for the route
        const weatherData = {
            metar: [],
            taf: [],
            pirep: [],
            sigmet: []
        };

        // Fetch METARs
        try {
            const metarResponse = await fetch(`https://aviationweather.gov/cgi-bin/data/metar.php?ids=${airports.join(',')}&format=raw`);
            if (metarResponse.ok) {
                const metarData = await metarResponse.text();
                weatherData.metar = metarData.split('\n').filter(line => line.trim());
            } else {
                console.error(`Failed to fetch METAR data: ${metarResponse.status} ${metarResponse.statusText}`);
            }
        } catch (error) {
            console.error('Error fetching METAR data:', error);
        }

        // Fetch TAFs
        try {
            const tafResponse = await fetch(`https://aviationweather.gov/cgi-bin/data/taf.php?ids=${airports.join(',')}&format=raw`);
            if (tafResponse.ok) {
                const tafData = await tafResponse.text();
                weatherData.taf = tafData.split('\n').filter(line => line.trim());
            } else {
                console.error(`Failed to fetch TAF data: ${tafResponse.status} ${tafResponse.statusText}`);
            }
        } catch (error) {
            console.error('Error fetching TAF data:', error);
        }

        // Fetch PIREPs - using a more reliable endpoint
        try {
            const pirepResponse = await fetch('https://aviationweather.gov/cgi-bin/data/pirep.php?format=raw');
            if (pirepResponse.ok) {
                const pirepData = await pirepResponse.text();
                const pirepLines = pirepData.split('\n').filter(line => line.trim());
                
                // Filter PIREPs relevant to our route
                weatherData.pirep = pirepLines.filter(line => {
                    return airports.some(airport => {
                        if (line.includes(airport)) {
                            return true;
                        }
                        
                        const fixMatch = line.match(/\/OV ([A-Z]{2,3})(\d{2,3})(\d{2,3})/);
                        if (fixMatch) {
                            const fix = fixMatch[1];
                            return airports.some(ap => ap.startsWith(fix));
                        }
                        
                        return false;
                    });
                });
            } else {
                console.error(`Failed to fetch PIREP data: ${pirepResponse.status} ${pirepResponse.statusText}`);
            }
        } catch (error) {
            console.error('Error fetching PIREP data:', error);
        }

        // Fetch SIGMETs - using both domestic and international endpoints
        try {
            // Domestic SIGMETs/AIRMETs
            const domesticSigmetResponse = await fetch('https://aviationweather.gov/api/data/airsigmet?format=raw');
            if (domesticSigmetResponse.ok) {
                const domesticSigmetData = await domesticSigmetResponse.text();
                const domesticSigmets = domesticSigmetData.split('\n').filter(line => {
                    const trimmedLine = line.trim();
                    return trimmedLine && !trimmedLine.startsWith('Type:') && !trimmedLine.startsWith('---');
                });
                weatherData.sigmet.push(...domesticSigmets);
            } else {
                console.error(`Failed to fetch domestic SIGMET data: ${domesticSigmetResponse.status} ${domesticSigmetResponse.statusText}`);
            }
            
            // International SIGMETs
            const intlSigmetResponse = await fetch('https://aviationweather.gov/api/data/isigmet?format=raw');
            if (intlSigmetResponse.ok) {
                const intlSigmetData = await intlSigmetResponse.text();
                const intlSigmets = intlSigmetData.split('\n').filter(line => {
                    const trimmedLine = line.trim();
                    return trimmedLine && !trimmedLine.startsWith('Type:') && !trimmedLine.startsWith('---');
                });
                weatherData.sigmet.push(...intlSigmets);
            } else {
                console.error(`Failed to fetch international SIGMET data: ${intlSigmetResponse.status} ${intlSigmetResponse.statusText}`);
            }
            
            // Filter SIGMETs relevant to our route
            weatherData.sigmet = weatherData.sigmet.filter(sigmet => {
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
        } catch (error) {
            console.error('Error fetching SIGMET data:', error);
        }

        // Generate the consolidated summary
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
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});