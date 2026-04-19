import { json } from '@sveltejs/kit';
import { getState } from '$lib/server/state';

export const GET = async () => {
	const state = getState();
	return json(state, {
		headers: {
			'cache-control': 'no-store'
		}
	});
};
