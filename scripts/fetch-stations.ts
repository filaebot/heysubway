// Fetch the MTA GTFS static zip, extract stops.txt + routes.txt + trips.txt +
// stop_times.txt, filter to parent stations within 0.5mi of USER_LOCATION,
// and emit src/lib/mta/stations.ts with populated NEARBY_STATIONS +
// ROUTE_TERMINUS + ROUTE_BOROUGH tables.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import {
	USER_LOCATION,
	NEARBY_RADIUS_M,
	MTA_GTFS_STATIC_URL,
	WALK_SPEED_MPS
} from '../src/lib/constants.ts';
import { haversineMeters, walkingSeconds } from '../src/lib/geo.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'data', 'gtfs-cache');
const ZIP_PATH = join(CACHE_DIR, 'google_transit.zip');

mkdirSync(CACHE_DIR, { recursive: true });

// Fallback URLs — MTA moved the canonical zip a few times. Try in order.
const STATIC_URLS = [
	MTA_GTFS_STATIC_URL,
	'https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip'
];

async function downloadZip(): Promise<Buffer> {
	for (const url of STATIC_URLS) {
		console.log(`[fetch-stations] trying ${url}`);
		try {
			const res = await fetch(url);
			if (!res.ok) {
				console.warn(`  HTTP ${res.status}`);
				continue;
			}
			const buf = Buffer.from(await res.arrayBuffer());
			writeFileSync(ZIP_PATH, buf);
			console.log(`[fetch-stations] wrote ${ZIP_PATH} (${buf.length} bytes)`);
			return buf;
		} catch (e) {
			console.warn('  fetch failed', e instanceof Error ? e.message : e);
		}
	}
	throw new Error('all GTFS static URLs failed');
}

function readCsv<T = Record<string, string>>(zip: AdmZip, name: string): T[] {
	const entry = zip.getEntry(name);
	if (!entry) throw new Error(`entry ${name} not found in zip`);
	const text = entry.getData().toString('utf8');
	return parse(text, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true,
		relax_column_count: true
	}) as T[];
}

type StopRow = {
	stop_id: string;
	stop_name: string;
	stop_lat: string;
	stop_lon: string;
	location_type: string;
	parent_station: string;
};
type StopTimeRow = { trip_id: string; stop_id: string; stop_sequence: string };
type TripRow = { trip_id: string; route_id: string; direction_id: string };
type RouteRow = { route_id: string };

// Known subway terminus → borough. Exhaustive enough for NYCT termini; the
// lat/lon heuristic falls back for anything unlisted. Hand-curated because
// bounding-box geometry misclassifies edge cases like Court Sq (Queens,
// -73.944 lon) vs Manhattan, and Broad Channel (Queens, far south).
const TERMINUS_BOROUGH: Record<string, string> = {
	'Van Cortlandt Park-242 St': 'Bronx',
	'Wakefield-241 St': 'Bronx',
	'Harlem-148 St': 'Manhattan',
	'Woodlawn': 'Bronx',
	'Eastchester-Dyre Av': 'Bronx',
	'Pelham Bay Park': 'Bronx',
	'Norwood-205 St': 'Bronx',
	'Bedford Park Blvd': 'Bronx',
	'South Ferry': 'Manhattan',
	'Flatbush Av-Brooklyn College': 'Brooklyn',
	'34 St-Penn Station': 'Manhattan',
	'New Lots Av': 'Brooklyn',
	'E 180 St': 'Bronx',
	'Brooklyn Bridge-City Hall': 'Manhattan',
	'Flushing-Main St': 'Queens',
	'34 St-Hudson Yards': 'Manhattan',
	'Times Sq-42 St': 'Manhattan',
	'Grand Central-42 St': 'Manhattan',
	'Euclid Av': 'Brooklyn',
	'Far Rockaway-Mott Av': 'Queens',
	'Ozone Park-Lefferts Blvd': 'Queens',
	'Rockaway Park-Beach 116 St': 'Queens',
	'Brighton Beach': 'Brooklyn',
	'168 St': 'Manhattan',
	'World Trade Center': 'Manhattan',
	'Jamaica-179 St': 'Queens',
	'Coney Island-Stillwell Av': 'Brooklyn',
	'Franklin Av': 'Brooklyn',
	'Prospect Park': 'Brooklyn',
	'Court Sq': 'Queens',
	'Church Av': 'Brooklyn',
	'Broad Channel': 'Queens',
	'8 Av': 'Manhattan',
	'Canarsie-Rockaway Pkwy': 'Brooklyn',
	'Myrtle Av': 'Brooklyn',
	'Middle Village-Metropolitan Av': 'Queens',
	'Astoria-Ditmars Blvd': 'Queens',
	'Forest Hills-71 Av': 'Queens',
	'Jamaica Center-Parsons/Archer': 'Queens',
	'Broad St': 'Manhattan',
	'96 St': 'Manhattan',
	'Whitehall St-South Ferry': 'Manhattan',
	'Bay Ridge-95 St': 'Brooklyn',
	'St George': 'Staten Island',
	'Tottenville': 'Staten Island'
};

