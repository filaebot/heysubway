// Haversine distance in meters between two lat/lon points.
export function haversineMeters(
	a: { lat: number; lon: number },
	b: { lat: number; lon: number }
): number {
	const R = 6_371_000; // Earth radius (m)
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

// Walking time (seconds) at a fixed pace — haversine distance / speed.
// Approximation: straight-line distance under-estimates true street distance by ~15–25%
// in most of NYC. We keep it simple and document the conservatism.
export function walkingSeconds(distanceMeters: number, speedMps: number): number {
	return distanceMeters / speedMps;
}

// Format a duration in seconds as "Xm" or "Xm Ys" compactly.
export function formatMMSS(totalSec: number): string {
	const s = Math.max(0, Math.round(totalSec));
	const m = Math.floor(s / 60);
	const r = s % 60;
	if (m === 0) return `${r}s`;
	if (r === 0) return `${m}m`;
	return `${m}m ${r}s`;
}
