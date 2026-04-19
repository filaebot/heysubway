// MTA GTFS static — a physical station (parent_station row in stops.txt)
// or a platform-level stop (parent_station blank).
export interface Station {
	stopId: string; // e.g. "G34" (parent) or "G34N"/"G34S" (platform)
	name: string;
	lat: number;
	lon: number;
	distanceMeters: number; // from USER_LOCATION
	walkSeconds: number; // haversine / WALK_SPEED_MPS
	// Lines that serve this station (derived from routes + stop_times at build time).
	lines: string[];
}

// Direction derived from stop_id suffix: N/S (northbound/southbound), plus borough heuristic.
export type DirectionCode = 'N' | 'S';

export interface InboundTrain {
	stationId: string; // parent stop_id (e.g. "G34")
	stationName: string;
	line: string; // route_id — '1', '2', 'F', 'G', etc.
	direction: DirectionCode;
	directionLabel: string; // "→ Manhattan · Church Av-bound"
	borough: string; // "Manhattan" | "Brooklyn" | "Queens" | "Bronx" | "Staten Island" | "Terminal"
	terminus: string; // "Church Av", "Jamaica Center", etc.
	etaSec: number; // seconds until train arrives at this stop
	walkSec: number; // seconds to walk to the station from USER_LOCATION
	// Derived: leaveBySec = etaSec - walkSec. Negative → too late to make it.
	leaveBySec: number;
	missable: boolean; // leaveBySec < 0
	tripId: string;
}

export interface AppState {
	updatedAt: number; // ms epoch
	userLocation: { lat: number; lon: number };
	stations: Station[];
	inbound: InboundTrain[];
	errors: string[];
}
