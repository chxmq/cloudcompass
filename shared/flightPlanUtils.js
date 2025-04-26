// Shared flight-plan parsing/validation, used by both server.js (Node) and script.js (browser).
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.FlightPlanUtils = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    const ICAO_PATTERN = /^[A-Z]{3,4}$/;
    const MIN_ALTITUDE = 0;
    const MAX_ALTITUDE = 60000;

    class FlightPlanError extends Error {}

    // Parses "KPHX,1500,KLAX,50" into [{icao, altitude}, ...]. Throws FlightPlanError with a
    // user-facing message on the first invalid token so client and server report identical errors.
    function parseFlightPlan(routeString) {
        if (!routeString || !routeString.trim()) {
            throw new FlightPlanError('Route parameter is required. Please provide a valid flight plan in the format: KPHX,10000,VIDP,1000');
        }

        const parts = routeString.split(',');
        if (parts.length < 2 || parts.length % 2 !== 0) {
            throw new FlightPlanError('Invalid route format. Route must contain pairs of airport codes and altitudes.');
        }

        const waypoints = [];
        for (let i = 0; i < parts.length; i += 2) {
            const icao = parts[i].trim().toUpperCase();
            if (!ICAO_PATTERN.test(icao)) {
                throw new FlightPlanError(`Invalid airport code "${icao}". Must be 3-4 uppercase letters.`);
            }

            const rawAltitude = parts[i + 1].trim();
            const altitude = parseInt(rawAltitude, 10);
            if (Number.isNaN(altitude) || altitude < MIN_ALTITUDE || altitude > MAX_ALTITUDE) {
                throw new FlightPlanError(`Invalid altitude "${rawAltitude}". Must be a number between ${MIN_ALTITUDE} and ${MAX_ALTITUDE} feet.`);
            }

            waypoints.push({ icao, altitude });
        }

        return waypoints;
    }

    return { parseFlightPlan, FlightPlanError, ICAO_PATTERN, MIN_ALTITUDE, MAX_ALTITUDE };
});
