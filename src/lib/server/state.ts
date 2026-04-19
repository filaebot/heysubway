// Server-side long-lived state: polls all MTA realtime feeds on an interval,
// holds the latest snapshot, exposes it to route handlers.

import { POLL_INTERVAL_MS } from '$lib/constants';
import { pollAllFeeds } from '$lib/mta/realtime';
import { NEARBY_STATIONS } from '$lib/mta/stations';
import type { AppState } from '$lib/types';
import { USER_LOCATION } from '$lib/constants';

let state: AppState = {
	updatedAt: 0,
	userLocation: USER_LOCATION,
	stations: NEARBY_STATIONS,
	inbound: [],
	errors: ['not yet polled']
};

let started = false;
let timer: NodeJS.Timeout | null = null;

async function tick() {
	try {
		const { inbound, errors } = await pollAllFeeds(NEARBY_STATIONS);
		state = {
			updatedAt: Date.now(),
			userLocation: USER_LOCATION,
			stations: NEARBY_STATIONS,
			inbound,
			errors
		};
	} catch (e) {
		state = {
			...state,
			updatedAt: Date.now(),
			errors: [`poll crashed: ${e instanceof Error ? e.message : String(e)}`]
		};
	}
}

export function startPolling(): void {
	if (started) return;
	started = true;
	console.log(`[state] starting poll loop every ${POLL_INTERVAL_MS}ms across ${NEARBY_STATIONS.length} stations`);
	tick();
	timer = setInterval(tick, POLL_INTERVAL_MS);
}

export function stopPolling(): void {
	if (timer) clearInterval(timer);
	timer = null;
	started = false;
}

export function getState(): AppState {
	return state;
}
