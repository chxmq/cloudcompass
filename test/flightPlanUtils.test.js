const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFlightPlan, FlightPlanError } = require('../shared/flightPlanUtils');

test('parses a single waypoint', () => {
    assert.deepEqual(parseFlightPlan('KPHX,1500'), [{ icao: 'KPHX', altitude: 1500 }]);
});

test('parses multiple waypoints', () => {
    assert.deepEqual(parseFlightPlan('KPHX,1500,KLAX,50'), [
        { icao: 'KPHX', altitude: 1500 },
        { icao: 'KLAX', altitude: 50 }
    ]);
});

test('trims whitespace and upper-cases airport codes', () => {
    assert.deepEqual(parseFlightPlan(' kphx , 1500 '), [{ icao: 'KPHX', altitude: 1500 }]);
});

test('accepts 3-letter and 4-letter ICAO codes', () => {
    assert.deepEqual(parseFlightPlan('LAX,1000'), [{ icao: 'LAX', altitude: 1000 }]);
});

test('rejects empty input', () => {
    assert.throws(() => parseFlightPlan(''), FlightPlanError);
    assert.throws(() => parseFlightPlan('   '), FlightPlanError);
    assert.throws(() => parseFlightPlan(undefined), FlightPlanError);
});

test('rejects an odd number of fields', () => {
    assert.throws(() => parseFlightPlan('KPHX,1500,KLAX'), FlightPlanError);
});

test('rejects an invalid airport code', () => {
    assert.throws(() => parseFlightPlan('12,1500'), FlightPlanError);
    assert.throws(() => parseFlightPlan('TOOLONG,1500'), FlightPlanError);
});

test('rejects a non-numeric altitude', () => {
    assert.throws(() => parseFlightPlan('KPHX,abc'), FlightPlanError);
});

test('rejects an out-of-range altitude', () => {
    assert.throws(() => parseFlightPlan('KPHX,-1'), FlightPlanError);
    assert.throws(() => parseFlightPlan('KPHX,60001'), FlightPlanError);
});

test('accepts boundary altitudes', () => {
    assert.deepEqual(parseFlightPlan('KPHX,0'), [{ icao: 'KPHX', altitude: 0 }]);
    assert.deepEqual(parseFlightPlan('KPHX,60000'), [{ icao: 'KPHX', altitude: 60000 }]);
});
