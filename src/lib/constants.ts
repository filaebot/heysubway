// User's apartment — reused from heyairplane.
// 40°40'09.78"N 73°59'00.71"W — Brooklyn, near Prospect Park.
export const USER_LOCATION = { lat: 40.6693833, lon: -73.9835306 } as const;

// Station search radius (miles → meters).
export const NEARBY_RADIUS_MI = 0.5;
export const NEARBY_RADIUS_M = NEARBY_RADIUS_MI * 1609.344; // ≈ 804.67m

// Walking speed — comfortable urban pace, ~13 min/km.
// 4.5 km/h = 75 m/min = 1.25 m/s.
export const WALK_SPEED_MPS = 1.25;

// Realtime polling cadence. MTA GTFS-rt updates ~every 30s; 15s is polite + responsive.
export const POLL_INTERVAL_MS = 15_000;

// How long before trains are filtered out. Once ETA <= 0 (train arrived/departed), drop.
// Small negative grace window to account for clock skew between MTA and us.
export const DEPARTED_GRACE_SEC = 30;

// MTA GTFS-Realtime feed endpoints. No API key required as of 2023.
// Source: https://api.mta.info/ (GTFS-Realtime feeds for NYCT Subway)
export const MTA_REALTIME_FEEDS: Record<string, string> = {
	// 1,2,3,4,5,6,7,S (42 St shuttle + GC shuttle) — the numbered lines + 'S' groups
	numbered: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
	ace: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
	bdfm: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
	g: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
	jz: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
	nqrw: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
	l: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',
	sir: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si'
};

// GTFS Static feed (stops/routes). Downloaded once at boot, cached locally.
export const MTA_GTFS_STATIC_URL = 'http://web.mta.info/developers/data/nyct/subway/google_transit.zip';
