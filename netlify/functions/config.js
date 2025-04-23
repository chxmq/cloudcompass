exports.handler = async function(event, context) {
    const mapboxConfig = {
        token: process.env.MAPBOX_ACCESS_TOKEN,
        style: process.env.MAPBOX_STYLE || 'mapbox://styles/mapbox/outdoors-v12',
        center: process.env.MAPBOX_CENTER ? JSON.parse(process.env.MAPBOX_CENTER) : [-98.5795, 39.8283],
        zoom: process.env.MAPBOX_ZOOM ? parseInt(process.env.MAPBOX_ZOOM) : 4
    };

    if (!mapboxConfig.token) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Mapbox configuration not available' })
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify(mapboxConfig)
    };
}; 