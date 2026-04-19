// GTFS-Realtime poller. Fetches every MTA subway feed, parses protobuf trip
// updates, filters stop_time_updates to our nearby stations, converts to
// InboundTrain records with walking-time + leave-by derivation.

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { MTA_REALTIME_FEEDS, DEPARTED_GRACE_SEC } from '$lib/constants';
import type { InboundTrain, Station, DirectionCode } from '$lib/types';
import { NEARBY_STATIONS, ROUTE_TERMINUS, ROUTE_BOROUGH } from './stations';

const { transit_realtime } = GtfsRealtimeBindings;

// Build a stopId → Station lookup including both parent + platform-level ids.
// MTA realtime trip updates reference platform-level stop_ids (e.g. "G34N"),
// but we expose parents ("G34") in Station. The platform id's trailing
// N/S indicates direction, which we preserve.
function buildStopIdIndex(stations: Station[]): Map<string, { station: Station; direction: DirectionCode }> {
	const idx = new Map<string, { station: Station; direction: DirectionCode }>();
	for (const s of stations) {
		idx.set(`${s.stopId}N`, { station: s, direction: 'N' });
		idx.set(`${s.stopId}S`, { station: s, direction: 'S' });
	}
	return idx;
}

async function fetchFeed(url: string): Promise<Buffer | null> {
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'heysubway/0.1 (+https://heysubway.filae.site)' }
		});
		if (!res.ok) {
			console.warn(`[realtime] ${url} HTTP ${res.status}`);
			return null;
		}
		return Buffer.from(await res.arrayBuffer());
	} catch (e) {
		console.warn(`[realtime] ${url} fetch failed`, e);
		return null;
	}
}

function decodeFeed(buf: Buffer): GtfsRealtimeBindings.transit_realtime.FeedMessage | null {
	try {
		return transit_realtime.FeedMessage.decode(new Uint8Array(buf));
	} catch (e) {
		console.warn('[realtime] decode failed', e);
		return null;
	}
}

function directionLabel(route: string, direction: DirectionCode): { terminus: string; borough: string; label: string } {
	const term = ROUTE_TERMINUS[route]?.[direction] ?? (direction === 'N' ? 'Northbound' : 'Southbound');
	const bor = ROUTE_BOROUGH[route]?.[direction] ?? (direction === 'N' ? 'Manhattan' : 'Brooklyn');
	const label = `→ ${bor} · ${term}-bound`;
	return { terminus: term, borough: bor, label };
}

export async function pollAllFeeds(stations: Station[] = NEARBY_STATIONS): Promise<{ inbound: InboundTrain[]; errors: string[] }> {
	const errors: string[] = [];
	if (stations.length === 0) {
		return { inbound: [], errors: ['no nearby stations loaded — run `npm run fetch-stations`'] };
	}
	const stopIdx = buildStopIdIndex(stations);
	const nowSec = Date.now() / 1000;

	const urls = Object.entries(MTA_REALTIME_FEEDS);
	const bufs = await Promise.all(urls.map(([, url]) => fetchFeed(url)));

	const inbound: InboundTrain[] = [];

	for (let i = 0; i < urls.length; i++) {
		const [name] = urls[i];
		const buf = bufs[i];
		if (!buf) {
			errors.push(`feed ${name} unreachable`);
			continue;
		}
		const feed = decodeFeed(buf);
		if (!feed) {
			errors.push(`feed ${name} decode failed`);
			continue;
		}

		for (const entity of feed.entity) {
			const tu = entity.tripUpdate;
			if (!tu) continue;
			const route = tu.trip?.routeId ?? '';
			const tripId = tu.trip?.tripId ?? '';
			if (!tu.stopTimeUpdate) continue;

			for (const stu of tu.stopTimeUpdate) {
				const stopId = stu.stopId ?? '';
				const match = stopIdx.get(stopId);
				if (!match) continue;

				// Prefer arrival time; fall back to departure if arrival missing.
				const arr = Number(stu.arrival?.time ?? 0);
				const dep = Number(stu.departure?.time ?? 0);
				const whenSec = arr > 0 ? arr : dep;
				if (!whenSec) continue;
				const etaSec = whenSec - nowSec;

				// Filter out trains that have already arrived/departed.
				if (etaSec < -DEPARTED_GRACE_SEC) continue;

				const { terminus, borough, label } = directionLabel(route, match.direction);
				const walkSec = match.station.walkSeconds;
				const leaveBy = etaSec - walkSec;

				inbound.push({
					stationId: match.station.stopId,
					stationName: match.station.name,
					line: route,
					direction: match.direction,
					directionLabel: label,
					borough,
					terminus,
					etaSec,
					walkSec,
					leaveBySec: leaveBy,
					missable: leaveBy < 0,
					tripId
				});
			}
		}
	}

	// Sort soonest ETA first.
	inbound.sort((a, b) => a.etaSec - b.etaSec);
	return { inbound, errors };
}
