/* generates a map graph */
$(function(){
 "use strict";
var globals = {},
defaults = {
	background: 'white',
	grid_offset:{"x":0, "y":0},
	grid_width: 10,
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
			width: (globals.bounds.end_x - globals.bounds.start_x),
			height: (globals.bounds.end_y - globals.bounds.start_y)
		};
		globals.centroid = {
			x: (globals.bounds.end_x + globals.bounds.start_x)/2,
			y: (globals.bounds.end_y + globals.bounds.start_y)/2
		};
		$("#size_slider").slider({max:200, min:10, step:1, value:50, slide:core.change_size});
		$("#noise_slider").slider({max:40, min:10, step:1, value:10, slide:core.change_noise});

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
		cv.addEventListener('click', core.generate_map, true);
		cv.addEventListener('contextmenu', core.next, true);
		function getMousePos(canvas, evt) {
			var rect = canvas.getBoundingClientRect();
			return {
				"x": evt.clientX - rect.left,
				"y": evt.clientY - rect.top
			};
		}
		globals.bounds = {"width": Math.round(globals.size.width/defaults.grid_width),
						"height": Math.round(globals.size.height/defaults.grid_width)};
		cv.addEventListener('mousemove', function(evt) {
			globals.mousePos = getMousePos(cv, evt);
		}, false);
		core.generate_map();
		
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

		(function animloop(){
		  requestAnimFrame(animloop);
		  core.update();
		  core.redraw_map();
	    })();
	},
	change_size: function(event, ui) {
		globals.params.radius_size = 10 - ui.value;
		var val = Math.round(ui.value * 10)/10;
		$("p#size_display").text("Size: " + val);
	},
	change_noise: function(event, ui) {
		defaults.grid_width = Math.round(ui.value);
		var val = Math.round(ui.value);
		$("p#noise_display").text("Cell Length: " + val);
	},
	generate_map: function() {
		globals.place_next_room = mapg.generate_room_graph(50, globals.bounds.width, globals.bounds.height);
		globals.rooms = globals.place_next_room();
	},
	next: function() {
		globals.rooms = globals.place_next_room();
	},
	redraw_map: function() {
		draw_functions.draw_border(globals.context, 2);
		draw_functions.draw_rooms(globals.context, globals.rooms, defaults.grid_offset, defaults.grid_width, 1);
		draw_functions.draw_cells(globals.context, globals.open_cells, defaults.grid_offset, defaults.grid_width);
		if (globals.current_cell) {
			draw_functions.draw_tooltip(globals.context, globals.mousePos, {"x":10, "y":10}, globals.current_cell);
		}
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
	update : function() {
		var checkPos = function (x,y) {
			if (mapg.in_bounds(x,y)) {
				var room = globals.map_grid[mapg.indexof(x,y)];
				if (room) {
					return room;
				}
			}
			return undefined;
		}
		var x = Math.floor((globals.mousePos.x - defaults.grid_offset.x)/defaults.grid_width);
		var y = Math.floor((globals.mousePos.y - defaults.grid_offset.y)/defaults.grid_width);
		globals.current_cell = checkPos(x,y);
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

var mapg = {
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
				console.log("cannot be placed", room);
				return false;
			}
			room.origin = r_room.origin;
			room.dimensions = r_room.dimensions;
			for (var y = room.origin.y; y < room.origin.y + room.dimensions.height; y++) {
				for (var x = room.origin.x; x < room.origin.x + room.dimensions.width; x++) {
					var index = mapg.indexof(x,y);
					var cell = map_grid[index];
					if (cell) {
						cells_displaced.add(cell);
						cell.type = room.type;
					}
					map_grid[mapg.indexof(x,y)] = room;
				}
			}
			return cells_displaced;
		}
		
		var Cell = new JS.Class({
			initialize: function(x,y) {
				this.x = x;
				this.y = y;
				this.type = "open";
			},
			equals: function(object) {
				return other.x == x && other.y == y;
			}
		});
		var add_open_cells = function (room, grid) {
			var new_cells = [];
			var good_cells = new JS.Set();
			if (!room || !room.dimensions || !room.origin) {
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
			//loop through the new open cells and try to add them to the grid. 
			for (var i = 0; i < new_cells.length; i++) {
				var cell = new_cells[i];
				if (mapg.in_bounds(cell)) {
					var grid_index = mapg.indexof(cell);
					var grid_cell = grid[grid_index];
					if (!grid_cell) {
						grid[grid_index] = cell;
						good_cells.add(cell);
					}
				}
			}
			return good_cells;
		}
		var open_cells = [];
		var rooms_placed = 0;
		var i = 0;
		
		var get_open_cells = function (grid) {
			var cells = [];
			for (var y = 0; y < height; y++) {
				for (var x = 0; x < width; x++) {
					if (grid[mapg.indexof(x,y)]) { continue; }
					var cellt = new Cell(x,y+1);
					var cellb = new Cell(x,y-1);
					var celll = new Cell(x-1,y);
					var cellr = new Cell(x+1,y);
					if ((mapg.in_bounds(celll) && grid[mapg.indexof(celll)]) ||
						(mapg.in_bounds(cellr) && grid[mapg.indexof(cellr)]) || 
						(mapg.in_bounds(cellt) && grid[mapg.indexof(cellt)]) ||
						(mapg.in_bounds(cellb) && grid[mapg.indexof(cellb)])) {
						cells.push(new Cell(x,y));
					}
				}
			}
			return cells;
		}
		
		/* place next room callback */
		var place_next_room = function() {
			if (i >= rooms.length) {
				return rooms;
			}
			var entries = open_cells;
			var room = rooms[i];
			if (open_cells.length == 0) {
				//if no rooms has been placed, place the first one in the center
				room.dimensions = {};
				room.dimensions.width = utilities.random_interval(1,3);
				room.dimensions.height = utilities.random_interval(1,3);
				room.origin = {};
				room.origin.x = Math.floor(width/2);
				room.origin.y = Math.floor(height/2);
			} else {
				var open_index = utilities.random_interval(0, entries.length);
				room.dimensions = {};
				room.dimensions.width = utilities.random_interval(1,3);
				room.dimensions.height = utilities.random_interval(1,3);
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
					console.log("gave up");
					//give up and place a 1 square room.
					room.dimensions.width = 1;
					room.dimensions.height = 1;	
					dead_cells = place_room(room, map_grid);
					break;
				}
			}
			open_cells = get_open_cells(map_grid);
			globals.open_cells = open_cells;
			globals.map_grid = map_grid;
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
	draw_rooms : function(ctx, rooms, origin, cell_width, line_width) {
		var cv = globals.canvas[0];			
		for (var i = 0; i < rooms.length; i++) {
			var room = rooms[i];
			if (!room || !room.dimensions || !room.origin) {
				continue;
			}
			ctx.fillStyle = "#000000";
			var startX = origin.x + room.origin.x * cell_width;
			var width = room.dimensions.width * cell_width;
			var startY = origin.y + room.origin.y * cell_width;
			var height = room.dimensions.height * cell_width;
			
			ctx.fillRect(startX , startY, width, height);
			var index = globals.room_types[room.type].type_index;
			var col = (index/globals.room_data.length)*2 - 1;
			ctx.fillStyle = utilities.colormap_jet(col, 50);
			ctx.fillRect(startX + line_width, startY + line_width,
					width - line_width * 2, height - line_width * 2);
		}
	},
	draw_cells : function(ctx, cells, origin, cell_width) {
		var line_width = 2;
		for (var i = 0; i < cells.length; i++) {
			var cell = cells[i];
			ctx.fillStyle = "rgb(100,150,255)";
			var startX = origin.x + cell.x * cell_width;
			var width =  cell_width;
			var startY = origin.y + cell.y * cell_width;
			var height = cell_width;			
			ctx.fillRect(startX + line_width, startY + line_width,
					width - line_width * 2, height - line_width * 2);
		}
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

		var startX = start.x + offset.x;
		var startY = start.y + offset.y;
		var name_str = room.name.replace("_"," ");
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
