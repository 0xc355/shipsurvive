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
	init: function() {
		globals.canvas = $('#board');
		var cv = globals.canvas[0];
		
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
		$("#size_slider").slider({max:200, min:10, step:1, value:50, slide:core.change_size});
		$("#noise_slider").slider({max:40, min:10, step:2, value:20, slide:core.change_noise});

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
		globals.mousePos = {"x":0, "y":0};
		globals.room_types = {};
		cv.addEventListener('click', core.toggle_door, true);
		cv.addEventListener('contextmenu', core.next, true);
		//cv.addEventListener('contextmenu', core.mouse_debug, true);
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

		core.generate_map();
		
		var start_room = globals.rooms[0];
		var start_origin = start_room.origin;
		var c_origin = {"x":start_origin.x * defaults.grid_width,
					"y":start_origin.y * defaults.grid_width};
		c_origin.x += start_room.dimensions.width * defaults.grid_width/2;
		c_origin.y += start_room.dimensions.height * defaults.grid_width/2;

		globals.character = {"facing": 0, "origin":c_origin};
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
	change_size: function(event, ui) {
		globals.room_size = Math.round(ui.value);
		$("p#size_display").text("Size: " + globals.room_size);
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
		var next_size = globals.place_next_room();
	},
	next: function () {
		globals.place_next_room();
	},
	toggle_door: function () {
		var grid_point = core.screen_to_grid_index(globals.mousePos);
		var next_cell = core.check_position(grid_point.x, grid_point.y);
		if (next_cell && next_cell.type == "door" && next_cell != globals.current_cell) {
			var dx = next_cell.x - globals.current_cell.x;
			var dy = next_cell.y - globals.current_cell.y;
			var distance = Math.sqrt(dx*dx + dy*dy);
			if (distance < 2) {
				next_cell.passable = !next_cell.passable;
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
	redraw_map: function() {
		draw_functions.draw_bg(globals.context);
		draw_functions.draw_rooms(globals.context, globals.rooms, defaults.grid_width, 1);
		var open_door_cells = [];
		var closed_door_cells = [];
		var wall_cells = [];
		var occluded_cells = [];
		var screen_end = {
			x:globals.screen_bounds.origin.x + globals.screen_bounds.size.width,
			y:globals.screen_bounds.origin.y + globals.screen_bounds.size.height
		};
		var view_bounds = {};
		view_bounds.origin = core.screen_to_grid_index(globals.screen_bounds.origin);
		view_bounds.end = core.screen_to_grid_index(screen_end);
		view_bounds.end.x += 1;
		view_bounds.end.y += 1;

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
				if (mapg.occluded(globals.current_cell, o_cell)) {
					occluded_cells.push(o_cell);
				}
			}
		}
		draw_functions.draw_cells(globals.context, wall_cells,
					  defaults.grid_width, "rgba(60,60,60,1)");
		draw_functions.draw_cells(globals.context, closed_door_cells, defaults.grid_width, "rgba(180,0,0,1)");
		draw_functions.draw_cells(globals.context, open_door_cells, defaults.grid_width, "rgba(0,200,0,1)");
		draw_functions.draw_cells(globals.context, occluded_cells,
					  defaults.grid_width, "rgba(0,0,0,.5)", 0);
		draw_functions.draw_character(globals.context, globals.character);
		if (globals.current_cell) {
			draw_functions.draw_tooltip(globals.context, {"x":0, "y":0}, {"x":10, "y":10}, globals.current_cell);
		}
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
	update : function(dt) {
		var new_origin = {"x":globals.character.origin.x, "y":globals.character.origin.y};
		if (globals.keys.w) { new_origin.y -= dt * 100; }
		if (globals.keys.s) { new_origin.y += dt * 100; }
		var x = Math.floor((new_origin.x)/defaults.grid_width);
		var y = Math.floor((new_origin.y)/defaults.grid_width);
		var next_room = core.check_position(x,y);
		if (next_room && next_room.passable) {
			globals.character.origin.x = new_origin.x;
			globals.character.origin.y = new_origin.y;
			globals.current_cell = next_room;
		}
		new_origin = {"x":globals.character.origin.x, "y":globals.character.origin.y};
		if (globals.keys.a) { new_origin.x -= dt * 100; }
		if (globals.keys.d) { new_origin.x += dt * 100; }
		x = Math.floor((new_origin.x)/defaults.grid_width);
		y = Math.floor((new_origin.y)/defaults.grid_width);
		next_room = core.check_position(x,y);
		if (next_room && next_room.passable) {
			globals.character.origin.x = new_origin.x;
			globals.character.origin.y = new_origin.y;
			globals.current_cell = next_room;
		}
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
			equals: function(object) {
				return other.x == x && other.y == y;
			},
			neighbors_with: function (func) {
				var celll = new Cell(this.x-1, this.y);
				var cellr = new Cell(this.x+1, this.y);
				var cellt = new Cell(this.x, this.y+1);
				var cellb = new Cell(this.x, this.y-1);
				var neighbors = [celll,cellr,cellt,cellb];
				return _.filter(neighbors, func);
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
					cell.passable = false;
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
				return rooms;
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
			globals.open_cells = open_set;
			globals.map_grid = map_grid;
			globals.rooms = rooms;
			i += 1;
			return i;
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
			if (globals.current_cell.room != room) {
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
	draw_cells : function(ctx, cells, cell_width, color, line_width) {
		if (line_width == undefined) {
			line_width =  2;
		}
		console.log(line_width);
		ctx.fillStyle = color;
		for (var i = 0; i < cells.length; i++) {
			var cell = cells[i];
			var startX = cell.x * cell_width - globals.character.origin.x + globals.centroid.x;
			var startY = cell.y * cell_width - globals.character.origin.y + globals.centroid.y;
			var width =  cell_width;
			var height = cell_width;			
			ctx.fillRect(startX + line_width, startY + line_width,
					width - line_width * 2, height - line_width * 2);
		}
	},
	draw_character : function(ctx, character) {
		var x1 = globals.centroid.x + Math.cos(character.facing) * 5;
		var y1 = globals.centroid.y + Math.sin(character.facing) * 5;
		var x2 = globals.centroid.x + Math.cos(character.facing + 2.35619449) * 5;
		var y2 = globals.centroid.y + Math.sin(character.facing + 2.35619449) * 5;
		var x3 = globals.centroid.x + Math.cos(character.facing - 2.35619449) * 5;
		var y3 = globals.centroid.y + Math.sin(character.facing - 2.35619449) * 5;
		ctx.strokeStyle = "#000000";
		ctx.beginPath();
		ctx.moveTo(x1,y1);
		ctx.lineTo(x2,y2);
		ctx.lineTo(x3,y3);
		ctx.lineTo(x1,y1);
		ctx.stroke();
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
