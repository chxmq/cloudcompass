require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Validate environment variables
const requiredEnvVars = ['GROQ_API_KEY', 'MAPBOX_ACCESS_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/config', (req, res) => {
    res.json({
        mapboxToken: process.env.MAPBOX_ACCESS_TOKEN
    });
});

// Static files should be served after API routes
app.use(express.static(path.join(__dirname, 'public')));

async function generateSummary(data, type) {
    try {
        if (!data || (Array.isArray(data) && data.length === 0)) {
            return "No data available to summarize.";
        }

        if (type === 'TAF' && Array.isArray(data)) {
            data = data.join('\n');
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
                    content: "You are a helpful weather interpreter. Provide clear, simple explanations of aviation weather reports in plain English. No technical jargon unless necessary. Keep responses concise and focused on the most important information for pilots."
                }, {
                    role: "user",
                    content: `${prompt}\n\n${data}`
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
        if (routeParts.length < 2 || routeParts.length % 2 !== 0) {
            return res.status(400).json({ 
                error: 'Invalid route format',
                details: 'Route must contain pairs of airport codes and altitudes'
            });
        }

        const airports = [];
        for (let i = 0; i < routeParts.length; i += 2) {
            const airport = routeParts[i].trim().toUpperCase();
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

        // Fetch and process METAR data
        try {
            const metarResponse = await fetch(`https://aviationweather.gov/cgi-bin/data/metar.php?ids=${airports.join(',')}&format=raw`);
            if (!metarResponse.ok) {
                throw new Error(`METAR API returned ${metarResponse.status}: ${metarResponse.statusText}`);
            }
            const metarData = await metarResponse.text();
            results.metar = metarData.split('\n').filter(line => line.trim());
            
            for (const metar of results.metar) {
                const summary = await generateSummary(metar, 'METAR');
                results.summaries.metar.push({
                    raw: metar,
                    summary
                });
            }
        } catch (error) {
            console.error('Error fetching METAR data:', error);
            results.metar = [];
            results.summaries.metar = [{
                summary: `Failed to fetch METAR data: ${error.message}`
            }];
        }

        // Fetch and process TAF data
        try {
            const tafResponse = await fetch(`https://aviationweather.gov/cgi-bin/data/taf.php?ids=${airports.join(',')}&format=raw`);
            if (!tafResponse.ok) {
                throw new Error(`TAF API returned ${tafResponse.status}: ${tafResponse.statusText}`);
            }
            const tafData = await tafResponse.text();
            results.taf = tafData.split('\n').filter(line => line.trim());
            
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

            results.summaries.taf = [];
            for (const airport in tafsByAirport) {
                const summary = await generateSummary(tafsByAirport[airport], 'TAF');
                results.summaries.taf.push({
                    airport,
                    raw: tafsByAirport[airport],
                    summary
                });
            }
        } catch (error) {
            console.error('Error fetching TAF data:', error);
            results.taf = [];
            results.summaries.taf = [{
                summary: `Failed to fetch TAF data: ${error.message}`
            }];
        }

        // Fetch and process PIREP data
        try {
            const pirepResponse = await fetch('https://aviationweather.gov/cgi-bin/data/pirep.php?format=raw');
            if (!pirepResponse.ok) {
                throw new Error(`PIREP API returned ${pirepResponse.status}: ${pirepResponse.statusText}`);
            }
            const pirepData = await pirepResponse.text();
            const pirepLines = pirepData.split('\n').filter(line => line.trim());
            
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

            for (const pirep of results.pirep) {
                const summary = await generateSummary(pirep, 'PIREP');
                results.summaries.pirep.push({
                    raw: pirep,
                    summary
                });
            }
        } catch (error) {
            console.error('Error fetching PIREP data:', error);
            results.pirep = [];
            results.summaries.pirep = [{
                summary: `Failed to fetch PIREP data: ${error.message}`
            }];
        }

        // Fetch and process SIGMET data
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
            
            const domesticSigmets = domesticSigmetData.split('\n').filter(line => {
                const trimmedLine = line.trim();
                return trimmedLine && !trimmedLine.startsWith('Type:') && !trimmedLine.startsWith('---');
            });

            const intlSigmets = intlSigmetData.split('\n').filter(line => {
                const trimmedLine = line.trim();
                return trimmedLine && !trimmedLine.startsWith('Type:') && !trimmedLine.startsWith('---');
            });

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
                        return true; // This is too broad - should add better lat/lon relevance checking
                    }

                    const firMatch = sigmet.match(/([A-Z]{4}) FIR/);
                    if (firMatch) {
                        return airports.some(ap => ap.startsWith(firMatch[1]));
                    }

                    return false;
                });
            });

            for (const sigmet of results.sigmet) {
                const summary = await generateSummary(sigmet, 'SIGMET');
                results.summaries.sigmet.push({
                    raw: sigmet,
                    summary
                });
            }
        } catch (error) {
            console.error('Error fetching SIGMET data:', error);
            results.sigmet = [];
            results.summaries.sigmet = [{
                summary: `Failed to fetch SIGMET data: ${error.message}`
            }];
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    });
});

// Catch-all route for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});