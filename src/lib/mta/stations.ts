// HAND-EDITED source of truth for nearby stations. Re-running
// `npm run fetch-stations` will OVERWRITE this file with raw GTFS data
// (including scheduled diversions and transfer-complex splits). After
// running the fetcher, re-apply the hand-curated complex merge + route
// whitelist below. The MTA GTFS static trip counts include late-night
// diversions and special service that aren't regular all-times service
// (e.g. D at BMT 9 St only runs during G.O. work), so we whitelist the
// lines that actually serve these platforms in normal operation.
//
// Regular (2026) service validated against:
//   - en.wikipedia.org/wiki/Fourth_Avenue/Ninth_Street_station — F, R, G
//   - en.wikipedia.org/wiki/Seventh_Avenue_station_(IND_Culver_Line) — F, G
//
// 4 Av-9 St is a transfer COMPLEX: two physically separate parent
// stations (R33 BMT on 4 Av below grade, F23 IND 9 St elevated) share a
// street address and in-system transfer. R uses the BMT entrance (~507m
// from USER_LOCATION); F and G use the IND entrance (~854m).

import type { Station } from '$lib/types';

export const NEARBY_STATIONS: Station[] = [
	{
		stopId: 'R33',
		stopIds: ['R33', 'F23'],
		name: '4 Av-9 St',
		lat: 40.670847,
		lon: -73.988302,
		distanceMeters: 507,
		walkSeconds: 406,
		lines: ['F', 'G', 'R'],
		walkByRoute: {
			R: 406,
			F: 684,
			G: 684
		},
		distanceByRoute: {
			R: 507,
			F: 854,
			G: 854
		}
	},
	{
		stopId: 'F24',
		stopIds: ['F24'],
		name: '7 Av',
		lat: 40.666271,
		lon: -73.980305,
		distanceMeters: 568,
		walkSeconds: 454,
		lines: ['F', 'G']
	}
];

export const ROUTE_TERMINUS: Record<string, { N: string; S: string }> = {
	"1": {
		"N": "Van Cortlandt Park-242 St",
		"S": "South Ferry"
	},
	"2": {
		"N": "Wakefield-241 St",
		"S": "Flatbush Av-Brooklyn College"
	},
	"3": {
		"N": "Harlem-148 St",
		"S": "New Lots Av"
	},
	"4": {
		"N": "Woodlawn",
		"S": "Crown Hts-Utica Av"
	},
	"5": {
		"N": "Eastchester-Dyre Av",
		"S": "Bowling Green"
	},
	"6": {
		"N": "Pelham Bay Park",
		"S": "Brooklyn Bridge-City Hall"
	},
	"7": {
		"N": "Flushing-Main St",
		"S": "34 St-Hudson Yards"
	},
	"6X": {
		"N": "Pelham Bay Park",
		"S": "Brooklyn Bridge-City Hall"
	},
	"7X": {
		"N": "Flushing-Main St",
		"S": "34 St-Hudson Yards"
	},
	"GS": {
		"N": "Times Sq-42 St",
		"S": "Grand Central-42 St"
	},
	"A": {
		"N": "Inwood-207 St",
		"S": "Far Rockaway-Mott Av"
	},
	"B": {
		"N": "Bedford Park Blvd",
		"S": "Brighton Beach"
	},
	"C": {
		"N": "168 St",
		"S": "Euclid Av"
	},
	"E": {
		"N": "Jamaica Center-Parsons/Archer",
		"S": "World Trade Center"
	},
	"F": {
		"N": "Jamaica-179 St",
		"S": "Coney Island-Stillwell Av"
	},
	"FS": {
		"N": "Franklin Av",
		"S": "Prospect Park"
	},
	"G": {
		"N": "Court Sq",
		"S": "Church Av"
	},
	"H": {
		"N": "Broad Channel",
		"S": "Rockaway Park-Beach 116 St"
	},
	"L": {
		"N": "8 Av",
		"S": "Canarsie-Rockaway Pkwy"
	},
	"M": {
		"N": "Delancey St-Essex St",
		"S": "Middle Village-Metropolitan Av"
	},
	"N": {
		"N": "Astoria-Ditmars Blvd",
		"S": "Coney Island-Stillwell Av"
	},
	"W": {
		"N": "Astoria-Ditmars Blvd",
		"S": "Whitehall St-South Ferry"
	},
	"Q": {
		"N": "96 St",
		"S": "Coney Island-Stillwell Av"
	},
	"D": {
		"N": "Norwood-205 St",
		"S": "Coney Island-Stillwell Av"
	},
	"FX": {
		"N": "Jamaica-179 St",
		"S": "Coney Island-Stillwell Av"
	},
	"J": {
		"N": "Jamaica Center-Parsons/Archer",
		"S": "Broad St"
	},
	"Z": {
		"N": "Jamaica Center-Parsons/Archer",
		"S": "Broad St"
	},
	"R": {
		"N": "Forest Hills-71 Av",
		"S": "Bay Ridge-95 St"
	},
	"SI": {
		"N": "St George",
		"S": "Tottenville"
	}
};

export const ROUTE_BOROUGH: Record<string, { N: string; S: string }> = {
	"1": {
		"N": "Bronx",
		"S": "Manhattan"
	},
	"2": {
		"N": "Bronx",
		"S": "Brooklyn"
	},
	"3": {
		"N": "Manhattan",
		"S": "Brooklyn"
	},
	"4": {
		"N": "Bronx",
		"S": "Queens"
	},
	"5": {
		"N": "Bronx",
		"S": "Manhattan"
	},
	"6": {
		"N": "Bronx",
		"S": "Manhattan"
	},
	"7": {
		"N": "Queens",
		"S": "Manhattan"
	},
	"6X": {
		"N": "Bronx",
		"S": "Manhattan"
	},
	"7X": {
		"N": "Queens",
		"S": "Manhattan"
	},
	"GS": {
		"N": "Manhattan",
		"S": "Manhattan"
	},
	"A": {
		"N": "Bronx",
		"S": "Queens"
	},
	"B": {
		"N": "Bronx",
		"S": "Brooklyn"
	},
	"C": {
		"N": "Manhattan",
		"S": "Brooklyn"
	},
	"E": {
		"N": "Queens",
		"S": "Manhattan"
	},
	"F": {
		"N": "Queens",
		"S": "Brooklyn"
	},
	"FS": {
		"N": "Brooklyn",
		"S": "Brooklyn"
	},
	"G": {
		"N": "Queens",
		"S": "Brooklyn"
	},
	"H": {
		"N": "Queens",
		"S": "Queens"
	},
	"L": {
		"N": "Manhattan",
		"S": "Brooklyn"
	},
	"M": {
		"N": "Manhattan",
		"S": "Queens"
	},
	"N": {
		"N": "Queens",
		"S": "Brooklyn"
	},
	"W": {
		"N": "Queens",
		"S": "Manhattan"
	},
	"Q": {
		"N": "Manhattan",
		"S": "Brooklyn"
	},
	"D": {
		"N": "Bronx",
		"S": "Brooklyn"
	},
	"FX": {
		"N": "Queens",
		"S": "Brooklyn"
	},
	"J": {
		"N": "Queens",
		"S": "Manhattan"
	},
	"Z": {
		"N": "Queens",
		"S": "Manhattan"
	},
	"R": {
		"N": "Queens",
		"S": "Brooklyn"
	},
	"SI": {
		"N": "Staten Island",
		"S": "Staten Island"
	}
};
