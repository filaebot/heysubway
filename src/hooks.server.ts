// Start the MTA realtime poller once at server boot.
import { startPolling } from '$lib/server/state';

startPolling();

export const handle = async ({ event, resolve }: { event: any; resolve: any }) => {
	return resolve(event);
};
