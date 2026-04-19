# hey subway

NYC subway real-time for my apartment. Sister app to [heyairplane](https://heyairplane.filae.site).

Shows every MTA subway train that hasn't yet arrived at a station within 0.5mi of my apartment, along with walking time to the station and whether I can still catch it if I leave now.

## Architecture

- SvelteKit + adapter-node, same pattern as heyairplane.
- `scripts/fetch-stations.ts` downloads MTA GTFS static zip, filters parent stations to those within 0.5mi of `USER_LOCATION`, derives line→terminus + borough labels, and writes `src/lib/mta/stations.ts`.
- `src/lib/mta/realtime.ts` polls all MTA GTFS-Realtime feeds every 15s, decodes protobuf, filters stop_time_updates to our nearby stations, converts to `InboundTrain[]` with walking-time + leave-by derivation.
- `src/lib/server/state.ts` holds the latest snapshot; `src/hooks.server.ts` starts the poll loop at server boot.
- `/api/state` returns the snapshot as JSON.
- `src/routes/+page.svelte` renders station groups with live ETA countdown between polls.

## Setup

```bash
npm install
npm run fetch-stations   # populates src/lib/mta/stations.ts with nearby stops
npm run dev              # local dev on :5173
```

## Deploy

Runs on the Mac via launchctl (`com.heysubway.server`), exposed publicly via Cloudflare Tunnel at [heysubway.filae.site](https://heysubway.filae.site).

## Walking model

Simple: haversine distance × 4.5 km/h (1.25 m/s). Straight-line distance under-estimates actual street walking by ~15–25% in most of NYC — future round B would swap in real routing (Mapbox/Google Directions).

## License

Personal project. Public source; no API keys required.
