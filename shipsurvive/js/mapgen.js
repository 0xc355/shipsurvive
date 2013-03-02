/* generates a map graph */
$(function(){
 "use strict";
var globals = {},
defaults = {
	background: 'white',
	grid_offset:{"x":0, "y":0},
	grid_width: 20,
	breach_chance: .02,
	base_oxygen_level: 5,
	room_min: 6,
	room_max: 12,
	font: 'Cutive Mono',
},
containers = {};

/* core functions */
var core = {
	load_image: function(name, sprite_only) {
		if (!globals.images[name]) {
			if (sprite_only != true) {
				var img = new Image();
				img.src = "img/icon/" + name + ".png";
				img.onload = function () {
					globals.images[name] = img;
				};
			}
			if (sprite_only != false) {
				var spr = new Image();
				spr.src = "img/sprite/" + name + ".png";
				spr.onload = function () {
					globals.images["g_" + name] = spr;
				};
			}
		}
	},
	load_images: function() {
		core.load_image("food");
		core.load_image("fire", true);
		core.load_image("welder_fire", true);
		core.load_image("welder_fire_small", true);
		core.load_image("medipack");
		core.load_image("wire");
		core.load_image("wire_cutter", false);
		core.load_image("oxygen_tank");
		core.load_image("empty_tank");
		core.load_image("welder", false);
		core.load_image("breach", true);
		core.load_image("kitchen", true);
		core.load_image("rubble", true);
		core.load_image("reactor", true);
		core.load_image("small_salvage", true);
		core.load_image("medium_salvage", true);
		core.load_image("large_salvage", true);
		core.load_image("engine", true);
		core.load_image("autopilot", true);
		core.load_image("replicator", true);
		core.load_image("terminal", true);
		core.load_image("food_generator", true);
		core.load_image("life_support", true);
		core.load_image("medical_bay", true);
	},
	load_classes: function() {
		core.Cell = new JS.Class({
			initialize: function(x,y) {
				this.x = x;
				this.y = y;
				this.oxygen = defaults.base_oxygen_level;
				this.type = "open";
				this.breach = 0;
				this.passable = true;
				this.powered = false;
				this.prev_powered = false;
				this.power_source = false;
				this.fire = 0;
				this.neighboring_rooms = [];
			},
			hash_cell: function() {
				return this.x + this.y * globals.bounds.width;
			},
			equals: function(other) {
				return other.x == this.x && other.y == this.y;
			},
			diag_neighbors: function () {
				var celllb = new core.Cell(this.x-1, this.y+1);
				var cellrb = new core.Cell(this.x+1, this.y+1);
				var celllt = new core.Cell(this.x-1, this.y-1);
				var cellrt = new core.Cell(this.x+1, this.y-1);
				return [celllb,cellrb,celllt,cellrt];
			},
			left: function () {
				return new core.Cell(this.x-1, this.y);
			},
			right: function () {
				return new core.Cell(this.x+1, this.y);
			},
			bottom: function () {
				return new core.Cell(this.x, this.y-1);
			},
			top: function () {
				return new core.Cell(this.x, this.y+1);
			},
			gcell: function () {
				return globals.map_grid[mapg.indexof(this)];
			},
			connectivity: function (ffilter) {
				var ret = [];
				if (ffilter(this.top().gcell())) {ret.top = true;}
				if (ffilter(this.bottom().gcell())) {ret.bottom = true;}
				if (ffilter(this.left().gcell())) {ret.left = true;}
				if (ffilter(this.right().gcell())) {ret.right = true;}
				return ret;
			},
			neighbors: function () {
				var celll = new core.Cell(this.x-1, this.y);
				var cellr = new core.Cell(this.x+1, this.y);
				var cellt = new core.Cell(this.x, this.y+1);
				var cellb = new core.Cell(this.x, this.y-1);
				return [celll,cellr,cellt,cellb];
			},
			grid_neighbors: function (func) {
				var celll = mapg.cell_at(this.x-1, this.y);
				var cellr = mapg.cell_at(this.x+1, this.y);
				var cellt = mapg.cell_at(this.x, this.y+1);
				var cellb = mapg.cell_at(this.x, this.y-1);
				return _.filter([celll,cellr,cellt,cellb], func);
			},
			neighbors_with: function (func) {
				return _.filter(this.neighbors(), func);
			},
			set_room: function(room) {
				this.type = "room";
				this.room = room;
				this.name = room.type;
			},
			reset_power: function() {
				this.prev_powered = this.powered;
				this.powered = false;
				this.power_load = 0;
				this.power_source = 0;
			}
		});
		core.Actor = new JS.Class({
			initialize: function(type, x, y) {
				this.origin = {x:x, y:y};
				this.facing = 0;
				this.type = type;
				this.cell = mapg.cell_at(x,y);
			},
			update_cell: function() {
				var x = Math.floor((this.origin.x)/defaults.grid_width);
				var y = Math.floor((this.origin.y)/defaults.grid_width);
				this.cell = core.check_position(x, y);
				return this.cell;
			},
			random_room: function() {
				var start_room;
				var start_origin;
				while (!start_room && !start_origin) {
					var rand_index = utilities.random_interval(0, globals.rooms.length);
					var start_room = globals.rooms[rand_index];
					start_origin = start_room.origin;
				}
				var c_origin = {"x":start_origin.x * defaults.grid_width,
							"y":start_origin.y * defaults.grid_width};
				c_origin.x += utilities.random_interval(1, start_room.dimensions.width - 1) * defaults.grid_width;
				c_origin.y += utilities.random_interval(1, start_room.dimensions.height - 1) * defaults.grid_width;
				this.origin = c_origin;
				this.update_cell();
			},
			try_move: function(x, y) {
				var new_origin = {x:this.origin.x+x, y:this.origin.y+y};
				var x = Math.floor((new_origin.x)/defaults.grid_width);
				var y = Math.floor((new_origin.y)/defaults.grid_width);
				var next_room = core.check_position(x,y);
				return next_room;
			},
			move: function(x, y) {
				var new_origin = {x:this.origin.x+x, y:this.origin.y+y};
				var x = Math.floor((new_origin.x)/defaults.grid_width);
				var y = Math.floor((new_origin.y)/defaults.grid_width);
				var next_room = core.check_position(x,y);
				if (next_room && next_room.passable) {
					this.origin.x = new_origin.x;
					this.origin.y = new_origin.y;
					if (!next_room.equals(this.cell)) {
						this.update_cell();
					}
					return this.cell;
				}
				return undefined;
			}
		});
		core.Building = new JS.Class(core.Actor, {
			initialize: function (type, x, y) {
				this.callSuper(type, x, y);
			},
			update_function: function (dt) {
				//do nothing
			}
		});
		core.Hostile = new JS.Class(core.Actor, {
			initialize: function (type, x, y) {
				this.callSuper(type, x, y);
				this.reset_speed();
				this.max_health = 2;
				this.health = this.max_health;
			},
			corner_blocked: function (from, to) {
				var dx = Math.min(Math.max(to.x - from.x,-1), 1);
				var dy = Math.min(Math.max(to.y - from.y, -1), 1);
				if (Math.abs(dx) == 1 &&
				    Math.abs(dy) == 1) {
					//corner movement, check to make sure not blocked.
					var horz = globals.map_grid[mapg.indexof(from.x + dx, from.y + 0)];
					var vert = globals.map_grid[mapg.indexof(from.x + 0, from.y + dy)];
					if (horz && vert) {
						if (!horz.passable) {return vert;}
						if (!vert.passable) {return horz;}
					}
				}
				return undefined;
			},
			recalc_room: function () {
				var room_path = mapg.room_a_star(this.cell.room, globals.character.cell.room);
				this.paused = room_path.length > 2;//if larger than 2 rooms, stop
			},
			recalc_path: function () {
				this.path = mapg.grid_a_star(this.cell, globals.character.cell);
				this.next_cell = undefined;
				if (this.path.length == 0) {
					this.paused = true;
				}
			},
			reset_speed: function () {
				this.speed = utilities.random_interval(20,60);
			},
			update_function: function (dt) {
				var angle_to;
				if (this.paused || !this.cell) { return; }
				if (!this.next_cell || this.cell.equals(this.next_cell)) {
					if (!this.path || this.path.length == 0) {
						this.recalc_path();
					}
					if (this.path && this.path.length > 0) {
						this.next_cell = this.path.pop();
						var blocked = this.corner_blocked(this.cell, this.next_cell);
						if (blocked) {
							this.path.push(this.next_cell);
							this.next_cell = blocked;
						}
					}
				}
				if (globals.character.welder
				    && this.cell == globals.character.get_welder_flame()) {
					this.health -= dt;
					if (this.health < 0) {
						core.log("You have killed an alien");
						this.health = this.max_health;
						this.random_room();
					}
				} else if (this.cell == globals.character.cell) {
					globals.red_overlay_alpha = .7;
					globals.character.health -= 25;
					core.log("Alien has hit you for 25 damage");
					this.random_room();
					while (this.cell.room == globals.character.cell.room) {
						this.random_room();
						this.reset_speed();
					}
					this.path = [];
					this.next_cell = undefined;
				} else if (this.next_cell) {
					var target = core.grid_to_xy(this.next_cell.x, this.next_cell.y);
					target.x += defaults.grid_width/2;
					target.y += defaults.grid_width/2;
					angle_to = Math.atan2(target.y - this.origin.y,
								  target.x - this.origin.x);
				}
				if (angle_to) {
					this.facing = angle_to;
					this.move(Math.cos(angle_to) * this.speed * dt,
								Math.sin(angle_to) * this.speed * dt);
				}
			}
		});
	},
	reset: function() {
		globals.keys = {"w":false, "a":false, "s":false, "d":false};
		globals.mousePos = {"x":0, "y":0};
		globals.room_types = {};
		globals.pause = false;
		globals.map_grid = [];
		globals.objs = [];
		globals.fires = [];
		globals.item_map = [];
		globals.wiresets = [];
		globals.building_map = [];
		globals.max_distance = 3000;
		globals.distance = globals.max_distance;
		globals.on_course = false;
		globals.diffuse_counter = 0;
		globals.flame_counter = 0;
		globals.inventory = [
			{type:"wire_cutter", amount:1},
			{type:"welder", amount:1},
			{type:"wire", amount: 20},
			{type:"oxygen_tank", amount: 2}
		];
		globals.inventory.add_item = function (type, amount) {
			core.log("You have picked up " + type + " x " + amount);
			var item = _.find(this, function (item) {
				return item.type == type;
			});
			if (item) {
				item.amount += amount;
			} else {
				this.push({type:type, amount:amount});
			}
		};
		globals.score = 0;
		globals.timer = 0;
		core.generate_map();
		var hostile;
		for (var i = 0; i < 2; i++) {
			hostile = core.add_hostile("hostile");
			hostile.random_room();
		}
		globals.character = new core.Actor("player", 0, 0);
		globals.character.welder = 0;
		globals.character.get_welder_flame = function () {
			var dx = Math.cos(globals.character.facing);
			var dy = Math.sin(globals.character.facing);
			if (Math.abs(Math.abs(dx) - Math.abs(dy)) < .2) {
				dx = Math.round(dx/Math.abs(dx));
				dy = Math.round(dy/Math.abs(dy));
			} else {
				if (Math.abs(dx) < Math.abs(dy)) {
					dx = 0;
					dy = Math.round(dy/Math.abs(dy));
				} else {
					dx = Math.round(dx/Math.abs(dx));
					dy = 0;
				}
			}
			return mapg.cell_at(globals.character.cell.x + dx,
					    globals.character.cell.y + dy);
		};
		globals.character.max_health = 100;
		globals.character.max_hunger = 100;
		globals.character.max_oxygen = 5;
		globals.character.max_temperature = 40;
		globals.character.temperature = globals.character.max_temperature/2;
		globals.character.health = globals.character.max_health;
		globals.character.hunger = globals.character.max_hunger;
		globals.character.oxygen = globals.character.max_oxygen;
		globals.character.scraps = 10;
		globals.room_func = [];
		globals.rooms.forEach(function (room) {
			if (rooms[room.type]) {
				var room_f = rooms[room.type](room);
				if (room_f) {
					globals.room_func.push(room_f);
				}
			} else {
				rooms.default_function(room);
			}
			rooms.all_function(room);
		});
		globals.character.random_room();
	},
	init: function() {
		core.load_classes();
		globals.canvas = $('#board');
		var cv = globals.canvas[0];
		
		globals.red_overlay_alpha = 0;
		globals.room_data = room_data;
		cv.onselectstart = function () { return false; }
		globals.context = cv.getContext('2d');
		globals.context.background = defaults.background;
		globals.params = {noise_size: 1, radius_size:9};
		globals.images = {};
		globals.console = $('#console');
		core.reset_console();
		core.load_images();
		globals.screen_bounds = {
			origin: {x: 0, y: 0},
			size: {
				width: globals.canvas[0].width,
				height: globals.canvas[0].height
			}
		};
		globals.centroid = {
			x: (globals.screen_bounds.size.width/2 + globals.screen_bounds.origin.x),
			y: (globals.screen_bounds.size.height/2 + globals.screen_bounds.origin.y)
		};
		globals.keys = {"w":false, "a":false, "s":false, "d":false};
		globals.room_size = 50;
		globals.light_cone = 200;
		globals.wires = [];
		globals.powered_rooms = {mini_reactor:300, large_reactor:1000};
		$("#size_slider").slider({max:360, min:0, step:1, value:globals.light_cone, slide:core.change_size});
		$("#noise_slider").slider({max:100, min:0, step:1, value:5, slide:core.change_noise});
		$("p#size_display").text("Light Size: " + globals.light_cone);
		$("p#noise_display").text("Oxygen level: " + defaults.base_oxygen_level);

		var ratio = core.hiDPIRatio();
		if (ratio != 1) {
			var originalWidth = cv.width;
			var originalHeight = cv.height;

			cv.css({
				width: originalWidth + "px",
				height: originalHeight + "px"
			});
			globals.context.scale(ratio, ratio);
		}
		globals.context.font = defaults.font;
		cv.addEventListener('click', core.toggle_door, true);
		cv.addEventListener('contextmenu', core.pause, true);
		cv.addEventListener('mousedown', core.mouse_down, true);
		cv.addEventListener('mouseup', core.mouse_up, true);
		cv.addEventListener('keydown', core.keydown_handler, true);
		cv.addEventListener('keyup', core.keyup_handler, true);
		cv.setAttribute('tabindex','0');
		cv.focus();
		function getMousePos(canvas, evt) {
			var rect = canvas.getBoundingClientRect();
			return {
				"x": evt.clientX - rect.left,
				"y": evt.clientY - rect.top
			};
		}
		globals.bounds = {"width": 500, "height": 500};

		core.reset();

		cv.addEventListener('mousemove', function(evt) {
			if (globals.pause) {return;}
			globals.mousePos = getMousePos(cv, evt);
			globals.character.facing = 
				Math.atan2(globals.mousePos.y - globals.centroid.y,
					 globals.mousePos.x - globals.centroid.x);
		}, false);
		window.requestAnimFrame = (function(){
			return  window.requestAnimationFrame       || 
					window.webkitRequestAnimationFrame || 
					window.mozRequestAnimationFrame    || 
					window.oRequestAnimationFrame      || 
					window.msRequestAnimationFrame     || 
			function( callback ){
				window.setTimeout(callback, 1000 / 60);
			};
		})();

		var then = new Date;
		(function animloop(){
			requestAnimFrame(animloop);
			var now = new Date;
			core.update((now - then)/1000);
			then = now;
			core.redraw_map();
	    	})();
	},
	reset_console: function() {
		globals.console.text("Console:");
	},
	log: function(text) {
		globals.console.text(globals.console.text() + "\n>>" + text);
		    $('#console').scrollTop($('#console')[0].scrollHeight);
	},
	add_hostile: function(type) {
		var new_obj = new core.Hostile(type,0,0);
		globals.objs.push(new_obj);
		return new_obj;
	},
	remove_building: function(building) {
		globals.objs.splice(globals.objs.indexOf(building), 1);
		delete globals.building_map[mapg.indexof(building.cell.x, building.cell.y)];
	},
	add_building: function(type, x, y) {
		var new_obj = new core.Building(type,x,y);
		if (buildings[new_obj.type]) {
			new_obj.update_function = buildings[new_obj.type](new_obj);
		}
		globals.building_map[mapg.indexof(x,y)] = new_obj;
		globals.objs.push(new_obj);
		return new_obj;
	},
	change_size: function(event, ui) {
		globals.light_cone = Math.round(ui.value);
		$("p#size_display").text("Light Size: " + globals.light_cone);
	},
	change_noise: function(event, ui) {
		defaults.base_oxygen_level = Math.round(ui.value);
		var val = Math.round(ui.value);
		$("p#noise_display").text("Oxygen Level: " + val);
	},
	mouse_down: function (evt) {
		if (evt.which == 3) {globals.keys.rmouse = true;}
	},
	mouse_up: function (evt) {
		if (evt.which == 3) {globals.keys.rmouse = false;}
	},
	keydown_handler: function (evt) {
		var code = evt.keyCode;
		if (code == 87) {globals.keys["w"] = true;} 
		if (code == 65) {globals.keys["a"] = true;}
		if (code == 83) {globals.keys["s"] = true;}
		if (code == 68) {globals.keys["d"] = true;}
		if (code == 16) {globals.keys["shift"] = true;}
		if (code >= 48 && code <= 57) {
			//code is 0-9
			var num = (code - 48 + 9) % 10;
			var item = globals.inventory[num];
			if (item && item.amount > 0) {
				core.log("You use a " + item.type);
				var used = items[item.type](item);
				item.amount = Math.max(0, item.amount - used);
			}
			if (item.amount == 0) {
				globals.inventory.splice(num, 1);
			}
		}
	},
	keyup_handler: function (evt) {
		var code = evt.keyCode;
		if (code == 87) {globals.keys["w"] = false;} 
		if (code == 65) {globals.keys["a"] = false;}
		if (code == 83) {globals.keys["s"] = false;}
		if (code == 68) {globals.keys["d"] = false;}
		if (code == 16) {globals.keys["shift"] = false;}
	},
	generate_map: function() {
		globals.place_next_room = mapg.generate_room_graph(globals.room_size,
					globals.bounds.width, globals.bounds.height);
		while(globals.place_next_room()) {}
	},
	pause: function () {
		globals.pause = !globals.pause;
	},
	toggle_wire: function () {
		var grid_point = core.screen_to_grid_index(globals.mousePos);
		var next_cell = core.check_position(grid_point.x, grid_point.y);
		var dx = next_cell.x - globals.current_cell.x;
		var dy = next_cell.y - globals.current_cell.y;
		var distance = Math.sqrt(dx*dx + dy*dy);
		if (next_cell && next_cell.passable && distance < 2.5) {
			if (next_cell.wired && globals.keys.shift) {
				next_cell.wired = false;
				next_cell.reset_power;
				delete globals.wires[next_cell.hash_cell()];
			} else if (!next_cell.wired &&  !globals.keys.shift){
				next_cell.wired =  true;
				globals.wires[next_cell.hash_cell()] = next_cell;
			}
		}
		mapg.recalculate_power();
	},
	toggle_door: function () {
		var grid_point = core.screen_to_grid_index(globals.mousePos);
		var next_cell = core.check_position(grid_point.x, grid_point.y);
		if (next_cell && next_cell.type == "door"
		    		&& next_cell != globals.current_cell
	    			&& !next_cell.wired) {
			var collided = false;
			for (var i = 0; i < globals.objs.length; i++) {
				var obj = globals.objs[i];
				if (next_cell == obj.cell) {
					collided = true;
					break;
				}
			}
			if (!collided) {
				var dx = next_cell.x - globals.current_cell.x;
				var dy = next_cell.y - globals.current_cell.y;
				var distance = Math.sqrt(dx*dx + dy*dy);
				if (distance < 2) {
					next_cell.passable = !next_cell.passable;
					core.recalculate_paths();
				}
			}
		}
	},
	mouse_debug: function () {
		var grid_point = core.screen_to_grid_index(globals.mousePos);
		console.log(grid_point.x, grid_point.y);
		var next_cell = core.check_position(grid_point.x, grid_point.y);
		var angle = Math.atan2(grid_point.y - globals.current_cell.y,
				       grid_point.x - globals.current_cell.x);
		var a_dist = utilities.angular_distance(globals.character.facing, angle);
		globals.next_mouse_cell = next_cell;
		if(next_cell)
			console.log(a_dist, next_cell.opacity);
	},
	screen_to_grid_index: function(point) {
		var new_origin = {}
		new_origin.x = point.x + globals.character.origin.x - globals.centroid.x;
		new_origin.y = point.y + globals.character.origin.y - globals.centroid.y;
		var x = Math.floor((new_origin.x)/defaults.grid_width);
		var y = Math.floor((new_origin.y)/defaults.grid_width);
		return {"x":x, "y":y};
	},
	grid_to_xy: function(x,y) {
		var c_origin = {x:x * defaults.grid_width,
				y:y * defaults.grid_width};
		return c_origin;
	},
	redraw_map: function() {
		draw_functions.draw_bg(globals.context);
		draw_functions.draw_rooms(globals.context, globals.rooms, defaults.grid_width, 1);
		var open_door_cells = [];
		var closed_door_cells = [];
		var wall_cells = [];
		var non_occluded_cells = [];
		var items = [];
		var wires = [];
		var breaches = [];
		var fires = [];;
		var hostiles = [], buildings = [];

		var screen_end = {
			x:globals.screen_bounds.origin.x + globals.screen_bounds.size.width,
			y:globals.screen_bounds.origin.y + globals.screen_bounds.size.height
		};
		var view_bounds = {};
		view_bounds.origin = core.screen_to_grid_index(globals.screen_bounds.origin);
		view_bounds.end = core.screen_to_grid_index(screen_end);
		view_bounds.end.x += 1;
		view_bounds.end.y += 1;

		for (var i = 0; i < globals.objs.length; i++) {
			var obj = globals.objs[i];
			if (!obj.cell.occluded)
				if (obj.type == "hostile")
					hostiles.push(obj);
				else
					buildings.push(obj);
		}

		var angle = Math.atan2(1,0);
		var light_angle = globals.light_cone * (globals.character.welder ? 3 : 1);
		var light_max_dist = (light_angle / 360) * Math.PI;
		for (var y = view_bounds.origin.y; y < view_bounds.end.y; y++) {
			for (var x = view_bounds.origin.x; x < view_bounds.end.x; x++) {
				var cell = globals.map_grid[mapg.indexof(x,y)];
				if (!cell) {continue;}
				if (cell.type == "door") {
					if (cell.passable) {
						open_door_cells.push(cell);
					} else {
						closed_door_cells.push(cell);
					}
				} else if (cell.type == "wall") {
					wall_cells.push(cell);
				}
				if (cell.wired) {
					wires.push(cell);
				}
				var o_cell = {x:x,y:y};
				if (cell.fire) {
					fires.push(cell.fire);
				}
				var item = globals.item_map[mapg.indexof(x,y)];
				if (item) {
					items.push({position:cell, item:item});
				}
				var angle = Math.atan2(y - globals.current_cell.y, x - globals.current_cell.x);
				var a_dist = utilities.angular_distance(globals.character.facing, angle);
				var powered_multiplier = cell.room && cell.room.powered ? 1.: .5; 
				var occluded = mapg.occluded(globals.current_cell, o_cell);
				var m_dist = mapg.m_dist(globals.current_cell, o_cell);

				var angle_opacity, distance_opacity, powered_opacity, occluded_opacity;
				if (cell == globals.current_cell) {
					angle_opacity = 0;
				} else if (light_max_dist != 0) {
					angle_opacity = Math.pow(a_dist / (light_max_dist * powered_multiplier), 4);
				} else {
					angle_opacity = 1;
				}
				if (cell.breach > 0) {
					breaches.push({position:cell, item:{type:"breach"}});
				}

				distance_opacity = Math.min(1, m_dist / 2);
				var powered;
				if (cell.room) {
					powered = cell.room && cell.room.powered;
				} else {
					powered = cell.neighbors_with(function (n) {
						var g = globals.map_grid[mapg.indexof(n)];
						return g && g.room && g.room.powered;}).length > 0;
				}
				powered_opacity = powered ? .5: 1;
				occluded_opacity = occluded ? 1: 0;
				o_cell.opacity = Math.min(Math.max(Math.min(angle_opacity, powered_opacity),
								occluded_opacity),
								distance_opacity);
				if(cell) {cell.occluded = !m_dist > 2 && occluded;}
				non_occluded_cells.push(o_cell);
			}
		}
		draw_functions.draw_cells(globals.context, wall_cells,
					  defaults.grid_width, "rgba(60,60,60,1)");
		draw_functions.draw_cells(globals.context, closed_door_cells, defaults.grid_width, "rgba(180,0,0,1)");
		draw_functions.draw_cells(globals.context, open_door_cells, defaults.grid_width, "rgba(0,200,0,1)");
		draw_functions.draw_items(globals.context, breaches, defaults.grid_width);
		draw_functions.draw_objects(globals.context, buildings, defaults.grid_width);
		draw_functions.draw_wires(globals.context, wires, defaults.grid_width, "rgba(255,100,100,1)");
		draw_functions.draw_items(globals.context, items, defaults.grid_width);
		draw_functions.draw_fires(globals.context, fires, defaults.grid_width);
		draw_functions.draw_character(globals.context, globals.character);
		hostiles.forEach(function (h) {draw_functions.draw_character(globals.context, h, 10, "#FF0000")});
		draw_functions.draw_cells(globals.context, non_occluded_cells, defaults.grid_width, "rgba(255,0,0,1)", 0,
					  function (cell) {
						  var gcell = mapg.cell_at(cell.x, cell.y);
						  var op = Math.max(0, 1 - Math.max(0,gcell.oxygen)/5) * .3;
						  var opacity = gcell.passable ? op : 0;
						  return opacity;
					  }, "255,0,0");
		if (globals.character.welder > 0) {
			var welder_flame_pos = globals.character.get_welder_flame();
			var frame = Math.round(globals.timer * 10) % 2;
			if (welder_flame_pos && welder_flame_pos.type != "wall") {
				draw_functions.draw_items(globals.context,
							  [{item:{type:frame ? "welder_fire" : "welder_fire_small"},
							  position:welder_flame_pos}], defaults.grid_width);
			}
		}
		draw_functions.draw_cells(globals.context, non_occluded_cells,
						defaults.grid_width, "rgba(0,0,0,1)", -1,
						function (cell) {return globals.pause ? 1 :cell.opacity;}, "0,0,0");
		if (globals.current_cell) {
			draw_functions.draw_tooltip(globals.context, {"x":0, "y":0}, {"x":10, "y":10}, globals.current_cell);
		}
		draw_functions.draw_score(globals.context, {"x":globals.screen_bounds.size.width- 130, "y":5},
						globals.character.scraps);
		draw_functions.draw_healthbar(globals.context, "#FF0000", globals.character.health/globals.character.max_health,
					      {x:globals.screen_bounds.size.width - 20, y:30});
		draw_functions.draw_heatbar(globals.context,
					globals.character.temperature/globals.character.max_temperature,
					{x:globals.screen_bounds.size.width - 35, y:30}, 2);
		draw_functions.draw_distance_bar(globals.context,
					globals.distance/globals.max_distance,
					globals.screen_bounds.size.height - 22, 2);
		draw_functions.draw_healthbar(globals.context, "#00AA00",
					globals.character.hunger/globals.character.max_hunger,
					{x:globals.screen_bounds.size.width - 50, y:30});
		draw_functions.draw_healthbar(globals.context, "#BB00BB",
					globals.character.oxygen/globals.character.max_oxygen,
					{x:globals.screen_bounds.size.width - 65, y:30});
		draw_functions.draw_inventory(globals.context, globals.inventory, 50);
		draw_functions.draw_overlay(globals.context, "rgba(255,0,0," +globals.red_overlay_alpha + ")");
		draw_functions.draw_border(globals.context, 2);
	},
	hiDPIRatio: function() {
		var devicePixelRatio, backingStoreRatio;

		devicePixelRatio = window.devicePixelRatio || 1;
		backingStoreRatio = globals.context.webkitBackingStorePixelRatio ||
				globals.context.mozBackingStorePixelRatio ||
				globals.context.msBackingStorePixelRatio ||
				globals.context.oBackingStorePixelRatio ||
				globals.context.backingStorePixelRatio || 1;
		return devicePixelRatio / backingStoreRatio;
	},
	recalculate_paths: function() {
		for (var i = 0; i < globals.objs.length; i++) {
			var obj = globals.objs[i];
			obj.path = [];
			obj.next_cell = undefined;
			obj.paused = false;
		}
	},
	update: function(dt) {
		if (globals.pause) {return;}
		globals.timer += dt;
		globals.score += dt * 10;
		var new_origin = {"x":globals.character.origin.x, "y":globals.character.origin.y};
		var dd = {x:0, y:0};
		var moved = false;
		var original_cell = globals.character.cell;
		globals.diffuse_counter += dt;
		globals.flame_counter += dt;
		if (globals.diffuse_counter > 1) {
			mapg.diffuse_oxygen();
			globals.diffuse_counter = 0;
		}
		if (globals.flame_counter > 1) {
			mapg.check_for_short();
			globals.flame_counter = 0;
		}
		mapg.propagate_flames(dt);
		if (globals.keys.w) { dd.y -= dt * 100; }
		if (globals.keys.s) { dd.y += dt * 100; }
		globals.character.move(0, dd.y);
		if (globals.keys.a) { dd.x -= dt * 100; }
		if (globals.keys.d) { dd.x += dt * 100; }
		globals.character.move(dd.x, 0) || moved;
		globals.character.next_cell = globals.character.try_move(dd.x, dd.y);
		if (!original_cell.equals(globals.character.cell)) {
			var item = globals.item_map[mapg.indexof(globals.character.cell)];
			if (item) {
				globals.item_map[mapg.indexof(globals.character.cell)] = undefined;
				globals.inventory.add_item(item.type, item.amount);
			}
			core.recalculate_paths();
		}
		globals.room_func.forEach(function (func) {func(dt);});
		var moved_distance = dd.x != 0 || dd.y != 0 ? 1 : 0;
		if (globals.character.hunger > 0) {
			globals.character.hunger -= dt;
		} else {
			globals.character.health -= dt * 3;
		}
		var m_temp = globals.character.max_temperature;
		var temperature = 0;
		var oxygen_req = dt * (.5 + moved_distance);

		var welder_flame_pos = globals.character.get_welder_flame();

		if (globals.character.cell.room) {
			temperature += globals.character.cell.room.heat;
			temperature += globals.character.cell.room.powered ? 1 : 0;
		} else {
			var neighbors = globals.character.cell.grid_neighbors(function (cell) {
				return cell && cell.passable;
			});
			var rooms = _.map(neighbors, function (cell) {return cell.room;});
			var temp = 0
			rooms.forEach(function (room) {temp += room.powered ? 1 : 0;});
			temperature += temp / rooms.length; 
		}
		temperature += moved_distance / 2;
		temperature += globals.character.cell.fire ? 10 : 0;
		temperature += globals.character.cell.grid_neighbors(
					function (o) {return o && o.passable && o.fire;}).length * 5;

		if (original_cell.oxygen > 0) {
			var oxygen_taken = Math.min(oxygen_req, original_cell.oxygen);
			original_cell.oxygen -= oxygen_taken;
			oxygen_req -= oxygen_taken;
			if (original_cell.oxygen > 2) {
				var oxygen_supplied = Math.min(dt * 1, Math.max(0, Math.min(globals.character.max_oxygen
							       - globals.character.oxygen,
							       original_cell.oxygen)));
				globals.character.oxygen += oxygen_supplied;
				original_cell.oxygen -= oxygen_supplied;
			}
		}
		if (globals.character.welder > 0 && welder_flame_pos) {
			temperature += 2;
			if (welder_flame_pos.breach > 0) {
				welder_flame_pos.breach = Math.max(0, welder_flame_pos.breach - dt);
			}
			if (welder_flame_pos.door_health > 0) {
				welder_flame_pos.door_health = Math.max(0, welder_flame_pos.door_health - dt);
				if (welder_flame_pos.door_health == 0) {
					welder_flame_pos.type = "open";
				}
			}
			if (Math.random() < welder_flame_pos.oxygen * dt * .0075) {
				mapg.add_fire(welder_flame_pos);
				core.log("Something caught on fire from welding!");
			}
			oxygen_req += dt * 1;
		}
		if (oxygen_req > 0) {
			var oxygen_taken = Math.min(oxygen_req, globals.character.oxygen);
			globals.character.oxygen -= oxygen_taken;
			oxygen_req -= oxygen_taken;
		}
		if (oxygen_req > 0) {
			globals.character.health -= oxygen_req * 5;
		}
		for (var i = 0; i < globals.objs.length; i++) {
			var obj = globals.objs[i];
			obj.update_function(dt);
		}

		var temperature_differential = globals.character.temperature
						- m_temp * .5;
		if (temperature_differential > 0) {
			temperature -= Math.min(.6, temperature_differential * .1);
		}
		globals.character.temperature = Math.min(Math.max(0,
						globals.character.temperature + (temperature - .5) * dt),
						m_temp);
	
		if (globals.character.temperature < m_temp * .2) {
			globals.character.health -= ((m_temp * .2) - globals.character.temperature) * 2 * dt;
		}
		if (globals.character.temperature > m_temp * .8) {
			globals.character.health -= (-(m_temp * .8) + globals.character.temperature) * 2 * dt;
		}
		if (globals.character.health < 0) {
			if (globals.character.temperature < m_temp * .2) {
				core.log("You have froze to death");
			}
			if (globals.character.temperature > m_temp * .8) {
				core.log("You have burned to death");
			}
			if (globals.character.oxygen < 0) {
				core.log("You have suffocated to death");
			}
			if (globals.character.hunger < 0) {
				core.log("You have starved to death");
			}
			core.log("You have died");
			core.reset();
		}
		if (globals.red_overlay_alpha > 0) {
			globals.red_overlay_alpha = Math.max(0, globals.red_overlay_alpha - dt);
		}
		globals.current_cell = globals.character.cell;
	},
	check_position: function (x,y) {
		if (mapg.in_bounds(x,y)) {
			var room = globals.map_grid[mapg.indexof(x,y)];
			if (room) {
				return room;
			}
		}
		return undefined;
	}
};

var buildings = {
	rubble: function(building) {
		return buildings.generic_salvage(building, 3, 1, 1);
	},
	autopilot: function(building) {
		building.power = -100;
		return function (dt) {
			globals.on_course = !!building.cell.powered;
		};
	},
	engine: function(building) {
		building.power = -200;
		return function (dt) {
			globals.distance -= globals.on_course * building.cell.powered * dt;
			if (globals.distance <= 0) {
				console.log("WIN");
				core.reset();
			}
		};
	},
	generic_salvage: function(building, hp, min, max, passable) {
		building.power = -1;
		passable = !!passable;
		building.cell.passable = passable;
		return function (dt) {
			if (globals.character.welder) {
				var flame_pos = globals.character.get_welder_flame();
				var in_flame = flame_pos.equals(building.cell);
			} else {
				var in_flame = false;
			}
			if (!passable) {
				var bump_pos = globals.character.next_cell;
			} else {
				var bump_pos = globals.character.cell;
			}
			var moving_in = bump_pos.equals(building.cell);

			hp -= dt * (in_flame * 1 + moving_in * .33);
			if (hp <= 0) {
				core.remove_building(building);
				if (!passable)
					building.cell.passable = true;
				var scraps = utilities.random_interval(min, max+1);
				globals.character.scraps += scraps;
				core.log("You have picked up " + scraps + " " + (scraps > 1 ? "scraps" : "scrap"));
			}
		};
	},
	small_salvage: function(building) {
		return buildings.generic_salvage(building, 1, 1, 3, true);
	},
	medium_salvage: function(building) {
		return buildings.generic_salvage(building, 1.5, 3, 7, true);
	},
	large_salvage: function(building) {
		return buildings.generic_salvage(building, 3, 5, 10, true);
	},
	terminal: function(building) {
		building.power = -25;
		return function (dt) {
			building.cell.room.powered = building.cell.powered;
		};
	},
	life_support: function(building) {
		building.power = -10;
		return function (dt) {
			var cell = building.cell;
			var powered = cell.powered;
			var multiplier = powered ? 10 : 3;
			cell.oxygen = Math.min(cell.oxygen + dt * multiplier/3, 5 * multiplier);
		};
	},
	spawn_function: function(building, timer, type) {
		var time = 0;
		return function (dt) {
			var cell = building.cell;
			var powered_multiplier = cell.powered ? 1: 0;
			time += powered_multiplier * dt;
			if (time > timer) {
				time = 0;
				var neighbors = building.cell.grid_neighbors(function (n) {
					return n && n.passable;
				});
				var neighbor = neighbors[utilities.random_interval(0, neighbors.length)];
				if (mapg.nothing_at(neighbor.x, neighbor.y)) {
					globals.item_map[mapg.indexof(neighbor.x, neighbor.y)] =
						{type:type, amount:1};
				}
			}
		}
	},
	kitchen: function(building) {
		building.power = -50;
		return buildings.spawn_function(building, 5, "food");
	},
	food_generator: function(building) {
		building.power = -25;
		return buildings.spawn_function(building, 15, "food");
	},
	medical_bay: function(building) {
		building.power = -50;
		var sp = buildings.spawn_function(building, 10, "medipack");
		return function (dt) {
			sp(dt);
			if (building.cell.powered &&
					mapg.m_dist(globals.character.cell, building.cell) < 2) {
				globals.character.health = Math.min(globals.character.max_health,
								globals.character.health + dt * 3);
			}
		}
	},
	replicator: function(building) {
		building.power = -70;
		var time = 0;
		var timer = 1;
		var scrap_req = 1;
		return function (dt) {
			var cell = building.cell;
			var powered_multiplier = cell.powered ? 1: 0;
			time += powered_multiplier * dt;
			if (time > timer && globals.character.scraps > scrap_req) {
				time = 0;
				var neighbors = building.cell.grid_neighbors(function (n) {
					return n && n.passable;
				});
				var neighbor = neighbors[utilities.random_interval(0, neighbors.length)];
				if (mapg.nothing_at(neighbor.x, neighbor.y)) {
					globals.character.scraps -= scrap_req;
					globals.item_map[mapg.indexof(neighbor.x, neighbor.y)] =
						{type:"wire", amount:5};
				}
			}
		}
	},
	reactor: function(building) {
		building.power = 50;
		return function (dt) {};
	}
};
var rooms = {
	add_salvage: function(room, min, max) {
		var types = {small:0, medium:0, large:0};
		var number = utilities.random_interval(min, max+1);
		if (number <= 0) {return;}
		for (var i = min; i < max + 1; i++) {
			var rn = Math.random();
			if (rn < .1) {
				types.large += 1;
			}
			else if (rn < .35) {
				types.medium += 1;
			}
			else {
				types.small += 1;
			}
		}
		rooms.add_building(room, "small_salvage", types.small, types.small);
		rooms.add_building(room, "medium_salvage", types.medium, types.medium);
		rooms.add_building(room, "large_salvage", types.large, types.large);
	},
	add_building: function(room, building, min, max) {
		var number = utilities.random_interval(min, max + 1);
		var x = room.origin.x + utilities.random_interval(0, room.dimensions.width);
		var y = room.origin.y + utilities.random_interval(0, room.dimensions.height);
		var count = 10;
		for (var i = 0; i < number; i++ ) {
			while (globals.building_map[mapg.indexof(x,y)]) {
				x = room.origin.x + utilities.random_interval(0, room.dimensions.width);
				y = room.origin.y + utilities.random_interval(0, room.dimensions.height);
				count -= 1;
				if (count == 0) {return;} 
			}
			core.add_building(building,x,y);
		}
	},
	freezer: function (room) {
		rooms.add_salvage(room, 5, 15);
		return function (dt) {
			if (room.powered) {
				room.heat = -3;
			} else {
				room.heat = -.5;
			}
		};
	},
	kitchen: function (room) {
		room.heat = .2;
		rooms.add_building(room, "kitchen", 1, 1);
		rooms.add_building(room, "food_generator", 1, 3);
		rooms.add_salvage(room, -3, 6);
	},
	engines: function (room) {
		rooms.add_building(room, "engine", 1, 1);
		rooms.default_function(room);
	},
	bridge: function (room) {
		rooms.add_building(room, "autopilot", 1, 1);
		rooms.default_function(room);
	},
	mini_reactor: function (room) {
		rooms.add_building(room, "reactor", 3, 5);
		rooms.add_salvage(room, -1, 2);
	},
	large_reactor: function (room) {
		rooms.add_building(room, "reactor", 5, 10);
		rooms.add_salvage(room, -1, 4);
	},
	medical_bay: function (room) {
		var time = 0;
		rooms.add_building(room, "medical_bay", 1, 2);
		return function (dt) {
			var powered_multiplier = room.powered ? 1: 0;
			time += powered_multiplier * dt;
			if (time > 30) {
				time = 0;
				var x = room.origin.x + utilities.random_interval(0, room.dimensions.width);
				var y = room.origin.y + utilities.random_interval(0, room.dimensions.height);
				if (!globals.item_map[mapg.indexof(x,y)]) {
					globals.item_map[mapg.indexof(x,y)] = {type:"medipack", amount:1};
				}
			}
		}
		rooms.add_salvage(room, -2, 2);
	},
	cargo: function (room) {
		var add_food = function () {
			var x = room.origin.x + utilities.random_interval(0, room.dimensions.width);
			var y = room.origin.y + utilities.random_interval(0, room.dimensions.height);
			if (mapg.nothing_at(x, y)) {
				globals.item_map[mapg.indexof(x,y)] = {type:"food", amount:1};
			}
		}
		rooms.add_salvage(room, 4, 6);
		while(Math.random() > .2) {
			add_food();
		}
	},
	life_support: function (room) {
		rooms.add_building(room, "life_support", 3, 5);
		rooms.add_salvage(room, -3, 2);
	},
	default_function: function (room) {
		var add_item = function (type, amount) {
			var x = room.origin.x + utilities.random_interval(0, room.dimensions.width);
			var y = room.origin.y + utilities.random_interval(0, room.dimensions.height);
			if (!globals.item_map[mapg.indexof(x,y)]) {
				globals.item_map[mapg.indexof(x,y)] = {type:type, amount:amount};
			}
		}
		while(Math.random() < .5) {
			add_item("food",1);
		}
		while(Math.random() < .5) {
			add_item("wire",utilities.random_interval(1,5));
		}
		while(Math.random() < .2) {
			add_item("oxygen_tank",1);
		}
		while(Math.random() < .2) {
			add_item("empty_tank",1);
		}
		rooms.add_salvage(room, -3, 5);
	},
	all_function: function (room) {
		if (Math.random() < .4) {
			rooms.add_building(room, "rubble", 8, 20);
		}
		rooms.add_building(room, "terminal", 1, 1);
		if (Math.random() < .2) {
			rooms.add_building(room, "replicator", 1, 1);
		}
	}
};
var items = {
	food: function(item) {
		var amount = item.quality || 10;
		globals.character.hunger = Math.min(globals.character.max_hunger, globals.character.hunger + amount);
		return 1;
	},
	empty_tank: function(item) {
		if (globals.character.cell.oxygen > 10) {
			globals.character.cell.oxygen -= 10;
			globals.inventory.add_item("oxygen_tank", 1);
			return 1;
		}
		return 0;
	},
	oxygen_tank: function(item) {
		var amount = item.quality || 25;
		if (globals.character.oxygen < globals.character.max_oxygen - 1) {
			globals.character.oxygen = Math.min(globals.character.max_oxygen, globals.character.oxygen + amount);
			globals.inventory.add_item("empty_tank", 1);
			return 1;
		}
		return 0;
	},
	welder: function(item) {
		item.in_use = !item.in_use;
		if (item.in_use) {
			console.log("welder on");
			globals.character.welder += 1;
		} else {
			console.log("welder off");
			globals.character.welder -= 1;
		}
		return 0;
	},
	medipack: function(item) {
		var amount = item.quality || 10;
		globals.character.health = Math.min(globals.character.max_health, globals.character.health + amount);
		return 1;
	},
	wire: function (item) {
		var grid_point = core.screen_to_grid_index(globals.mousePos);
		var next_cell = core.check_position(grid_point.x, grid_point.y);
		var dx = next_cell.x - globals.current_cell.x;
		var dy = next_cell.y - globals.current_cell.y;
		var distance = Math.sqrt(dx*dx + dy*dy);
		if (next_cell && next_cell.passable && distance < 2.5) {
			if (!next_cell.wired) {
				next_cell.wired =  true;
				globals.wires[next_cell.hash_cell()] = next_cell;
				mapg.recalculate_power();
				return 1;
			}
		}
		return 0;
	},
	wire_cutter: function (item) {
		var grid_point = core.screen_to_grid_index(globals.mousePos);
		var next_cell = core.check_position(grid_point.x, grid_point.y);
		var dx = next_cell.x - globals.current_cell.x;
		var dy = next_cell.y - globals.current_cell.y;
		var distance = Math.sqrt(dx*dx + dy*dy);
		if (next_cell && next_cell.passable && distance < 2.5) {
			if (next_cell.wired) {
				next_cell.wired =  false;
				next_cell.reset_power();
				delete globals.wires[next_cell.hash_cell()];
				mapg.recalculate_power();
				globals.inventory.add_item("wire", 1);
			}
		}
		return 0;
	}
};

var utilities = {
	dfs: function(root, adjacent) {
		var results = new JS.Set([root]);
		var node_stack = adjacent(root);
		while (node_stack.length > 0) {
			var next = node_stack.pop();
			results.add(next);
			var adjacent_nodes = adjacent(next);
			for (var i = 0; i < adjacent_nodes.length; i++) {
				var neighbor = adjacent_nodes[i];
				if (!results.contains(neighbor)) {
					node_stack.push(neighbor);
				}
			}
		}
		return results.entries();
	},
	angular_distance: function(a, b) {
		var raw = Math.abs(b - a);
		while (raw > Math.PI * 2) {
			raw -= Math.PI * 2;
		}
		return Math.PI - Math.abs(raw - Math.PI);
	},
	signed_angular_distance: function(a, b) {
		var dist = utilities.angular_distance(a, b);
		var d1 = utilities.angular_distance(a + dist, b);
		var d2 = utilities.angular_distance(a, b + dist);
		if (d1 > d2) {
			return -dist;
		} else {
			return dist;
		}
	},
	bresenham_line: function(a, b) {
		/**
		 * does a straight line from a to b
		 * using bresenham's line algorithm
		 */
		var a = {x:a.x, y:a.y};
		var b = {x:b.x, y:b.y};
		var dx = Math.abs(b.x - a.x);
		var dy = Math.abs(b.y - a.y);
		var sx, sy;
		if (a.x < b.x) { sx = 1; } else { sx = -1; }
		if (a.y < b.y) { sy = 1; } else { sy = -1; }
		var err = dx - dy;
		var next_cell = function () {
			var res = {x:a.x, y:a.y};
			if (a.x == b.x && a.y == b.y) { return undefined; }
			var e2 = 2 * err;
			if (e2 > -dy) {
				err = err - dy;
				a.x += sx;
			}
			if (e2 < dx) {
				err = err + dx;
				a.y += sy;
			}
			return res;
		}
		return next_cell;
	},
	random_interval: function(a, b) {
		return Math.floor(Math.random() * (b - a) + a);
	},
	shuffle_array: function(arr) {
		for (var i = arr.length - 1; i >= 0; i--) {
			var n = utilities.random_interval(0,i);
			var temp = arr[i];
			arr[i] = arr[n];
			arr[n] = temp;
		}
		return arr;
	},
	interpolate: function (val, y0, x0, y1, x1) {
		    return (val-x0)*(y1-y0)/(x1-x0) + y0;
	},
	colormap_jet: function(value, extra) {
		var base = function(val) {
		    if (val <= -0.75) return 0;
		    else if (val <= -0.25) return utilities.interpolate( val, 0.0, -0.75, 1.0, -0.25 );
		    else if (val <= 0.25) return 1.0;
		    else if (val <= 0.75) return utilities.interpolate( val, 1.0, 0.25, 0.0, 0.75 );
		    else return 0.0;
		}
		value = Math.max(Math.min(1, value),-1);
		extra = extra || 0;
		var red = Math.round(base(value - 0.5) * 255 * extra);
		var green = Math.round(base(value) * 255 * extra);
		var blue = Math.round(base(value + 0.5) * 255 * extra);
		return "rgb(" + red + ", " + green + ", " + blue + ")";
	}
}

var mapg = {
	nothing_at: function(x, y) {
		var char_at = globals.character.cell && globals.character.cell.x == x && globals.character.cell.y == y;
		return !globals.item_map[mapg.indexof(x,y)] && !globals.building_map[mapg.indexof(x,y)] &&
			!char_at;
	},
	hash_room: function(room) {
		if (room) {
			return room.origin.x + ", " + room.origin.y;
		} else {
			return undefined;
		}
	},
	m_dist: function(from, to) {
		if (from.x) {
			return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
		} else {
			return Math.abs(to.origin.x - from.origin.x)
				+ Math.abs(to.origin.y - from.origin.y);
		}
	},
	room_a_star: function(from, to) {
		var hash_room = function(room) {
			return room.origin.x + room.origin.y * globals.bounds.width;
		};
		var n_func = function(room) {
			var neighbors = [];
			var costs = [];
			var adjacents = room.neighbors;
			for (var i = 0; i < adjacents.length; i++) {
				var other = adjacents[i].room;
				var door = adjacents[i].door;
				if (door.passable) {
					neighbors.push(other);
					costs.push(m_dist(room, other));
				}
			}
			return {nodes:neighbors, costs:costs};
		}
		return mapg.a_star(from, to, hash_room, m_dist, n_func);
	},
	grid_a_star: function(from, to) {
		var hash_cell = function(cell) {
			return cell.x + cell.y * globals.bounds.width;
		};
		var n_func = function(cell) {
			var neighbors = [];
			var costs = [];
			var adjacents = cell.neighbors();
			var diags = cell.neighbors();
			for (var i = 0; i < adjacents.length; i++) {
				var other = globals.map_grid[mapg.indexof(adjacents[i])];
				if (other && other.passable) {
					neighbors.push(other);
					costs.push(1);
				}
			}
			for (var i = 0; i < diags.length; i++) {
				var other = globals.map_grid[mapg.indexof(diags[i])];
				if (other && other.passable) {
					neighbors.push(other);
					costs.push(1.414);
				}
			}
			return {nodes:neighbors, costs:costs};
		}
		
		return mapg.a_star(from, to, hash_cell, mapg.m_dist, n_func);
	},
	a_star: function (from, to, hash_func, h_func, n_func) {
		var closed_set = [];
		var open_set = new BinaryHeap(function(cell) {
			var chash = hash_func(cell);
			return f_score[chash];
		});
		var tohash = hash_func(to);
		open_set.push(from);
		var came_from = {};
		var visited_set = [];
		visited_set[hash_func(from)] = true;

		var g_score = {};
		var f_score = {};
		g_score[hash_func(from)] = 0;
		f_score[hash_func(from)] = h_func(from, to);

		var add_neighbors = function(neighbors) {
			var nodes = neighbors.nodes;
			var costs = neighbors.costs;
			for (var i = 0; i < nodes.length; i++) {
				var other = nodes[i];
				var cost = costs[i];
				var ohash = hash_func(other);
				if (closed_set[ohash]) {
					continue;
				}
				var temp_g_score = g_score[bhash] + cost;
				var visited = !!visited_set[ohash];
				if (!visited || temp_g_score < g_score[ohash]) {
					came_from[ohash] = best;
					g_score[ohash] = temp_g_score;
					f_score[ohash] = g_score[ohash] + h_func(other, to);
					if (!visited) {
						open_set.push(other);
						visited_set[ohash] = true;
					} else {
						open_set.rescoreElement(other);
					}
				}
			}
		}
		while (open_set.size() > 0) {
			var best = open_set.pop();
			var bhash = hash_func(best);
			if (bhash == tohash) {
				var head = best;
				var ret = [best];
				var parent = came_from[bhash];
				while (parent) {
					ret.push(parent);
					parent = came_from[hash_func(parent)];
				}
				return ret;
			}
			closed_set[bhash] = true;
			var neighbors = n_func(best);
			add_neighbors(neighbors);
		}
		return [];
	},
	occluded: function (from, to) {
		var next_cell = utilities.bresenham_line(from, to);
		var cell = next_cell();
		while (cell) {
			if (!globals.map_grid[mapg.indexof(cell)].passable) {
				return true;
			}
			cell = next_cell();
		}
		return false;
	},
	in_bounds: function (x, y) {
		if (y != undefined) {
			return x >= 0 && x < globals.bounds.width && y >= 0 && y < globals.bounds.height;
		} else {
			return x.x >= 0 && x.x < globals.bounds.width && x.y >= 0 && x.y < globals.bounds.height;
		}
	},
	cell_at: function(x, y) {
		var i = y * globals.bounds.width + x;
		return globals.map_grid[i];
	},
	indexof: function(x,y) {
		if (y != undefined) {
			return y * globals.bounds.width + x;
		} else {
			return x.y * globals.bounds.width + x.x;
		}
	},
	add_fire: function (cell) {
		if (cell.fire) {return;}
		var new_fire = {cell:cell, spread:0};
		globals.fires.push(new_fire);
		cell.fire = new_fire;
		if (cell.wired) {
			cell.wired =  false;
			cell.reset_power();
			delete globals.wires[cell.hash_cell()];
			mapg.recalculate_power();
		}
	},
	propagate_flames: function(dt) {
		var dead_flames = [];
		var new_flames = [];
		globals.fires.forEach(function (flame) {
			flame.cell.oxygen = Math.max(0, flame.cell.oxygen - 2.5 * dt);
			if (flame.cell.oxygen == 0) {
				dead_flames.push(flame);
				flame.cell.fire = false;
			} else {
				flame.spread += dt;
				if (flame.spread > 2) {
					flame.spread = 0;
					var others = flame.cell.grid_neighbors(function (cell) {
						return cell && cell.passable && !cell.fire && cell.oxygen > .5;});
					if (others.length > 0) {
						var s_index = utilities.random_interval(0,others.length);
						var cell = others[s_index];
						var new_fire = {cell:cell, spread:0};
						new_flames.push(new_fire);
						cell.fire = new_fire;
						if (cell.wired) {
							cell.wired =  false;
							cell.reset_power();
							delete globals.wires[cell.hash_cell()];
							mapg.recalculate_power();
						}
					}
				}
			}
		});
		if (dead_flames.length > 0)
		console.log(globals.fires, dead_flames);
		globals.fires = _.difference(globals.fires, dead_flames);
		if (dead_flames.length > 0)
		console.log(globals.fires);
		globals.fires = globals.fires.concat(new_flames);
	},
	check_for_short: function() {
		globals.wiresets.forEach(function (set) {
			var n = set[utilities.random_interval(0,set.length)];
			var extra_power = n.power_source - n.power_load;
			var possibility = (n.power_load - extra_power) / 10000;
			if (n.powered && Math.random() < possibility) {
				core.log("A wire has caught on fire!")
				mapg.add_fire(n);
			}
		});
	},
	diffuse_oxygen: function() {
		for (var y = 1; y < globals.bounds.height - 1; y++) {
			for (var x = 1; x < globals.bounds.width - 1; x++) {
				var cell = mapg.cell_at(x,y);
				if (cell && cell.passable) {
					var others = cell.grid_neighbors(function (cell) {return cell && cell.passable});
					var oxygen = cell.oxygen + _.reduce(others, function (o, a) {return o + a.oxygen;}, 0);
					cell.next_oxygen = oxygen / (others.length + 1);
				}
			}
		}
		for (var y = 1; y < globals.bounds.height - 1; y++) {
			for (var x = 1; x < globals.bounds.width - 1; x++) {
				var cell = mapg.cell_at(x,y);
				if (cell && cell.passable) {
					var escaped_oxygen = cell.breach * 5;
					var min_oxygen = cell.breach * -20;
					cell.oxygen = Math.max(cell.next_oxygen - escaped_oxygen, min_oxygen);
				}
			}
		}
	},
	collect_wiresets: function () {
		var wires = [];
		var keys = _.map(_.values(globals.wires), function (n) {return n.hash_cell()});
		var working_keys = keys;
		var wiresets = [];
		var power_sources = {};
		while (working_keys.length > 0) {
			var current_key = working_keys[0];
			var current_wire = globals.wires[current_key];
			var connected_wires = utilities.dfs(current_key, function (node) {
				var ret = [];
				var neighbors = globals.wires[node].neighbors_with(
					function (n) {
					var g = globals.map_grid[mapg.indexof(n)];
					return g && g.wired;});
				neighbors.forEach(function (n) {ret.push(n.hash_cell())});
				return ret;
			});
			var new_set = [];
			for (var i = 0; i < connected_wires.length; i++) {
				new_set.push(globals.wires[connected_wires[i]]);
			}
			wiresets.push(new_set);
			working_keys = _.difference(working_keys, connected_wires);
		}
		wiresets.forEach(function (wireset) {
			wireset.forEach(function (wire) {
				if (power_sources[mapg.hash_room(wire.room)]) {
					power_sources[mapg.hash_room(wire.room)].add(wireset);
				} else {
					power_sources[mapg.hash_room(wire.room)] = new JS.Set([wireset]);
				}
			});
		});
		return wiresets;
	},
	recalculate_power: function() {
		_.values(globals.wires).forEach(function (n) {
			n.reset_power();
		});
		var wiresets = mapg.collect_wiresets();
		globals.wiresets = wiresets;
		globals.rooms.forEach(function (room) {room.powered = room.power_src > 0;});
		wiresets.forEach(function (wireset) {
			var room_set = new JS.Set();
			var power_available = 0;
			var power_load = 0;
			var power_source = 0;
			for (var i = 0; i < wireset.length; i++) {
				var wire = wireset[i];
				var building = globals.building_map[mapg.indexof(wire.x, wire.y)];
				if (building) {
					power_available += building.power;
					if (building.power < 0) {
						power_load -= building.power;
					} else {
						power_source += building.power;
						console.log(power_source);
					}
				} else {
					power_available -= 1;
					power_load += 1;
				}
			}
			var enough_power = power_available > 0;
			room_set.entries().forEach(function (room) {
				if (room.power_src <= 0) {
					room.powered |= enough_power;
				} else {
					room.powered = true;
				}
			});
			wireset.forEach(function (wire) {
				wire.powered = enough_power;
				wire.power_load = power_load;
				wire.power_source = power_source;
				var building = globals.building_map[mapg.indexof(wire)];
				if (building && building.power < 0 && wire.prev_powered != wire.powered) {
					if (wire.powered) {
						core.log(building.type + " was powered");
					} else {
						core.log(building.type + " was unpowered");
					}
				}
			});
		});
	},
	generate_room_graph: function(min_rooms, width, height) {
		var rooms = [];
		var types_added = {};
		var tWeight = 0;
		var map_grid = globals.map_grid;
		globals.kitchens = [];
		utilities.shuffle_array(globals.room_data);
		//first fill the graph with minimal rooms
		for (var i = 0; i < globals.room_data.length; i++) {
			var room_type = room_data[i];
			room_type.type_index = i;
			globals.room_types[room_type.name] = room_type;
			types_added[room_type.name] = 0;
			tWeight += room_type.rarity;
			room_type.cWeight = tWeight;
			for (var j = 0; j < room_type.min; j++) {
				rooms.push({"name": room_type.name});
				types_added[room_type.name] += 1;
			}
		}
		function random_room() {
			var rn = utilities.random_interval(0, tWeight);
			for (var i = 0; i < globals.room_data.length; i++) {
					var room_type = room_data[i];
					if (room_type.cWeight >= rn) {
						return room_type;
					}
			}
			return room_data[room_data.length]
		}
		//add rooms until the min_rooms parameter has been exceeded
		while(rooms.length < min_rooms) {
			var room_type = random_room();
			if (!room_type.max || types_added[room_type.name] < room_type.max) {
				rooms.push({"name": room_type.name});
				types_added[room_type.name] += 1;
			}
		}
		utilities.shuffle_array(rooms);
		
		
		var rotate_room = function (room, n) {
			var r_room = {"origin":{}, "dimensions":{}};
			//rotates the room n times 90 degrees clockwise
			if (n % 4 == 1) {
				r_room.origin.x = room.origin.x;
				r_room.origin.y = room.origin.y - (room.dimensions.width - 1);
				r_room.dimensions.width = room.dimensions.height;
				r_room.dimensions.height = room.dimensions.width;
			} else if (n % 4 == 2) {
				r_room.origin.x = room.origin.x - (room.dimensions.width - 1);
				r_room.origin.y = room.origin.y - (room.dimensions.height - 1);
				r_room.dimensions.width = room.dimensions.width;
				r_room.dimensions.height = room.dimensions.height;
			} else if (n % 4 == 3) {
				r_room.origin.x = room.origin.x - (room.dimensions.height - 1);
				r_room.origin.y = room.origin.y;
				r_room.dimensions.width = room.dimensions.height;
				r_room.dimensions.height = room.dimensions.width;
			} else {
				r_room.origin.x = room.origin.x;
				r_room.origin.y = room.origin.y;
				r_room.dimensions.width = room.dimensions.width;
				r_room.dimensions.height = room.dimensions.height;
			}
			return r_room;
		}
		var place_room = function (room, grid) {
			var cells_displaced = new JS.Set();
			if (!room || !room.dimensions || !room.origin) {
				return cells_displaced;
			}
			var bad;
			var r_room;
			var n;	
			angle_loop:
			for (n = 0; n < 4; n++) {
				bad = false;
				r_room = rotate_room(room, n);
				room_loop:
				for (var y = r_room.origin.y; y < r_room.origin.y + r_room.dimensions.height; y++) {
					for (var x = r_room.origin.x; x < r_room.origin.x + r_room.dimensions.width; x++) {
						if (!mapg.in_bounds(x,y)) {
							bad = true;
							break room_loop;
						}
						var cell = map_grid[mapg.indexof(x,y)];
						if (cell && cell.type != "open") {
							bad = true;
							break room_loop;
						}
					}
				}
				if (!bad) {
					break angle_loop;
				}
			}
			if (bad) {
				//room cannot be placed. try somewhere else
				return false;
			}

			for (var y = r_room.origin.y; y < r_room.origin.y + r_room.dimensions.height; y++) {
				for (var x = r_room.origin.x; x < r_room.origin.x + r_room.dimensions.width; x++) {
					var cell = map_grid[mapg.indexof(x,y)];
				}
			}

			room.origin = r_room.origin;
			room.dimensions = r_room.dimensions;
			for (var y = room.origin.y; y < room.origin.y + room.dimensions.height; y++) {
				for (var x = room.origin.x; x < room.origin.x + room.dimensions.width; x++) {
					var index = mapg.indexof(x,y);
					var cell = map_grid[index];
					if (cell) {
						cells_displaced.add(cell);
					} else {
						var breach = Math.random() < defaults.breach_chance ? Math.random() + 1 : 0;
						cell = new core.Cell(x,y);
						cell.breach = breach;
						map_grid[mapg.indexof(x,y)] = cell;
					}
					cell.set_room(room);
				}
			}
			return cells_displaced;
		}
		
		var hash_room = function (room) {
			if (room) {
				return room.origin.x + ", " + room.origin.y;
			} else {
				return undefined;
			}
		}
		var add_walls = function (room, grid, wall_set) {
			var new_cells = [];
			if (!room || !room.dimensions || !room.origin) {
				return;
			} 
			for (var y = room.origin.y - 1; y < room.origin.y + room.dimensions.height + 1; y++) {
				var new_cell = new core.Cell(room.origin.x - 1, y);
				var new_cell2 = new core.Cell(room.origin.x + room.dimensions.width, y);
				new_cells.push(new_cell);
				new_cells.push(new_cell2);
			}
			for (var x = room.origin.x; x < room.origin.x + room.dimensions.width; x++) {
				var new_cell = new core.Cell(x, room.origin.y - 1);
				var new_cell2 = new core.Cell(x, room.origin.y + room.dimensions.height);
				new_cells.push(new_cell);
				new_cells.push(new_cell2);
			}
			var can_be_door = function (cell, neighboring_rooms) {
				var room_neighbors = cell.neighbors_with(function(c){
					if (mapg.in_bounds(c)) {
						var other_cell = grid[mapg.indexof(c)];
						if (other_cell && other_cell.type == "room") {
							neighboring_rooms.add(other_cell.room);
							return true;
						}
					}
				});
				return room_neighbors.length > 1;
			}
			var connecting_rooms = new JS.Set();
			var room_map = {};
			var viable_doors = {};
			var neighboring_rooms = new JS.Set();
			for (var i = 0; i < new_cells.length; i++) {
				var cell = new_cells[i];
				neighboring_rooms.clear();
				if (mapg.in_bounds(cell)) {
					var grid_index = mapg.indexof(cell);
					var grid_cell = grid[grid_index];
					if (!grid_cell) {
						grid[grid_index] = cell;
						cell.passable = false;
						cell.type = "wall";
						wall_set.add(cell);
					} else if (grid_cell.type == "wall"
						   && can_be_door(grid_cell, neighboring_rooms)) {
						neighboring_rooms.remove(room);
						var neighboring_room = neighboring_rooms.entries()[0];
						var neighbor = hash_room(neighboring_room);
						connecting_rooms.add(neighbor);
						room_map[neighbor] = neighboring_room;
						if (viable_doors[neighbor]) {
							viable_doors[neighbor].push(grid_cell);
						} else {
							viable_doors[neighbor] = [grid_cell];
						}
					}
				}
			}
			var connecting_rooms = connecting_rooms.entries();
			for (var i = 0; i < connecting_rooms.length; i++) {
				var room_hash = connecting_rooms[i];
				var connecting_room = room_map[room_hash];
				var doors = viable_doors[room_hash];
				if (doors) {
					var cell = doors[utilities.random_interval(0,doors.length)];
					cell.type = "door";
					cell.door_health = 5;
					cell.passable = utilities.random_interval(0,2) == 1;
					wall_set.remove(cell);
					room.connections.push({room:connecting_room, door:cell});
					connecting_room.connections.push({room:room, door:cell});
				}
			}
		}
		var add_open_cells = function (room, grid, open_set) {
			var new_cells = [];
			if (!room || !room.dimensions || !room.origin) {
				return;
			} 
			for (var y = room.origin.y; y < room.origin.y + room.dimensions.height; y++) {
				var new_cell = new core.Cell(room.origin.x - 2, y);
				var new_cell2 = new core.Cell(room.origin.x + room.dimensions.width + 1, y);
				new_cells.push(new_cell);
				new_cells.push(new_cell2);
			}
			for (var x = room.origin.x; x < room.origin.x + room.dimensions.width; x++) {
				var new_cell = new core.Cell(x, room.origin.y - 2);
				var new_cell2 = new core.Cell(x, room.origin.y + room.dimensions.height + 1);
				new_cells.push(new_cell);
				new_cells.push(new_cell2);
			}
			//loop through the new open cells and try to add them to the grid. 
			for (var i = 0; i < new_cells.length; i++) {
				var cell = new_cells[i];
				if (mapg.in_bounds(cell)) {
					var grid_index = mapg.indexof(cell);
					var grid_cell = grid[grid_index];
					if (!grid_cell) {
						open_set.add(cell);
					}
				}
			}
		}
		var rooms_placed = 0;
		var i = 0;
		globals.walls = new JS.Set();
		/* place next room callback */
		var place_next_room = function() {
			if (i >= rooms.length) {
				return undefined;
			}
			var open_set = new JS.Set();
			for (var ri = 0; ri < rooms.length; ri++) {	
				add_open_cells(rooms[ri], map_grid, open_set);
			}
			var entries = open_set.entries();
			var room = rooms[i];
			if (entries.length == 0) {
				//if no rooms has been placed, place the first one in the center
				room.dimensions = {};
				room.dimensions.width = utilities.random_interval(defaults.room_min, defaults.room_max);
				room.dimensions.height = utilities.random_interval(defaults.room_min, defaults.room_max);
				room.origin = {};
				room.origin.x = Math.floor(width/2);
				room.origin.y = Math.floor(height/2);
			} else {
				var open_index = utilities.random_interval(0, entries.length);
				room.dimensions = {};
				room.dimensions.width = utilities.random_interval(defaults.room_min, defaults.room_max);
				room.dimensions.height = utilities.random_interval(defaults.room_min, defaults.room_max);
				room.origin = entries[open_index];
			}
			room.type = room.name;
			room.connections = [];
			if (globals.powered_rooms[room.type]) {
				room.powered = true;
				room.heat = 1;
				room.power_src = globals.powered_rooms[room.type];
			} else {
				room.powered = false;
				room.heat = 0;
				room.power_src = 0;
			}
			var dead_cells = place_room(room, map_grid);
			var tries = 0;
			while (!dead_cells) {
				var open_index = utilities.random_interval(0, entries.length);
				room.origin = entries[open_index];
				dead_cells = place_room(room, map_grid);
				if (tries > 10) {
					//give up and place a 1 square room.
					room.dimensions.width = 1;
					room.dimensions.height = 1;	
					dead_cells = place_room(room, map_grid);
					break;
				}
			}
			add_walls(room, map_grid, globals.walls);
			globals.open_cells = open_set;
			globals.rooms = rooms;
			i += 1;
			return room;
		}
		return place_next_room;
	}
}

var draw_functions = {
	draw_bg: function(ctx) {
		var cv = globals.canvas[0];
		ctx.fillStyle = "#000000";
		ctx.fillRect(0, 0, cv.width, cv.height);
	},
	draw_overlay: function(ctx, color) {
		var cv = globals.canvas[0];
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, cv.width, cv.height);
	},
	draw_healthbar: function(ctx, color, percent, offset) {
		var cv = globals.canvas[0];
		ctx.fillStyle = color;
		ctx.fillRect(offset.x, offset.y, 10, 200 * percent);
	},
	draw_distance_bar: function(ctx, percent, offset, width) {
		var cv = globals.canvas[0];
		var sw = globals.screen_bounds.size.width;
		ctx.fillStyle = "#663355";
		ctx.fillRect(20, offset, sw - 40, 10);
		ctx.fillStyle = "white";
		ctx.fillRect(20 + (1 - percent) * sw - width/2, offset, width, 10);
	},
	draw_heatbar: function(ctx, percent, offset, width) {
		var cv = globals.canvas[0];
		var grad = ctx.createLinearGradient(0,0,0,200);
		for (var i = 0; i < 1; i += .1) {
			grad.addColorStop(i, utilities.colormap_jet(1 - i * 2, .8));
		}
		ctx.fillStyle = grad;
		ctx.fillRect(offset.x, offset.y, 10, 200);
		ctx.fillStyle = "white";
		ctx.fillRect(offset.x, offset.y + (1 - percent) * 200 - width/2, 10, width);
	},
	draw_fires: function(ctx, items, cell_width) {
		var line_width =  2;
		ctx.fillStyle = "#BBBB00";
		for (var i = 0; i < items.length; i++) {
			var cell = items[i].cell;
			var startX = cell.x * cell_width - globals.character.origin.x + globals.centroid.x;
			var startY = cell.y * cell_width - globals.character.origin.y + globals.centroid.y;
			var width =  cell_width;
			var height = cell_width;
				var img = globals.images["g_fire"];
			if (img) {
				ctx.drawImage(img, startX, startY);
			}
		}
	},
	draw_objects: function(ctx, objs, cell_width) {
		var line_width =  2;
		ctx.fillStyle = "#BBBB00";
		for (var i = 0; i < objs.length; i++) {
			var obj = objs[i];
			var cell = obj.cell;
			var startX = cell.x * cell_width - globals.character.origin.x + globals.centroid.x;
			var startY = cell.y * cell_width - globals.character.origin.y + globals.centroid.y;
			var width =  cell_width;
			var height = cell_width;
			var img = globals.images["g_" + obj.type];
			if (img) {
				ctx.drawImage(img, startX, startY);
			}
		}
	},
	draw_items: function(ctx, items, cell_width) {
		var line_width =  2;
		ctx.fillStyle = "#BBBB00";
		for (var i = 0; i < items.length; i++) {
			var item = items[i];
			var cell = item.position;
			var startX = cell.x * cell_width - globals.character.origin.x + globals.centroid.x;
			var startY = cell.y * cell_width - globals.character.origin.y + globals.centroid.y;
			var width =  cell_width;
			var height = cell_width;
			var img = globals.images["g_" + item.item.type];
			if (img) {
				ctx.drawImage(img, startX, startY);
			}
		}
	},
	draw_inventory: function(ctx, items, width) {
		var i = 0;
		var offset = {x: 10, y:globals.screen_bounds.size.height - 30 - width};
		ctx.fillStyle = "#00BB00";
		items.forEach(function (item) {
			if (item.in_use) {
				ctx.strokeStyle = "#FFFF66";
				ctx.lineWidth = 2;
			} else {
				ctx.strokeStyle = "#FFFFFF";
				ctx.lineWidth = 1;
			}
			var x = offset.x + i * width * 1.4;
			var y = offset.y;
			ctx.strokeRect(x, y, width, width);
			var img = globals.images[item.type];
			if (img) {
				ctx.drawImage(img, x+14, y+14);
			}
			ctx.fillText(item.amount, x + 2, y + 2);
			i += 1;
		});
	},
	draw_border: function(ctx, width) {
		var cv = globals.canvas[0];
		ctx.strokeStyle = "#000000";
		ctx.strokeRect(0, 0, cv.width, cv.height);
	},
	draw_rooms: function(ctx, rooms, cell_width, line_width) {
		var cv = globals.canvas[0];
		for (var i = 0; i < rooms.length; i++) {
			var room = rooms[i];
			if (!room || !room.dimensions || !room.origin) {
				continue;
			}
			ctx.strokeStyle = "#000000";
			var index = globals.room_types[room.name].type_index;
			var col = (index/globals.room_data.length)*2 - 1;
			if (room.powered) {
				ctx.fillStyle = "#909090";
			} else {
				ctx.fillStyle = "#404040";
			}
			var startX = room.origin.x * cell_width - globals.character.origin.x + globals.centroid.x;
			var width = room.dimensions.width * cell_width;
			var startY = room.origin.y * cell_width - globals.character.origin.y + globals.centroid.y;
			var height = room.dimensions.height * cell_width;
			
			ctx.fillRect(startX , startY, width, height);
			ctx.strokeRect(startX , startY, width, height);
		}
	},
	draw_wires: function(ctx, cells, cell_width, color, line_width) {
		if (line_width == undefined) {
			line_width =  2;
		}
		for (var i = 0; i < cells.length; i++) {
			var cell = cells[i];
			if (cell.powered) {
				ctx.fillStyle = "#00FF00";
			} else {
				ctx.fillStyle = "#AA0000";
			}
			var connectivity = cell.connectivity(function (cell) {return cell && cell.wired});
			var startX = cell.x * cell_width - globals.character.origin.x + globals.centroid.x;
			var startY = cell.y * cell_width - globals.character.origin.y + globals.centroid.y;
			var width =  cell_width;
			var height = cell_width;			
			ctx.fillRect(startX + (width/2 - line_width), startY + (width/2 - line_width),
					line_width * 2, line_width * 2);
			if (connectivity.left) {
				ctx.fillRect(startX-1, startY + (width/2 - line_width),
						width/2 + 1, line_width * 2);
			}
			if (connectivity.right) {
				ctx.fillRect(startX + width/2, startY + (width/2 - line_width),
						width/2 + 1, line_width * 2);
			}
			if (connectivity.bottom) {
				ctx.fillRect(startX + (width/2 - line_width), startY - 1,
						line_width * 2, height/2 + 1);
			}
			if (connectivity.top) {
				ctx.fillRect(startX + (width/2 - line_width), startY + height/2,
						line_width * 2, height/2 + 1);
			}
		}
	},
	draw_cells: function(ctx, cells, cell_width, color, line_width, op_func, op_color) {
		if (line_width == undefined) {
			line_width =  2;
		}
		ctx.fillStyle = color;
		for (var i = 0; i < cells.length; i++) {
			var cell = cells[i];
			if (op_func) {
				var op = op_func(cell);
				var rounded_op = Math.round(op * 256)/256;
				ctx.fillStyle = "rgba(" + op_color + "," + rounded_op + ")";
			}
			var startX = cell.x * cell_width - globals.character.origin.x + globals.centroid.x;
			var startY = cell.y * cell_width - globals.character.origin.y + globals.centroid.y;
			var width =  cell_width;
			var height = cell_width;			
			ctx.fillRect(startX + line_width, startY + line_width,
					width - line_width * 2, height - line_width * 2);
		}
	},
	draw_character: function(ctx, character, size, color) {
		var ox = globals.centroid.x - globals.character.origin.x + character.origin.x;
		var oy = globals.centroid.y - globals.character.origin.y + character.origin.y;
		size = size || 5;
		var x1 = ox + Math.cos(character.facing) * size;
		var y1 = oy + Math.sin(character.facing) * size;
		var x2 = ox + Math.cos(character.facing + 2.35619449) * size;
		var y2 = oy + Math.sin(character.facing + 2.35619449) * size;
		var x3 = ox + Math.cos(character.facing - 2.35619449) * size;
		var y3 = oy + Math.sin(character.facing - 2.35619449) * size;
		ctx.strokeStyle = "#000000";
		ctx.beginPath();
		ctx.moveTo(x1,y1);
		ctx.lineTo(x2,y2);
		ctx.lineTo(x3,y3);
		ctx.lineTo(x1,y1);
		ctx.stroke();
		if (color) {
			ctx.fillStyle = color;
			ctx.fill();
		}
	},
	draw_score: function(ctx, offset, score) {
		ctx.font = "bold 20px " + defaults.font;
		ctx.textBaseline = "top";
		ctx.fillStyle = "#DD0000";
		ctx.fillText("Scraps: " + Math.round(score), offset.x, offset.y);
	},
	draw_tooltip: function(ctx, start, offset, room) {
		var maxW = 0;
		function getLines(ctx,phrase,maxPxLength) {
			var wa=phrase.split(" "),
				phraseArray=[],
				lastPhrase=wa[0],
				l=maxPxLength,
				measure=0;
			if (wa.length == 1) { 
				maxW=ctx.measureText(phrase).width;
				return [phrase];
			}
			for (var i=1;i<wa.length;i++) {
				var w=wa[i];
				measure=ctx.measureText(lastPhrase+w).width;
				maxW = Math.max(measure, maxW);
				if (measure<l) {
					lastPhrase+=(" "+w);
				}else {
					phraseArray.push(lastPhrase);
					lastPhrase=w;
				}
				if (i===wa.length-1) {
					phraseArray.push(lastPhrase);
					break;
				}
			}
			return phraseArray;
		}
		if (!room || !room.type) {
			return;
		}
		var oxygen_string = "oxygen: " + Math.round(globals.character.cell.oxygen * 100) / 100;
		var power_source = globals.character.cell.wired ?
			"power source: " + globals.character.cell.power_source : ""; 
		var power_load = globals.character.cell.wired ?
			"power load: " + globals.character.cell.power_load : ""; 
		var text = (room.name || room.type) + " " + oxygen_string;

		var startX = start.x + offset.x;
		var startY = start.y + offset.y;
		var name_str = text.replace("_"," ");
		var lines = getLines(ctx, name_str, 200);
		if (power_source != "") {
			lines.push(power_source);
			lines.push(power_load);
		}
		var lineHeight = 14;
		var maxH = lines.length * lineHeight;
		ctx.font = "bold 16px " + defaults.font;
		ctx.fillStyle = "rgba(100,150,255,.7)";
		ctx.fillRect(startX, startY, maxW + 20, maxH + 10);
		ctx.fillStyle = "#000000";
		ctx.textBaseline = "top";
		
		for (var i = 0; i < lines.length; i++) {
			ctx.fillText(lines[i], startX + 5, startY + lineHeight * i);
		}
	}
}
JS.require('JS.Set', core.init);
});
