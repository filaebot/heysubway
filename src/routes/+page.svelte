<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { AppState, InboundTrain } from '$lib/types';

	let state: AppState | null = $state(null);
	let nowMs = $state(Date.now());
	let loadErr: string | null = $state(null);
	let poll: ReturnType<typeof setInterval> | null = null;
	let clock: ReturnType<typeof setInterval> | null = null;

	async function refresh() {
		try {
			const res = await fetch('/api/state', { cache: 'no-store' });
			if (!res.ok) {
				loadErr = `HTTP ${res.status}`;
				return;
			}
			state = await res.json();
			loadErr = null;
		} catch (e) {
			loadErr = e instanceof Error ? e.message : String(e);
		}
	}

	onMount(() => {
		refresh();
		poll = setInterval(refresh, 10_000);
		clock = setInterval(() => (nowMs = Date.now()), 1000);
	});

	onDestroy(() => {
		if (poll) clearInterval(poll);
		if (clock) clearInterval(clock);
	});

	// Re-derive ETAs client-side each second using snapshot-age offset so
	// minutes count down smoothly between polls.
	function liveEta(t: InboundTrain) {
		if (!state) return { etaSec: t.etaSec, leaveBySec: t.leaveBySec, missable: t.missable };
		const driftSec = (nowMs - state.updatedAt) / 1000;
		const etaSec = t.etaSec - driftSec;
		const leaveBySec = etaSec - t.walkSec;
		return { etaSec, leaveBySec, missable: leaveBySec < 0 };
	}

	// Countdown-clock style: round down to whole minutes, show "<1 min" for
	// anything under a minute out. Matches real MTA platform displays.
	function minutesLabel(sec: number): string {
		if (sec < 60) return '<1';
		return String(Math.floor(sec / 60));
	}

	// Leave-by label: how much slack you have before you need to leave to
	// walk to the station in time.
	function leaveByLabel(leaveBySec: number): string {
		if (leaveBySec < 0) return 'TOO LATE';
		if (leaveBySec < 60) return 'LEAVE NOW';
		return `LEAVE IN ${Math.floor(leaveBySec / 60)} MIN`;
	}

	// Route bullet classes correspond to MTA official color groupings.
	// See https://new.mta.info/ for the authoritative palette.
	function bulletClass(line: string): string {
		return `bullet bullet--${line.toLowerCase()}`;
	}

	// Sort + group visible trains into station → direction → [trains].
	type LiveTrain = InboundTrain & { live: ReturnType<typeof liveEta> };

	const visible = $derived.by(() => {
		if (!state) return [] as LiveTrain[];
		return state.inbound
			.map((t) => ({ ...t, live: liveEta(t) }))
			.filter((t) => t.live.etaSec > 0)
			.sort((a, b) => a.live.etaSec - b.live.etaSec);
	});

	interface DirectionGroup {
		direction: 'N' | 'S';
		borough: string;
		terminus: string;
		trains: LiveTrain[];
	}
	interface StationGroup {
		stopId: string;
		name: string;
		walkSec: number;
		lines: string[];
		directions: DirectionGroup[];
	}

	const stations = $derived.by<StationGroup[]>(() => {
		if (!state) return [];
		const byStop = new Map<string, StationGroup>();
		// Seed from state.stations so stations show even with no inbound yet.
		for (const s of state.stations) {
			byStop.set(s.stopId, {
				stopId: s.stopId,
				name: s.name,
				walkSec: s.walkSeconds,
				lines: s.lines,
				directions: []
			});
		}
		const dirKey = (stopId: string, dir: 'N' | 'S') => `${stopId}:${dir}`;
		const dirMap = new Map<string, DirectionGroup>();
		for (const t of visible) {
			const group = byStop.get(t.stationId);
			if (!group) continue;
			const k = dirKey(t.stationId, t.direction);
			let dg = dirMap.get(k);
			if (!dg) {
				dg = { direction: t.direction, borough: t.borough, terminus: t.terminus, trains: [] };
				dirMap.set(k, dg);
				group.directions.push(dg);
			}
			dg.trains.push(t);
		}
		// Order directions: N above S. Sort stations by walk distance.
		// Cap each direction to the next MAX_TRAINS_PER_DIRECTION. Beyond six
		// upcoming trains per direction the view turns into a wall of ETAs
		// nobody plans around — the next few are the actionable window.
		const MAX_TRAINS_PER_DIRECTION = 6;
		return Array.from(byStop.values())
			.sort((a, b) => a.walkSec - b.walkSec)
			.map((g) => ({
				...g,
				directions: g.directions
					.sort((a, b) => a.direction.localeCompare(b.direction))
					.map((d) => ({ ...d, trains: d.trains.slice(0, MAX_TRAINS_PER_DIRECTION) }))
			}));
	});

	function walkMin(sec: number): string {
		return `${Math.max(1, Math.round(sec / 60))} MIN`;
	}
	function clockTime(ms: number): string {
		const d = new Date(ms);
		return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
	}
