const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    const { route } = event.queryStringParameters;
    
    if (!route) {
        return {
            statusCode: 400,
            body: JSON.stringify({ 
                error: 'Route parameter is required',
                details: 'Please provide a valid flight plan in the format: KPHX,10000,VIDP,1000'
            })
        };
    }

    try {
        const routeParts = route.split(',');
        if (routeParts.length % 2 !== 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Invalid route format',
                    details: 'Route must contain pairs of airport codes and altitudes'
                })
            };
        }

        const airports = [];
        for (let i = 0; i < routeParts.length; i += 2) {
            const airport = routeParts[i].trim();
            if (!airport || !/^[A-Z]{3,4}$/.test(airport)) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        error: 'Invalid airport code',
                        details: `Airport code "${airport}" is invalid. Must be 3-4 uppercase letters.`
                    })
                };
            }
            airports.push(airport);
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

        const metarResponse = await fetch(`https://aviationweather.gov/cgi-bin/data/metar.php?ids=${airports.join(',')}&format=raw`);
        const metarData = await metarResponse.text();
        results.metar = metarData.split('\n').filter(line => line.trim());

        const tafResponse = await fetch(`https://aviationweather.gov/cgi-bin/data/taf.php?ids=${airports.join(',')}&format=raw`);
        const tafData = await tafResponse.text();
        results.taf = tafData.split('\n').filter(line => line.trim());

        // Add other weather data fetching here...

        return {
            statusCode: 200,
            body: JSON.stringify(results)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
}; 