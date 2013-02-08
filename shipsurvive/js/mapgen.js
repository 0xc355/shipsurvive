/* generates a map graph */
$(function(){
 "use strict";
var globals = {},
defaults = {
	background: 'white',
	font: '14px Arial',
	num_seed_points: 1500,
	wind_scale: 10
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
		globals.bounds = {
			start_x: 5, start_y: 5,
			end_x: globals.canvas[0].width-5,
			end_y: globals.canvas[0].height-5
		};
		globals.size = {
			height: (globals.bounds.end_x - globals.bounds.start_x),
			width: (globals.bounds.end_y - globals.bounds.start_y)
		};
		globals.centroid = {
			x: (globals.bounds.end_x + globals.bounds.start_x)/2,
			y: (globals.bounds.end_y + globals.bounds.start_y)/2
		};
		$("#size_slider").slider({max:10, min:0, step:.1, value:1, slide:core.change_size});
		$("#noise_slider").slider({max:10, min:0, step:.1, value:1, slide:core.change_noise});

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

		cv.addEventListener('click', core.generate_map, true);
		cv.addEventListener('contextmenu', core.next, true);
		core.generate_map();
	},
	change_size: function(event, ui) {
		globals.params.radius_size = 10 - ui.value;
		var val = Math.round(ui.value * 10)/10;
		$("p#size_display").text("Size: " + val);
	},
	change_noise: function(event, ui) {
		globals.params.noise_size = ui.value;
		var val = Math.round(ui.value * 10)/10;
		$("p#noise_display").text("Noise: " + val);
	},
	generate_map: function() {
		globals.place_next_room = mapgen_functions.generate_room_graph(50, 20, 20);
		globals.rooms = globals.place_next_room();
		core.redraw_map();
	},
	next: function() {
		globals.rooms = globals.place_next_room();
		console.log(globals.rooms);
		core.redraw_map();
	},
	redraw_map: function() {
		draw_functions.draw_border(globals.context, 2);
		draw_functions.draw_rooms(globals.context, globals.rooms, 16, 1);
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
	}
}
var utilities = {
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
		var red = Math.round(base(value - 0.5) * 255 + extra);
		var green = Math.round(base(value) * 255 + extra);
		var blue = Math.round(base(value + 0.5) * 255 + extra);
		return "rgb(" + red + ", " + green + ", " + blue + ")";
	}
}

var mapgen_functions = {
	generate_room_graph: function(min_rooms, width, height) {
		var rooms = [];
		var types_added = {};
		var tWeight = 0;
		
		//first fill the graph with minimal rooms
		for (var i = 0; i < globals.room_data.length; i++) {
			var room_type = room_data[i];
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
		var indexof = function(x,y) {
			if (y) {
				return y * width + x;
			} else {
				return x.y * width + x.x;
			}
		}
		var place_room = function (room, grid) {
			var cells_displaced = new JS.Set();
			if (!room || !room.dimensions || !room.origin) {
				console.log("no room data");
				return cells_displaced;
			} 
			for (var y = room.origin.y; y < room.origin.y + room.dimensions.height; y++) {
				for (var x = room.origin.x; x < room.origin.x + room.dimensions.width; x++) {
					var index = indexof(x,y);
					var cell = map_grid[indexof(x,y)];
					if (cell) {
						cells_displaced.add(cell);
					}
					map_grid[indexof(x,y)] = room;
				}
			}
			return cells_displaced;
		}

		var in_bounds = function (cell) {
			return cell.x >= 0 && cell.x < width && cell.y >= 0 && cell.y < height;
		}
		
		var Cell = new JS.Class({
			initialize: function(x,y) {
				this.x = x;
				this.y = y;
			},
			equals: function(object) {
				return other.x == x && other.y == y;
			}
		});
		var add_open_cells = function (room, grid) {
			var new_cells = [];
			var good_cells = new JS.Set();
			if (!room || !room.dimensions || !room.origin) {
				console.log("no room data");
				return good_cells;
			} 
			for (var y = room.origin.y; y < room.origin.y + room.dimensions.height; y++) {
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
			for (var i = 0; i < new_cells.length; i++) {
				var cell = new_cells[i];
				if (in_bounds(cell)) {
					var grid_index = indexof(cell);
					var grid_cell = grid[grid_index];
					if (!grid_cell) {
						grid[grid_index] = cell;
						good_cells.add(cell);
					}
				}
			}
			return good_cells;
		}
		var open_cells = new JS.Set();
		var rooms_placed = 0;
		var i = 0;
		var place_next_room = function() {
			if (i >= rooms.length) {
				return rooms;
			}
			var room = rooms[i];
			if (open_cells.isEmpty()) {
				//if no rooms has been placed, place the first one in the center
				room.dimensions = {};
				room.dimensions.width = utilities.random_interval(1,3);
				room.dimensions.height = utilities.random_interval(1,3);
				room.origin = {};
				room.origin.x = Math.floor(width/2);
				room.origin.y = Math.floor(height/2);
			} else {
				var entries = open_cells.entries();
				var open_index = utilities.random_interval(0, entries.length);
				room.dimensions = {};
				room.dimensions.width = 1;
				room.dimensions.height = 1;
				room.origin = entries[open_index];
				open_cells.remove(room.origin);
			}
			open_cells = open_cells.difference(place_room(room,map_grid));
			open_cells = open_cells.union(add_open_cells(room, map_grid));
			i += 1;
			return rooms;
		}
		return place_next_room;
	}
}

var draw_functions = {
	draw_border : function(ctx, width) {
		var cv = globals.canvas[0];
		ctx.fillStyle = "#000000";
		ctx.fillRect(0, 0, cv.width, cv.height);
		ctx.fillStyle = "#FFFFFF";
		ctx.fillRect(width, width,
				cv.width - width * 2, cv.height - width * 2);
	},
	draw_rooms : function(ctx, rooms, cell_width, line_width) {
		var cv = globals.canvas[0];
		for (var i = 0; i < rooms.length; i++) {
			var room = rooms[i];
			if (!room || !room.dimensions || !room.origin) {
				console.log("no data");
				continue;
			}
			ctx.fillStyle = "#000000";
			var startX = room.origin.x * cell_width;
			var width = room.dimensions.width * cell_width;
			var startY = room.origin.y * cell_width;
			var height = room.dimensions.height * cell_width;
			
			ctx.fillRect(startX , startY, width, height);
			var col = (i/rooms.length)*2 - 1;
			ctx.fillStyle = utilities.colormap_jet(col, 50);
			ctx.fillRect(startX + line_width, startY + line_width,
					width - line_width * 2, height - line_width * 2);
		}
	}
}
JS.require('JS.Set', core.init);
});
