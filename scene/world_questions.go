package scene

import "github.com/chenhg5/jev-3d-world"

func worldQuestions(scenePack string) map[string]jevloop.ChoiceQuestion {
	q := func(instructions string, criteria map[string]string) jevloop.ChoiceQuestion {
		return jevloop.ChoiceQuestion{Instructions: instructions, Criteria: criteria}
	}
	switch scenePack {
	case "interior":
		return map[string]jevloop.ChoiceQuestion{
			"world_archetype": q("Which indoor environment best matches the request?", map[string]string{
				"classroom": "School classroom with desks, seats and a teaching wall.", "hospital_ward": "Hospital or clinic ward with beds and care equipment.",
				"office": "Modern workplace with desks, screens and meeting areas.", "apartment": "Residential living and dining interior.",
				"restaurant": "Restaurant or cafe dining room with tables and a service area.", "library": "Library or reading room with shelves and study tables.",
				"laboratory": "Scientific laboratory with benches and instruments.", "gallery": "Museum or art gallery with exhibits and display walls.",
			}),
			"world_topology": q("Which floor-plan organization best supports the requested interior? Treat unspecified layout as a creative variation.", map[string]string{
				"open_plan": "One broad flexible room with furniture islands.", "central_aisle": "A strong central circulation aisle with repeated stations on both sides.",
				"split_zones": "Two functional zones divided by a partial wall or change of furniture.", "perimeter_rooms": "A main room with smaller side bays or enclosed support spaces.",
			}),
			"world_density": q("How furnished and occupied should the room feel?", map[string]string{
				"spacious": "Generous circulation and a restrained number of furnishings.", "furnished": "Complete practical furnishing with comfortable circulation.",
				"busy": "Dense, active interior with many stations, props and people.",
			}),
			"world_population": q("How active should the interior feel?", map[string]string{
				"empty": "No visible occupants.", "quiet": "A few occupants using the room calmly.",
				"active": "Several occupants make the room feel in use.", "crowded": "Many occupants create a busy public interior.",
			}),
			"world_feature": q("Which architectural feature should shape the room?", map[string]string{
				"window_wall": "A broad wall of windows provides directional daylight.", "skylights": "Ceiling openings and light wells brighten the center.",
				"mezzanine": "A partial upper gallery overlooks the main room.", "feature_wall": "A distinctive material or display wall anchors one end.",
			}),
			"world_hazard": q("Which explicit operational state applies? Default normal.", map[string]string{
				"normal": "Ordinary safe operation.", "after_hours": "Dim, quiet interior outside normal opening hours.",
				"emergency": "Warning lights and disrupted activity indicate an emergency.", "renovation": "Some areas are screened off for renovation.",
			}),
			"world_landmark": q("Which focal interior element best fits the requested room?", map[string]string{
				"teaching_wall": "Large board, screen or teaching wall.", "service_station": "Reception, nurses station or service counter.",
				"communal_table": "Large shared work, dining or reading table.", "hearth": "Residential fireplace and lounge focal point.",
				"display_piece": "Large exhibit, sculpture or experimental apparatus.",
			}),
		}
	case "ocean_liner":
		return map[string]jevloop.ChoiceQuestion{
			"world_archetype": q("Which large passenger-vessel character best matches the request?", map[string]string{
				"classic_liner":    "Early twentieth-century luxury ocean liner with long promenade decks and traditional superstructure.",
				"grand_steamship":  "Monumental steam passenger ship emphasizing funnels, lifeboats and formal decks.",
				"expedition_liner": "More utilitarian exploration liner with observation areas and working equipment.",
			}),
			"world_topology": q("What surrounding voyage setting best matches the request?", map[string]string{
				"open_ocean": "Open water in every direction.", "harbor_departure": "Harbor water, docks and a departure atmosphere.",
				"ice_field": "Cold northern sea with distant icebergs.", "storm_passage": "Rough dark ocean and dramatic weather.",
			}),
			"world_density": q("How elaborate and layered should the ship be?", map[string]string{
				"elegant": "Open promenades and restrained deck structures.", "grand": "Many layered decks, cabins and public areas.",
				"monumental": "Maximum scale, dense superstructure and strong vertical silhouette.",
			}),
			"world_population": q("What deck activity should be implied?", map[string]string{
				"quiet_voyage": "Sparse calm deck activity.", "passenger_day": "Busy promenade with passengers and deck furniture.",
				"evacuation": "Urgent lifeboat and emergency activity.",
			}),
			"world_feature": q("Which ship area should organize the explorable composition?", map[string]string{
				"promenade": "Long walkable side promenades.", "grand_deck": "Broad ceremonial central deck.",
				"lifeboat_deck": "Upper deck lined with lifeboats.", "observation_bow": "Open bow and forward observation area.",
			}),
			"world_hazard": q("Which explicit maritime danger is present? Default calm when none is requested.", map[string]string{
				"calm": "No immediate danger.", "iceberg": "A nearby iceberg creates tension.",
				"storm": "High winds and rough seas.", "distress": "The liner is in an emergency or sinking narrative.",
			}),
			"world_landmark": q("Which major silhouette should identify the ship?", map[string]string{
				"four_funnels": "Four classic funnels along the centerline.", "three_funnels": "Three large evenly spaced funnels.",
				"twin_funnels": "Two broad modern funnels.", "observation_mast": "Tall masts and observation structures dominate.",
			}),
		}
	case "prehistoric":
		return map[string]jevloop.ChoiceQuestion{
			"world_archetype": q("Which prehistoric-world character best matches the request?", map[string]string{
				"jungle_reserve": "Dense tropical dinosaur reserve with giant vegetation.", "lost_valley": "Wide hidden valley surrounded by cliffs and forest.",
				"volcanic_island": "Volcanic island ecosystem with ash, lava and jungle.", "research_park": "Dinosaur habitat mixed with fences, gates and a research outpost.",
			}),
			"world_topology": q("Which large landscape structure best organizes the prehistoric scene?", map[string]string{
				"open_valley": "Broad grazing basin with forest edges.", "river_corridor": "A river winds between jungle banks.",
				"cliff_basin": "High cliffs enclose the habitat.", "park_route": "A vehicle route links enclosures and an outpost.",
			}),
			"world_density": q("How dense should terrain and vegetation be?", map[string]string{
				"open": "Large sightlines and sparse tree groups.", "lush": "Rich vegetation with clear paths and glades.",
				"primeval": "Very dense, layered forest around smaller clearings.",
			}),
			"world_population": q("Which dinosaur population best matches the request?", map[string]string{
				"herbivore_herd": "Sauropods and horned herbivores dominate.", "predator_hunt": "A large predator and smaller hunters dominate.",
				"mixed_ecosystem": "Several herbivore and predator species share the landscape.", "giant_dominant": "One enormous dinosaur is the focal figure with a few smaller animals.",
			}),
			"world_feature": q("Which human-made or natural feature anchors the scene?", map[string]string{
				"waterfall": "A waterfall and pool create the focal habitat.", "research_outpost": "A compact scientific outpost overlooks the habitat.",
				"park_gate": "A monumental reserve gate and fenced route mark the entrance.", "nesting_ground": "An open nesting ground sits near the center.",
			}),
			"world_hazard": q("Which explicit environmental danger is present? Default calm when none is requested.", map[string]string{
				"calm": "Stable habitat without immediate danger.", "eruption": "A volcano is actively erupting.",
				"storm": "Heavy tropical storm and dark skies.", "breakout": "Damaged fences and escaped predators create an emergency.",
			}),
			"world_landmark": q("Which distant natural landmark defines the horizon?", map[string]string{
				"mountain_ring": "Layered mountains surround the valley.", "volcano": "A tall volcano dominates the island.",
				"stone_arch": "A giant natural rock arch rises above the forest.", "cliff_falls": "High cliffs and waterfalls frame the habitat.",
			}),
		}
	case "medieval_city":
		return map[string]jevloop.ChoiceQuestion{
			"world_archetype": q("Which large medieval settlement character best matches the request?", map[string]string{
				"northern_keep": "Severe stone stronghold with steep roofs and rugged terrain.", "royal_capital": "Dense prosperous capital around a palace or citadel.",
				"river_fortress": "Bridge, river walls and a fortified trade town.", "coastal_citadel": "Fortress city above a harbor or sea cliffs.",
			}),
			"world_topology": q("How should the fortified city occupy the land?", map[string]string{
				"walled_hill": "Concentric walls climb toward a hilltop keep.", "castle_town": "A central castle overlooks gridded streets and outer homes.",
				"river_crossing": "Two districts meet at a guarded bridge.", "cliff_terraces": "Layered streets and walls follow steep terraces.",
			}),
			"world_density": q("How built-up should the settlement be?", map[string]string{
				"frontier": "Small fortified settlement with open ground.", "thriving": "Busy town of houses, workshops and a market.",
				"capital": "Dense multi-ring capital packed inside extensive walls.",
			}),
			"world_population": q("Which civic activity should the city imply?", map[string]string{
				"daily_life": "Ordinary market and residential activity.", "royal_gathering": "Ceremonial activity around the citadel.",
				"siege_ready": "Guards, closed gates and defensive preparation.", "festival": "Decorated market streets and public celebration.",
			}),
			"world_feature": q("Which urban place should anchor exploration?", map[string]string{
				"market_square": "A central square, stalls and civic well.", "great_hall": "A monumental hall inside the upper ward.",
				"stone_bridge": "A fortified bridge links major districts.", "temple_close": "A church or temple precinct organizes nearby streets.",
			}),
			"world_hazard": q("Which explicit danger affects the city? Default peaceful when none is requested.", map[string]string{
				"peaceful": "No immediate conflict.", "siege": "An approaching siege shapes defenses.",
				"winter": "Snow and severe cold dominate.", "fire": "Parts of the city show fire and smoke.",
			}),
			"world_landmark": q("Which skyline landmark identifies the city?", map[string]string{
				"high_keep": "A tall square keep crowns the city.", "many_towers": "Numerous wall and palace towers form the skyline.",
				"great_hall": "A long monumental hall dominates the upper ward.", "citadel_spire": "A slender fortified spire rises from the citadel.",
			}),
		}
	}
	return map[string]jevloop.ChoiceQuestion{}
}