// Lat/lon bbox fallback for unknown stations. Kept as a fallback only; most
// termini are resolved by the table above.
function boroughFromLatLon(lat: number, lon: number): string {
	if (lat > 40.79 && lon > -73.93) return 'Bronx';
	if (lon > -73.94) return 'Queens';
	if (lat >= 40.7 && lon <= -73.92 && lon >= -74.02) return 'Manhattan';
	if (lat < 40.65 && lon < -74.05) return 'Staten Island';
	return 'Brooklyn';
}

async function main() {
	await downloadZip();
	const zip = new AdmZip(ZIP_PATH);

	console.log('[fetch-stations] parsing stops.txt');
	const stops = readCsv<StopRow>(zip, 'stops.txt');
	console.log('[fetch-stations] parsing trips.txt');
	const trips = readCsv<TripRow>(zip, 'trips.txt');
	console.log('[fetch-stations] parsing routes.txt');
	const routes = readCsv<RouteRow>(zip, 'routes.txt');
	console.log('[fetch-stations] parsing stop_times.txt (large)');
	const stopTimes = readCsv<StopTimeRow>(zip, 'stop_times.txt');

	// Parent stations within radius.
	const parents = stops.filter((s) => s.location_type === '1');
	const nearby = parents
		.map((s) => {
			const lat = parseFloat(s.stop_lat);
			const lon = parseFloat(s.stop_lon);
			const dist = haversineMeters(USER_LOCATION, { lat, lon });
			return { stopId: s.stop_id, name: s.stop_name, lat, lon, distanceMeters: dist };
		})
		.filter((s) => s.distanceMeters <= NEARBY_RADIUS_M)
		.sort((a, b) => a.distanceMeters - b.distanceMeters);

	console.log(`[fetch-stations] ${nearby.length} parent stations within ${NEARBY_RADIUS_M.toFixed(0)}m:`);
	for (const s of nearby) console.log(`  ${s.stopId} ${s.name} (${s.distanceMeters.toFixed(0)}m)`);

	// Platform → parent index.
	const parentByPlatform = new Map<string, string>();
	for (const s of stops) {
		if (s.parent_station) parentByPlatform.set(s.stop_id, s.parent_station);
	}

	// trip_id → route_id.
	const tripRoute = new Map<string, string>();
	for (const t of trips) tripRoute.set(t.trip_id, t.route_id);

	// Collect routes serving each parent.
	const linesByParent = new Map<string, Set<string>>();
	// Also collect stop_times per trip for terminus derivation.
	const stopsByTrip = new Map<string, StopTimeRow[]>();

	for (const st of stopTimes) {
		const parent = parentByPlatform.get(st.stop_id);
		if (parent) {
			const route = tripRoute.get(st.trip_id);
			if (route) {
				if (!linesByParent.has(parent)) linesByParent.set(parent, new Set());
				linesByParent.get(parent)!.add(route);
			}
		}
		if (!stopsByTrip.has(st.trip_id)) stopsByTrip.set(st.trip_id, []);
		stopsByTrip.get(st.trip_id)!.push(st);
	}

	const stationsOut = nearby.map((s) => {
		const walk = walkingSeconds(s.distanceMeters, WALK_SPEED_MPS);
		const lineSet = linesByParent.get(s.stopId) ?? new Set<string>();
		return {
			stopId: s.stopId,
			name: s.name,
			lat: s.lat,
			lon: s.lon,
			distanceMeters: Math.round(s.distanceMeters),
			walkSeconds: Math.round(walk),
			lines: Array.from(lineSet).sort()
		};
	});

	// Determine terminus per route × direction. Representative trip's last stop.
	const parentInfo = new Map<string, { lat: number; lon: number; name: string }>();
	for (const s of stops) {
		if (s.location_type === '1') {
			parentInfo.set(s.stop_id, {
				lat: parseFloat(s.stop_lat),
				lon: parseFloat(s.stop_lon),
				name: s.stop_name
			});
		}
	}

	// Derive terminus per route × direction from stop_id suffix, not direction_id.
	// NYCT realtime stop_ids are suffixed N (northbound platform) or S (southbound
	// platform). A trip's LAST stop tells us where it terminates — if that last
	// stop_id ends in 'N', the trip is northbound and its terminus is what
	// appears under the app's 'N' column. Using direction_id is fragile because
	// the 0/1 mapping to N/S is not consistent across routes in every GTFS
	// release. Suffix-driven is what the realtime feed actually uses too,
	// so this stays consistent with how we match trips to stations.
	const terminusByRoute = new Map<
		string,
		{
			N: string;
			S: string;
			N_coords?: { lat: number; lon: number };
			S_coords?: { lat: number; lon: number };
		}
	>();
	const tripsByRoute = new Map<string, TripRow[]>();
	for (const t of trips) {
		if (!tripsByRoute.has(t.route_id)) tripsByRoute.set(t.route_id, []);
		tripsByRoute.get(t.route_id)!.push(t);
	}
	for (const [routeId, tripList] of tripsByRoute) {
		// Count last-stop frequencies per direction (suffix), then pick the mode.
		// Picking the first-encountered is misleading because short-turn service
		// patterns (e.g. R short-turning at Whitehall on nights) are real but
		// rare — we want the most common terminus, not the first we see.
		const countsN = new Map<string, number>();
		const countsS = new Map<string, number>();
		for (const t of tripList) {
			const sts = stopsByTrip.get(t.trip_id);
			if (!sts || sts.length === 0) continue;
			const sorted = sts.slice().sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
			const last = sorted[sorted.length - 1];
			const suffix = last.stop_id.slice(-1);
			const counts = suffix === 'N' ? countsN : suffix === 'S' ? countsS : null;
			if (!counts) continue;
			counts.set(last.stop_id, (counts.get(last.stop_id) ?? 0) + 1);
		}
		const pickMode = (counts: Map<string, number>): string | undefined => {
			let best: string | undefined;
			let bestCount = 0;
			for (const [id, n] of counts) {
				if (n > bestCount) {
					best = id;
					bestCount = n;
				}
			}
			return best;
		};
		const modeN = pickMode(countsN);
		const modeS = pickMode(countsS);
		const term: { N: string; S: string; N_coords?: any; S_coords?: any } = { N: '', S: '' };
		for (const [d, mode] of [
			['N', modeN],
			['S', modeS]
		] as const) {
			if (!mode) continue;
			const parent = parentByPlatform.get(mode) ?? mode;
			const info = parentInfo.get(parent);
			const name = info?.name ?? mode;
			if (d === 'N') {
				term.N = name;
				term.N_coords = info ? { lat: info.lat, lon: info.lon } : undefined;
			} else {
				term.S = name;
				term.S_coords = info ? { lat: info.lat, lon: info.lon } : undefined;
			}
		}
		terminusByRoute.set(routeId, term);
	}

	const terminusOut: Record<string, { N: string; S: string }> = {};
	const boroughOut: Record<string, { N: string; S: string }> = {};
	const resolveBorough = (name: string, coords: { lat: number; lon: number } | undefined, fallback: string) => {
		if (name in TERMINUS_BOROUGH) return TERMINUS_BOROUGH[name];
		if (coords) return boroughFromLatLon(coords.lat, coords.lon);
		return fallback;
	};
	for (const [routeId, term] of terminusByRoute) {
		terminusOut[routeId] = { N: term.N, S: term.S };
		boroughOut[routeId] = {
			N: resolveBorough(term.N, term.N_coords, 'Manhattan'),
			S: resolveBorough(term.S, term.S_coords, 'Brooklyn')
		};
	}

	const outPath = join(ROOT, 'src', 'lib', 'mta', 'stations.ts');
	const banner = `// AUTO-GENERATED by scripts/fetch-stations.ts. Do not hand-edit — re-run
// \`npm run fetch-stations\` after MTA schedule changes.
`;
	const body = `${banner}
import type { Station } from '$lib/types';

export const NEARBY_STATIONS: Station[] = ${JSON.stringify(stationsOut, null, '\t')};

export const ROUTE_TERMINUS: Record<string, { N: string; S: string }> = ${JSON.stringify(terminusOut, null, '\t')};

export const ROUTE_BOROUGH: Record<string, { N: string; S: string }> = ${JSON.stringify(boroughOut, null, '\t')};
`;
	writeFileSync(outPath, body);
	console.log(`[fetch-stations] wrote ${outPath}: ${stationsOut.length} stations, ${Object.keys(terminusOut).length} routes`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
