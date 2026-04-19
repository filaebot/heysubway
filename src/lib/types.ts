// MTA GTFS static — a physical station (parent_station row in stops.txt)
// or a physical complex composed of multiple parent stations that share a
// street address and transfer (e.g. 4 Av-9 St, where R33 BMT + F23 IND
// share a name but live on different platforms with different walk times).
export interface Station {
	stopId: string; // primary parent id used for display + keying (e.g. "R33")
	// Platform-level parent ids that roll up into this station. Defaults to
	// [stopId] when not set. For a single-parent station, equivalent to
	// just stopId. For a complex, lists every parent that feeds in.
	stopIds?: string[];
	name: string;
	lat: number;
	lon: number;
	distanceMeters: number; // closest entrance from USER_LOCATION (meters)
	walkSeconds: number; // closest entrance walk time (seconds)
	// Lines (route_ids) served by this station. Used for display AND as a
	// whitelist — realtime trips with route_id not in this list are dropped
	// even if they appear in the feed for a matching stop_id. This filters
	// out GTFS scheduled diversions (e.g. late-night D at BMT 9 St) that
	// don't reflect normal service.
	lines: string[];
	// Per-route walk-time override. Keyed by route_id. When a complex has
	// physically separate platforms (BMT vs IND at 4 Av-9 St), the R uses
	// one entrance and F/G use a different entrance 400m away — each
	// line's walk time differs. Missing keys fall back to walkSeconds.
	walkByRoute?: Record<string, number>;
	distanceByRoute?: Record<string, number>;
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
