/* generates a map graph */
$(function(){
 "use strict";
var globals = {},
defaults = {
	background: 'white',
	grid_offset:{"x":0, "y":0},
	grid_width: 20,
	font: '14px Arial',
	num_seed_points: 1500,
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
		//cv.addEventListener('click', core.generate_map, true);
		cv.addEventListener('click', core.next, true);
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
		globals.bounds = {"width": 50, "height": 50};

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
		globals.place_next_room = mapg.generate_room_graph(globals.room_size, globals.bounds.width, globals.bounds.height);
		var next_size = globals.place_next_room();
	},
	next: function () {
		globals.place_next_room();
	},
	redraw_map: function() {
		draw_functions.draw_bg(globals.context);
		draw_functions.draw_rooms(globals.context, globals.rooms, defaults.grid_width, 1);
		draw_functions.draw_cells(globals.context, globals.open_cells.entries(), defaults.grid_width, "rgba(0,0,255,.5)");
		draw_functions.draw_cells(globals.context, globals.walls.entries(), defaults.grid_width, "rgba(0,255,0,.5)");
		var room_cells = [];
		for (var y = 0; y < globals.bounds.height; y++) {
			for (var x = 0; x < globals.bounds.width; x++) {
				var cell = globals.map_grid[mapg.indexof(x,y)];
				if (cell && cell.type == "room") {
					room_cells.push(cell);
				}
			}
		}
		draw_functions.draw_cells(globals.context, room_cells, defaults.grid_width, "rgba(255,0,0,.5)");
		
		draw_functions.draw_character(globals.context, globals.character);
		if (globals.current_room) {
			draw_functions.draw_tooltip(globals.context, {"x":0, "y":0}, {"x":10, "y":10}, globals.current_room);
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
		var checkPos = function (x,y) {
			if (mapg.in_bounds(x,y)) {
				var room = globals.map_grid[mapg.indexof(x,y)];
				if (room) {
					return room;
				}
			}
			return undefined;
		}
		var new_origin = {"x":globals.character.origin.x, "y":globals.character.origin.y};
		if (globals.keys.w) { new_origin.y -= dt * 100; }
		if (globals.keys.s) { new_origin.y += dt * 100; }
		var x = Math.floor((new_origin.x)/defaults.grid_width);
		var y = Math.floor((new_origin.y)/defaults.grid_width);
		var next_room = checkPos(x,y);
		if (next_room && next_room.passable) {
			globals.character.origin.x = new_origin.x;
			globals.character.origin.y = new_origin.y;
			globals.current_room = next_room;
		}
		new_origin = {"x":globals.character.origin.x, "y":globals.character.origin.y};
		if (globals.keys.a) { new_origin.x -= dt * 100; }
		if (globals.keys.d) { new_origin.x += dt * 100; }
		x = Math.floor((new_origin.x)/defaults.grid_width);
		y = Math.floor((new_origin.y)/defaults.grid_width);
		next_room = checkPos(x,y);
		if (next_room && next_room.passable) {
			globals.character.origin.x = new_origin.x;
			globals.character.origin.y = new_origin.y;
			globals.current_room = next_room;
		}
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
		var red = Math.round(base(value - 0.5) * 255 * extra);
		var green = Math.round(base(value) * 255 * extra);
		var blue = Math.round(base(value + 0.5) * 255 * extra);
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
				console.log("can't place room");
				return false;
			}

			for (var y = r_room.origin.y; y < r_room.origin.y + r_room.dimensions.height; y++) {
				for (var x = r_room.origin.x; x < r_room.origin.x + r_room.dimensions.width; x++) {
					var cell = map_grid[mapg.indexof(x,y)];
					console.log(cell);
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
						cell.name = room.type;
					} else {
						cell = new Cell(x,y);
						cell.type = "room";
						cell.name = room.type;
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
			},
			equals: function(object) {
				return other.x == x && other.y == y;
			}
		});
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
			for (var i = 0; i < new_cells.length; i++) {
				var cell = new_cells[i];
				if (mapg.in_bounds(cell)) {
					var grid_index = mapg.indexof(cell);
					var grid_cell = grid[grid_index];
					if (!grid_cell) {
						grid[grid_index] = cell;
						cell.passable = false;
						cell.type = "wall";
						wall_set.add(cell);
					}
				}
			}
		}
		var add_open_cells = function (room, grid, open_set) {
			var new_cells = [];
			if (!room || !room.dimensions || !room.origin) {
				return;
			} 
			for (var y = room.origin.y - 1; y < room.origin.y + room.dimensions.height + 1; y++) {
				var new_cell = new Cell(room.origin.x - 2, y);
				var new_cell2 = new Cell(room.origin.x + room.dimensions.width + 1, y);
				new_cells.push(new_cell);
				new_cells.push(new_cell2);
			}
			for (var x = room.origin.x - 1; x < room.origin.x + room.dimensions.width + 1; x++) {
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
					//give up and place a 1 square room.
					room.dimensions.width = 1;
					room.dimensions.height = 1;	
					dead_cells = place_room(room, map_grid);
					console.log("give up");
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
		ctx.fillStyle = "#FFFFFF"//"#000000";
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
			var index = globals.room_types[room.type].type_index;
			var col = (index/globals.room_data.length)*2 - 1;
			if (room != globals.current_room) {
				ctx.fillStyle = utilities.colormap_jet(col, .2);
			} else {
				ctx.fillStyle = utilities.colormap_jet(col, 1.5);
			}
			var startX = room.origin.x * cell_width - globals.character.origin.x + globals.centroid.x;
			var width = room.dimensions.width * cell_width;
			var startY = room.origin.y * cell_width - globals.character.origin.y + globals.centroid.y;
			var height = room.dimensions.height * cell_width;
			
			ctx.fillRect(startX , startY, width, height);
			ctx.strokeRect(startX , startY, width, height);
		}
	},
	draw_cells : function(ctx, cells, cell_width, color) {
		var line_width = 2;
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

		var startX = start.x + offset.x;
		var startY = start.y + offset.y;
		var name_str = room.type.replace("_"," ");
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