</script>

<svelte:head>
	<title>hey subway</title>
</svelte:head>

<main class="stage">
	<header class="masthead">
		<div class="brand">
			<!-- The title is set in the same Helvetica used on MTA station
			     signage. All-caps, medium weight, generous tracking — reads
			     as signage, not UI. -->
			<h1>HEY SUBWAY</h1>
			<div class="tag">REAL-TIME · NYCT</div>
		</div>
		<div class="status-line">
			{#if state}
				<span class="status-clock">{clockTime(nowMs)}</span>
				<span class="status-meta">
					{state.stations.length} STATIONS · {visible.length} INBOUND
				</span>
				{#if state.errors.length > 0}
					<span class="status-err">{state.errors.length} FEED ERR</span>
				{/if}
			{:else if loadErr}
				<span class="status-err">ERR · {loadErr}</span>
			{:else}
				<span class="status-meta">CONNECTING…</span>
			{/if}
		</div>
	</header>

	{#if state && state.stations.length === 0}
		<section class="empty">
			<div class="empty-rule"></div>
			<p class="empty-title">NO STATIONS LOADED</p>
			<p class="empty-hint">Run <code>npm run fetch-stations</code> to populate the station list from the MTA GTFS static feed.</p>
			<div class="empty-rule"></div>
		</section>
	{/if}

	{#each stations as s (s.stopId)}
		<section class="station">
			<header class="station-head">
				<div class="station-title">
					<h2 class="station-name">{s.name}</h2>
					<div class="station-lines">
						{#each s.lines as line (line)}
							<span class={bulletClass(line)}>{line}</span>
						{/each}
					</div>
				</div>
				<div class="station-walk">
					<div class="walk-val">{walkMin(s.walkSec)}</div>
					<div class="walk-label">WALK</div>
				</div>
			</header>

			{#if s.directions.length === 0}
				<p class="no-trains">No inbound trains right now.</p>
			{/if}

			{#each s.directions as d (d.direction)}
				<div class="direction">
					<div class="direction-head">
						<span class="direction-borough">{d.borough.toUpperCase()}</span>
						<span class="direction-sep">·</span>
						<span class="direction-terminus">{d.terminus.toUpperCase()}-BOUND</span>
					</div>
					<ul class="trains">
						{#each d.trains as t (t.tripId + t.stationId + t.direction)}
							<li class="train" class:train--missable={t.live.missable} class:train--leaveNow={!t.live.missable && t.live.leaveBySec < 60}>
								<span class={bulletClass(t.line)}>{t.line}</span>
								<div class="eta">
									<span class="eta-val">{minutesLabel(t.live.etaSec)}</span>
									<span class="eta-unit">MIN</span>
								</div>
								<div
									class="leaveby"
									class:leaveby--missable={t.live.missable}
									class:leaveby--urgent={!t.live.missable && t.live.leaveBySec < 60}
								>
									{leaveByLabel(t.live.leaveBySec)}
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</section>
	{/each}

	<footer class="footer">
		<span>DATA · MTA GTFS-REALTIME</span>
		<span class="dot">·</span>
		<span>UNAFFILIATED WITH MTA</span>
	</footer>
</main>

<style>
	/* --------------------------------------------------------------------
	   HEY SUBWAY — NYC Subway design language.
	   Reference: MTA station signage (Helvetica + bullets, Unimark 1970),
	   platform countdown clocks, Massimo Vignelli's sign manual.
	   Core rules:
	     - Black background, white foreground.
	     - Type is Helvetica, all-caps for headers, generous tracking.
	     - Colored bullets ARE the color. The rest of the UI is black + white.
	     - No bezels, no rounded-card chrome. This is signage, not hardware.
	   -------------------------------------------------------------------- */

	.stage {
		min-height: 100vh;
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Masthead — a station sign. Black, divided by a thick white rule. */
	.masthead {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		padding-bottom: 1rem;
		border-bottom: 3px solid #fff;
	}
	.brand {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	h1 {
		margin: 0;
		font-size: 2.2rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: #fff;
		line-height: 1;
	}
	.tag {
		font-size: 0.7rem;
		letter-spacing: 0.25em;
		color: #999;
		font-weight: 500;
	}
	.status-line {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		text-align: right;
		font-size: 0.75rem;
		letter-spacing: 0.12em;
	}
	.status-clock {
		/* Tabular numerals, LED amber — the platform countdown clock color. */
		font-variant-numeric: tabular-nums;
		color: #f7a600;
		font-size: 1rem;
		font-weight: 700;
	}
	.status-meta {
		color: #999;
	}
	.status-err {
		color: #ee352e;
	}

	/* Station block — like a full-station schedule placard. White rule on
	   top separates stations visually the way platform signs sit in their
	   own frames. */
	.station {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-top: 1rem;
	}
	.station-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #333;
	}
	.station-title {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.station-name {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		line-height: 1.1;
		color: #fff;
	}
	.station-lines {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.station-walk {
		text-align: right;
		min-width: 6rem;
	}
	.walk-val {
		font-size: 1.25rem;
		font-weight: 700;
		color: #fff;
		letter-spacing: 0.05em;
		font-variant-numeric: tabular-nums;
	}
	.walk-label {
		font-size: 0.65rem;
		letter-spacing: 0.3em;
		color: #777;
		font-weight: 500;
	}
	.no-trains {
		color: #555;
		font-size: 0.8rem;
		letter-spacing: 0.15em;
		padding: 0.5rem 0;
	}

	/* Direction block — a subheader calling out which way these trains go.
	   Matches the "UPTOWN & THE BRONX" signage above each platform. */
	.direction {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.direction-head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: 0.75rem;
		letter-spacing: 0.22em;
		font-weight: 700;
		color: #fff;
		padding: 0.35rem 0;
	}
	.direction-borough {
		color: #fff;
	}
	.direction-sep {
		color: #555;
	}
	.direction-terminus {
		color: #aaa;
	}

	.trains {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
	}
	.train {
		display: grid;
		grid-template-columns: 2.5rem 6rem 1fr;
		align-items: center;
		gap: 1rem;
		padding: 0.65rem 0;
		border-top: 1px solid #1a1a1a;
	}
	.train:first-child {
		border-top: none;
	}
	.train--missable {
		opacity: 0.45;
	}

	/* Countdown-clock ETA. The big numeral + small MIN unit is the
	   standard format on NYCT platform displays. Amber on black. */
	.eta {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-variant-numeric: tabular-nums;
	}
	.eta-val {
		font-size: 2rem;
		font-weight: 700;
		color: #f7a600;
		line-height: 1;
		letter-spacing: 0.01em;
	}
	.eta-unit {
		font-size: 0.85rem;
		font-weight: 700;
		color: #f7a600;
		letter-spacing: 0.15em;
	}

	.leaveby {
		text-align: right;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		color: #888;
	}
	.leaveby--urgent {
		color: #f7a600;
	}
	.leaveby--missable {
		color: #ee352e;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem 1rem;
		text-align: center;
	}
	.empty-rule {
		width: 80%;
		height: 2px;
		background: #fff;
	}
	.empty-title {
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 0.25em;
		color: #fff;
		margin: 0;
	}
	.empty-hint {
		font-size: 0.8rem;
		color: #888;
		letter-spacing: 0.08em;
		max-width: 30rem;
	}
	.empty-hint code {
		background: #1a1a1a;
		padding: 0.1rem 0.4rem;
		border-radius: 2px;
		color: #f7a600;
		font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
		font-size: 0.75rem;
	}

	.footer {
		margin-top: auto;
		padding: 2rem 0 0;
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.65rem;
		letter-spacing: 0.22em;
		color: #555;
		border-top: 1px solid #1a1a1a;
	}
	.footer .dot {
		color: #333;
	}

	/* --------------------------------------------------------------------
	   MTA line bullets — official NYCT colors.
	   A circular badge with the line letter/number. White text except on
	   yellow (N/Q/R/W), where MTA signage uses black for legibility.
	   Source: https://new.mta.info/ (brand standards)
	   -------------------------------------------------------------------- */
	.bullet {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
		font-weight: 700;
		font-size: 1rem;
		line-height: 1;
		color: #fff;
		flex-shrink: 0;
		letter-spacing: -0.02em;
	}
	.train .bullet {
		width: 2rem;
		height: 2rem;
		font-size: 1.15rem;
	}

	/* Red — IRT 1 Av / 7 Av Line (1,2,3) */
	.bullet--1, .bullet--2, .bullet--3 { background: #ee352e; }
	/* Green — IRT Lexington (4,5,6) */
	.bullet--4, .bullet--5, .bullet--6 { background: #00933c; }
	/* Purple — IRT Flushing (7) */
	.bullet--7 { background: #b933ad; }
	/* Blue — IND 8 Av (A,C,E) */
	.bullet--a, .bullet--c, .bullet--e { background: #0039a6; }
	/* Orange — IND 6 Av (B,D,F,M) */
	.bullet--b, .bullet--d, .bullet--f, .bullet--m { background: #ff6319; }
	/* Yellow — BMT Broadway (N,Q,R,W). Text black per MTA brand. */
	.bullet--n, .bullet--q, .bullet--r, .bullet--w {
		background: #fccc0a;
		color: #000;
	}
	/* Light gray — BMT Canarsie (L) */
	.bullet--l { background: #a7a9ac; }
	/* Lime — IND Crosstown (G) */
	.bullet--g { background: #6cbe45; }
	/* Brown — BMT Nassau (J,Z) */
	.bullet--j, .bullet--z { background: #996633; }
	/* Dark gray — Shuttles (S, H, FS, GS, SIR) */
	.bullet--s, .bullet--h, .bullet--fs, .bullet--gs { background: #808183; }
	.bullet--sir { background: #0078c6; }

	/* Mobile — single column, larger tap targets, bullets same size. */
	@media (max-width: 600px) {
		.stage {
			padding: 1.25rem 1rem 3rem;
			gap: 1.25rem;
		}
		h1 {
			font-size: 1.6rem;
		}
		.status-clock {
			font-size: 0.85rem;
		}
		.masthead {
			align-items: flex-start;
			gap: 0.5rem;
		}
		.status-line {
			text-align: right;
		}
		.station-name {
			font-size: 1.25rem;
		}
		.station-head {
			align-items: flex-start;
		}
		.train {
			grid-template-columns: 2.25rem 5rem 1fr;
			gap: 0.75rem;
		}
		.eta-val {
			font-size: 1.6rem;
		}
		.eta-unit {
			font-size: 0.75rem;
		}
		.leaveby {
			font-size: 0.7rem;
			letter-spacing: 0.14em;
		}
	}
</style>
