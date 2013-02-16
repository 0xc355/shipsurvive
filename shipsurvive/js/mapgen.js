/* generates a map graph */
$(function(){
 "use strict";
var globals = {},
defaults = {
	background: 'white',
	grid_offset:{"x":0, "y":0},
	grid_width: 20,
	room_min: 5,
	room_max: 10,
	font: '14px Arial',
},
containers = {};

/* core functions */
var core = {
	load_classes: function() {
		core.Actor = new JS.Class({
			initialize: function(type, x, y) {
				this.origin = {x:x, y:y};
				this.facing = 0;
				this.type = type;
				this.cell = undefined;
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
		core.Hostile = new JS.Class(core.Actor, {
			initialize : function () {
				this.callSuper();
				this.reset_speed();
			},
			corner_blocked : function (from, to) {
				var dx = Math.min(Math.max(to.x - from.x,-1), 1);
				var dy = Math.min(Math.max(to.y - from.y, -1), 1);
				//console.log(from, to);
				//console.log(dx,dy);
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
			recalc_path : function () {
				this.next_cell = undefined;
				this.path = mapg.a_star(this.cell, globals.character.cell);
				if (this.path.length == 0) {
					this.paused = true;
				}
			},
			reset_speed : function () {
				this.speed = utilities.random_interval(20,60);
			},
			update_function : function (dt) {
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
				if (this.cell == globals.character.cell) {
					globals.red_overlay_alpha = .7;
					globals.character.health -= 25;
					this.random_room();
					while (this.cell.room == globals.character.cell.room) {
						this.random_room();
						this.reset_speed();
					}
					this.path = [];
					this.next_cell = undefined;
					if (globals.character.health < 0) {
						core.reset();
					}
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
		globals.objs = [];
		if (globals.score) {
			$("#score_display").text("Score: " + Math.round(globals.score));
		}
		globals.score = 0;
		core.generate_map();
		var hostile;
		for (var i = 0; i < 5; i++) {
			hostile = core.add_object("hostile");
			hostile.random_room();
		}
		globals.character = new core.Actor("player", 0, 0);
		globals.character.random_room();
		globals.character.health = 100;
		globals.character.max_hunger = 100;
		globals.character.hunger = 100;
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
		$("#size_slider").slider({max:360, min:0, step:1, value:globals.light_cone, slide:core.change_size});
		$("#noise_slider").slider({max:40, min:10, step:2, value:20, slide:core.change_noise});
		$("p#size_display").text("Light Size: " + globals.light_cone);

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
	add_object: function(type) {
		var new_obj = new core.Hostile(type);
		globals.objs.push(new_obj);
		return new_obj;
	},
	change_size: function(event, ui) {
		globals.light_cone = Math.round(ui.value);
		$("p#size_display").text("Light Size: " + globals.light_cone);
	},
	change_noise: function(event, ui) {
		defaults.grid_width = Math.round(ui.value);
		var val = Math.round(ui.value);
		$("p#noise_display").text("Cell Length: " + val);
	},
	keydown_handler: function (evt) {
		if (evt.keyCode == 87) {globals.keys["w"] = true;} 
		if (evt.keyCode == 65) {globals.keys["a"] = true;}
		if (evt.keyCode == 83) {globals.keys["s"] = true;}
		if (evt.keyCode == 68) {globals.keys["d"] = true;}
	},
	keyup_handler: function (evt) {
		if (evt.keyCode == 87) {globals.keys["w"] = false;} 
		if (evt.keyCode == 65) {globals.keys["a"] = false;}
		if (evt.keyCode == 83) {globals.keys["s"] = false;}
		if (evt.keyCode == 68) {globals.keys["d"] = false;}
	},
	generate_map: function() {
		globals.place_next_room = mapg.generate_room_graph(globals.room_size,
					globals.bounds.width, globals.bounds.height);
		while(globals.place_next_room()) {}
	},
	toggle_door: function () {
		var grid_point = core.screen_to_grid_index(globals.mousePos);
		var next_cell = core.check_position(grid_point.x, grid_point.y);
		if (next_cell && next_cell.type == "door" && next_cell != globals.current_cell) {
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
		console.log(next_cell);
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
		var occluded_cells = [];
		var non_occluded_cells = [];
		var screen_end = {
			x:globals.screen_bounds.origin.x + globals.screen_bounds.size.width,
			y:globals.screen_bounds.origin.y + globals.screen_bounds.size.height
		};
		var view_bounds = {};
		view_bounds.origin = core.screen_to_grid_index(globals.screen_bounds.origin);
		view_bounds.end = core.screen_to_grid_index(screen_end);
		view_bounds.end.x += 1;
		view_bounds.end.y += 1;

		var angle = Math.atan2(1,0);
		var light_max_dist = (globals.light_cone / 360) * Math.PI;
		for (var y = view_bounds.origin.y; y < view_bounds.end.y; y++) {
			for (var x = view_bounds.origin.x; x < view_bounds.end.x; x++) {
				var cell = globals.map_grid[mapg.indexof(x,y)];
				if (cell && cell.type == "door") {
					if (cell.passable) {
						open_door_cells.push(cell);
					} else {
						closed_door_cells.push(cell);
					}
				} else if (cell && cell.type == "wall") {
					wall_cells.push(cell);
				}
				var o_cell = {x:x,y:y};
				var angle = Math.atan2(y - globals.current_cell.y, x - globals.current_cell.x);
				var a_dist = utilities.angular_distance(globals.character.facing, angle);
				if (cell == globals.current_cell){
					o_cell.opacity = 0;
				} else if (light_max_dist != 0) {
					o_cell.opacity = Math.pow(a_dist / light_max_dist, 3);
				} else {
					o_cell.opacity = 1;
				}
				if (cell != globals.current_cell
				    && (a_dist >= light_max_dist
					|| mapg.occluded(globals.current_cell, o_cell))) {
					var grid_ocell = globals.map_grid[mapg.indexof(o_cell)];
					if(grid_ocell) {grid_ocell.occluded = true;}
					occluded_cells.push(o_cell);
				} else {
					var grid_ocell = globals.map_grid[mapg.indexof(o_cell)];
					if(grid_ocell) {grid_ocell.occluded = false;}
					non_occluded_cells.push(o_cell);
				}
			}
		}
		draw_functions.draw_cells(globals.context, wall_cells,
					  defaults.grid_width, "rgba(60,60,60,1)");
		draw_functions.draw_cells(globals.context, closed_door_cells, defaults.grid_width, "rgba(180,0,0,1)");
		draw_functions.draw_cells(globals.context, open_door_cells, defaults.grid_width, "rgba(0,200,0,1)");
		draw_functions.draw_character(globals.context, globals.character);
		for (var i = 0; i < globals.objs.length; i++) {
			var obj = globals.objs[i];
			if (!obj.cell.occluded)
				draw_functions.draw_character(globals.context, obj, 10, "#FF0000");
		}
		draw_functions.draw_cells(globals.context, occluded_cells,
					  defaults.grid_width, "rgba(0,0,0,1)", -1);
		draw_functions.draw_cells(globals.context, non_occluded_cells,
					  defaults.grid_width, "rgba(0,0,0,1)", -1, function (cell) {return cell.opacity});
		if (globals.current_cell) {
			draw_functions.draw_tooltip(globals.context, {"x":0, "y":0}, {"x":10, "y":10}, globals.current_cell);
		}
		draw_functions.draw_score(globals.context, {"x":10, "y":globals.screen_bounds.size.height-20}, globals.score);
		draw_functions.draw_healthbar(globals.context, "#FF0000", globals.character.health/100,
					      {x:globals.screen_bounds.size.width - 20, y:30});
		draw_functions.draw_healthbar(globals.context, "#00AA00", globals.character.hunger/globals.character.max_hunger,
					      {x:globals.screen_bounds.size.width - 35, y:30});
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
	update : function(dt) {
		globals.score += dt * 10;
		var new_origin = {"x":globals.character.origin.x, "y":globals.character.origin.y};
		var dd = {x:0, y:0};
		var moved = false;
		var original_cell = globals.character.cell;
		for (var i = 0; i < globals.kitchens.length; i++) {
			var kitchen = globals.kitchens[i];
			kitchen.food = Math.min(40, kitchen.food + dt);
		}
		if (globals.keys.w) { dd.y -= dt * 100; }
		if (globals.keys.s) { dd.y += dt * 100; }
		globals.character.move(0, dd.y);
		if (globals.keys.a) { dd.x -= dt * 100; }
		if (globals.keys.d) { dd.x += dt * 100; }
		globals.character.move(dd.x, 0) || moved;
		if (!original_cell.equals(globals.character.cell)) {
			core.recalculate_paths();
		}
		if (globals.character.cell.room) {
			var room = globals.character.cell.room;
			var room_name = room.name;
			if (room_name == "medical_bay") {
				globals.character.health = Math.min(globals.character.health + 2 * dt, 100);
			}
			if (room_name == "cargo" || room_name == "kitchen") {
				if (room.food > 0) {
					var food_transfered = Math.min(room.food, 10 * dt,
								globals.character.max_hunger
								- globals.character.hunger);
					room.food -= food_transfered;
					globals.character.hunger += food_transfered;
				}
			}
		}
		if (globals.character.hunger > 0) {
			globals.character.hunger -= dt * 3;
		} else {
			core.reset();
		}
		for (var i = 0; i < globals.objs.length; i++) {
			var obj = globals.objs[i];
			obj.update_function(dt);
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
}
var utilities = {
	angular_distance : function(a, b) {
		var raw = Math.abs(b - a);
		while (raw > Math.PI * 2) {
			raw -= Math.PI * 2;
		}
		return Math.PI - Math.abs(raw - Math.PI);
	},
	signed_angular_distance : function(a, b) {
		var dist = utilities.angular_distance(a, b);
		var d1 = utilities.angular_distance(a + dist, b);
		var d2 = utilities.angular_distance(a, b + dist);
		if (d1 > d2) {
			return -dist;
		} else {
			return dist;
		}
	},
	bresenham_line : function(a, b) {
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
	random_interval : function(a, b) {
		return Math.floor(Math.random() * (b - a) + a);
	},
	shuffle_array : function(arr) {
		for (var i = arr.length - 1; i >= 0; i--) {
			var n = utilities.random_interval(0,i);
			var temp = arr[i];
			arr[i] = arr[n];
			arr[n] = temp;
		}
		return arr;
	},
	interpolate : function (val, y0, x0, y1, x1) {
		    return (val-x0)*(y1-y0)/(x1-x0) + y0;
	},
	colormap_jet : function(value, extra) {
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
	a_star: function (from, to) {
		var hash_cell = function(cell) {
			return cell.x + cell.y * globals.bounds.width;
		};
		var h_func = function(cell) {
			return Math.abs(to.x - cell.x) + Math.abs(to.y - cell.y);
		};
		
		var closed_set = [];
		var open_set = new BinaryHeap(function(cell) {
			var chash = hash_cell(cell);
			return f_score[chash];
		});
		var tohash = hash_cell(to);
		open_set.push(from);
		var came_from = {};
		var visited_set = [];
		visited_set[hash_cell(from)] = true;

		var g_score = {};
		var f_score = {};
		g_score[hash_cell(from)] = 0;
		f_score[hash_cell(from)] = h_func(from);

		var add_neighbors = function(neighbors, cost) {
			for (var i = 0; i < neighbors.length; i++) {
				var other = neighbors[i];
				var grid_cell = globals.map_grid[mapg.indexof(other)];
				if (!grid_cell || !grid_cell.passable) {
					continue;
				}
				var ohash = hash_cell(grid_cell);
				if (closed_set[ohash]) {
					continue;
				}
				var temp_g_score = g_score[bhash] + cost;
				var visited = !!visited_set[ohash];
				if (!visited || temp_g_score < g_score[ohash]) {
					came_from[ohash] = best;
					g_score[ohash] = temp_g_score;
					f_score[ohash] = g_score[ohash] + h_func(grid_cell);
					if (!visited) {
						open_set.push(grid_cell);
						visited_set[ohash] = true;
					} else {
						open_set.rescoreElement(grid_cell);
					}
				}
			}
		}
		while (open_set.size() > 0) {
			var best = open_set.pop();
			var bhash = hash_cell(best);
			if (bhash == tohash) {
				var head = best;
				var ret = [best];
				var parent = came_from[bhash];
				while (parent) {
					ret.push(parent);
					parent = came_from[hash_cell(parent)];
				}
				return ret;
			}
			closed_set[bhash] = true;
			add_neighbors(best.neighbors(), 1);
			add_neighbors(best.diag_neighbors(), 1.414);
		}
		return [];
	},
	occluded : function (from, to) {
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
	in_bounds : function (x,y) {
		if (y != undefined) {
			return x >= 0 && x < globals.bounds.width && y >= 0 && y < globals.bounds.height;
		} else {
			return x.x >= 0 && x.x < globals.bounds.width && x.y >= 0 && x.y < globals.bounds.height;
		}
	},
	indexof : function(x,y) {
		if (y != undefined) {
			return y * globals.bounds.width + x;
		} else {
			return x.y * globals.bounds.width + x.x;
		}
	},
	generate_room_graph: function(min_rooms, width, height) {
		var rooms = [];
		var types_added = {};
		var tWeight = 0;
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
		
		var map_grid = [];
		
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
						cell.type = "room";
						cell.room = room;
						cell.name = room.type;
					} else {
						cell = new Cell(x,y);
						cell.type = "room";
						cell.name = room.type;
						cell.room = room;
						map_grid[mapg.indexof(x,y)] = cell;
					}
				}
			}
			return cells_displaced;
		}
		
		var Cell = new JS.Class({
			initialize: function(x,y) {
				this.x = x;
				this.y = y;
				this.type = "open";
				this.passable = true;
				this.neighboring_rooms = [];
			},
			equals: function(other) {
				return other.x == this.x && other.y == this.y;
			},
			diag_neighbors: function () {
				var celllb = new Cell(this.x-1, this.y+1);
				var cellrb = new Cell(this.x+1, this.y+1);
				var celllt = new Cell(this.x-1, this.y-1);
				var cellrt = new Cell(this.x+1, this.y-1);
				return [celllb,cellrb,celllt,cellrt];
			},
			neighbors: function () {
				var celll = new Cell(this.x-1, this.y);
				var cellr = new Cell(this.x+1, this.y);
				var cellt = new Cell(this.x, this.y+1);
				var cellb = new Cell(this.x, this.y-1);
				return [celll,cellr,cellt,cellb];
			},
			neighbors_with: function (func) {
				return _.filter(this.neighbors(), func);
			}
		});
		var hash_room = function (room) {
			return room.origin.x + ", " + room.origin.y;
		}
		var add_walls = function (room, grid, wall_set) {
			var new_cells = [];
			if (!room || !room.dimensions || !room.origin) {
				return;
			} 
			for (var y = room.origin.y - 1; y < room.origin.y + room.dimensions.height + 1; y++) {
				var new_cell = new Cell(room.origin.x - 1, y);
				var new_cell2 = new Cell(room.origin.x + room.dimensions.width, y);
				new_cells.push(new_cell);
				new_cells.push(new_cell2);
			}
			for (var x = room.origin.x; x < room.origin.x + room.dimensions.width; x++) {
				var new_cell = new Cell(x, room.origin.y - 1);
				var new_cell2 = new Cell(x, room.origin.y + room.dimensions.height);
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
						var neighbor = hash_room(neighboring_rooms.entries()[0]);
						connecting_rooms.add(neighbor);
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
				var doors = viable_doors[connecting_rooms[i]];
				if (doors) {
					var cell = doors[utilities.random_interval(0,doors.length)];
					cell.type = "door";
					cell.passable = utilities.random_interval(0,2) == 1;
					wall_set.remove(cell);
				}
			}
		}
		var add_open_cells = function (room, grid, open_set) {
			var new_cells = [];
			if (!room || !room.dimensions || !room.origin) {
				return;
			} 
			for (var y = room.origin.y; y < room.origin.y + room.dimensions.height; y++) {
				var new_cell = new Cell(room.origin.x - 2, y);
				var new_cell2 = new Cell(room.origin.x + room.dimensions.width + 1, y);
				new_cells.push(new_cell);
				new_cells.push(new_cell2);
			}
			for (var x = room.origin.x; x < room.origin.x + room.dimensions.width; x++) {
				var new_cell = new Cell(x, room.origin.y - 2);
				var new_cell2 = new Cell(x, room.origin.y + room.dimensions.height + 1);
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
			if (room.type == "kitchen") {
				room.food = 0;
				globals.kitchens.push(room);
			} else if (room.type == "cargo") {
				room.food = 50;
			}
			globals.open_cells = open_set;
			globals.map_grid = map_grid;
			globals.rooms = rooms;
			i += 1;
			return room;
		}
		return place_next_room;
	}
}

var draw_functions = {
	draw_bg : function(ctx) {
		var cv = globals.canvas[0];
		ctx.fillStyle = "#000000";
		ctx.fillRect(0, 0, cv.width, cv.height);
	},
	draw_overlay : function(ctx, color) {
		var cv = globals.canvas[0];
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, cv.width, cv.height);
	},
	draw_healthbar : function(ctx, color, percent, offset) {
		var cv = globals.canvas[0];
		ctx.fillStyle = color;
		ctx.fillRect(offset.x, offset.y, 10, 200 * percent);
	},
	draw_border : function(ctx, width) {
		var cv = globals.canvas[0];
		ctx.strokeStyle = "#000000";
		ctx.strokeRect(0, 0, cv.width, cv.height);
	},
	draw_rooms : function(ctx, rooms, cell_width, line_width) {
		var cv = globals.canvas[0];
		for (var i = 0; i < rooms.length; i++) {
			var room = rooms[i];
			if (!room || !room.dimensions || !room.origin) {
				continue;
			}
			ctx.strokeStyle = "#000000";
			var index = globals.room_types[room.name].type_index;
			var col = (index/globals.room_data.length)*2 - 1;
			if (globals.current_cell && globals.current_cell.room != room) {
				ctx.fillStyle = utilities.colormap_jet(col, .5);
			} else {
				ctx.fillStyle = utilities.colormap_jet(col, 2.0);
			}
			var startX = room.origin.x * cell_width - globals.character.origin.x + globals.centroid.x;
			var width = room.dimensions.width * cell_width;
			var startY = room.origin.y * cell_width - globals.character.origin.y + globals.centroid.y;
			var height = room.dimensions.height * cell_width;
			
			ctx.fillRect(startX , startY, width, height);
			ctx.strokeRect(startX , startY, width, height);
		}
	},
	draw_cells : function(ctx, cells, cell_width, color, line_width, op_func) {
		if (line_width == undefined) {
			line_width =  2;
		}
		ctx.fillStyle = color;
		for (var i = 0; i < cells.length; i++) {
			var cell = cells[i];
			if (op_func) {
				ctx.fillStyle = "rgba(0,0,0," + op_func(cell) + ")";
			}
			var startX = cell.x * cell_width - globals.character.origin.x + globals.centroid.x;
			var startY = cell.y * cell_width - globals.character.origin.y + globals.centroid.y;
			var width =  cell_width;
			var height = cell_width;			
			ctx.fillRect(startX + line_width, startY + line_width,
					width - line_width * 2, height - line_width * 2);
		}
	},
	draw_character : function(ctx, character, size, color) {
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
	draw_score : function(ctx, offset, score) {
		ctx.fillStyle = "#BB0000";
		ctx.fillText("Score: " + Math.round(score), offset.x, offset.y);
	},
	draw_tooltip : function(ctx, start, offset, room) {
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

		var text = room.name || room.type;

		var startX = start.x + offset.x;
		var startY = start.y + offset.y;
		var name_str = text.replace("_"," ");
		var lines = getLines(ctx, name_str, 200);
		var lineHeight = 14;
		var maxH = lines.length * lineHeight;
		ctx.font = globals.font;
		ctx.fillStyle = "rgba(100,150,255,.7)";
		ctx.fillRect(startX, startY, maxW + 20, maxH + 10);
		ctx.fillStyle = "#000000";
		ctx.textBaseline = "top";
		
		var lines = getLines(ctx, name_str, 95);
		for (var i = 0; i < lines.length; i++) {
			ctx.fillText(lines[i], startX + 5, startY + lineHeight * i);
		}
	}
}
JS.require('JS.Set', core.init);
});
