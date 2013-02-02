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

		var ratio = this.hiDPIRatio();
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

		cv.addEventListener('click', this.generate_map, true);
		cv.addEventListener('contextmenu', this.relax, true);
		this.generate_map();
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
	relax: function() {
		globals.seed_points = mapgen_functions.voronoi_relaxation(
					globals.voronoi_diagram);
		globals.voronoi_diagram = mapgen_functions.do_voronoi(
					globals.seed_points, globals.bounds);
		var centroids = mapgen_functions.voronoi_relaxation(
					globals.voronoi_diagram);
		var test_points = mapgen_functions.point_check(globals.voronoi_diagram);
		globals.voronoi_diagram = mapgen_functions.refine_land(
					globals.voronoi_diagram, globals.refines);
		globals.refines += 1;
		core.redraw_map(centroids, test_points);
	},
	generate_map: function() {
		globals.refines = 0;
		globals.seed_points = mapgen_functions.generate_seed_points(
					defaults.num_seed_points, globals.bounds);
		globals.voronoi_diagram = mapgen_functions.do_voronoi(
					globals.seed_points, globals.bounds);
		var centroids = mapgen_functions.voronoi_relaxation(
					globals.voronoi_diagram);
		var test_points = mapgen_functions.point_check(globals.voronoi_diagram);
		globals.voronoi_diagram = mapgen_functions.generate_land(
					globals.voronoi_diagram);
		globals.voronoi_diagram = mapgen_functions.refine_land(
					globals.voronoi_diagram);
		globals.voronoi_diagram = mapgen_functions.generate_winds(
					globals.voronoi_diagram);
		var times = 100;
		var genWinds = function() {
			if (times > 90) {
				core.relax();
				globals.genTO = window.setTimeout(genWinds, 2);
			} else if (times > 0) {
				mapgen_functions.refine_winds(globals.voronoi_diagram);
				core.redraw_map(centroids, test_points);
				globals.genTO = window.setTimeout(genWinds, 2);
			}
			times -= 1;
		}
		if (globals.genTO) {
			clearTimeout(globals.genTO);
		}
		genWinds();
	},
	redraw_map: function(centroids, test_points) {
		draw_functions.draw_border(globals.context, 0);
		draw_functions.draw_voronoi(globals.context, globals.voronoi_diagram, 1);
		//draw_functions.draw_elev(globals.context, globals.voronoi_diagram.corners, 4, "#0000FF");
		draw_functions.draw_winds(globals.context, globals.voronoi_diagram.corners, 2, "#0000FF");
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
		return Math.round(Math.random() * (b - a) + a);
	},
	colormap_jet : function(value) {
		var interpolate = function (val, y0, x0, y1, x1) {
		    return (val-x0)*(y1-y0)/(x1-x0) + y0;
		}
		var base = function(val) {
		    if (val <= -0.75) return 0;
		    else if (val <= -0.25) return interpolate( val, 0.0, -0.75, 1.0, -0.25 );
		    else if (val <= 0.25) return 1.0;
		    else if (val <= 0.75) return interpolate( val, 1.0, 0.25, 0.0, 0.75 );
		    else return 0.0;
		}
		value = Math.max(Math.min(1, value),-1);

		var red = Math.round(base(value - 0.5) * 255);
		var green = Math.round(base(value) * 255);
		var blue = Math.round(base(value + 0.5) * 255);
		return "rgb(" + red + ", " + green + ", " + blue + ")";
	}
}
var mapgen_functions = {
	generate_seed_points : function(list_size, bounds) {
		var points = [];
		for (var i = 0; i < list_size; i++) {
			var point = {x:utilities.random_interval(bounds.start_x, bounds.end_x),
					y:utilities.random_interval(bounds.start_y, bounds.end_y)};
			points.push(point);
		}
		return points;
	},
	do_voronoi : function(point_list, bounds) {
		var voronoi = new Voronoi();
		var bbox = {xl:bounds.start_x, xr:bounds.end_x,
			yt:bounds.start_y, yb:bounds.end_y};
		var pl = [{x:1,y:1}, {x:250, y: 250}, {x:100,y:300}];
		var diagram = voronoi.compute(point_list, bbox);
		diagram = mapgen_functions.make_corner_graph(diagram);
		return diagram;
	},
	voronoi_relaxation: function(diagram) {
		var new_points = []
		for (var i = 0; i < diagram.cells.length; i++) {
			var cell = diagram.cells[i];
			var centroid_sum = {x:0, y:0};
			for (var j = 0; j < cell.halfedges.length; j++) {
				var edge_point = cell.halfedges[j].edge.vb;
				centroid_sum.x += edge_point.x;
				centroid_sum.y += edge_point.y;
				edge_point = cell.halfedges[j].edge.va;
				centroid_sum.x += edge_point.x;
				centroid_sum.y += edge_point.y;
			}
			j *= 2;
			var centroid = {x:centroid_sum.x / j, y:centroid_sum.y / j};
			new_points.push(centroid);
		}
		return new_points;
	},
	make_corner_graph : function(diagram) {
		diagram.corners = [];
		for (var i = 0; i < diagram.edges.length; i++) {
			var edge = diagram.edges[i];
			if (edge.va.edges !== undefined) {
				edge.va.edges.push(edge);
			} else {
				edge.va.edges = [edge];
			}
			diagram.corners.push(edge.va);
			if (edge.vb.edges !== undefined) {
				edge.vb.edges.push(edge);
			} else {
				edge.vb.edges = [edge];
			}
		}
		return diagram;
	},
	calculate_elevation:function(point) {
		var sqdist = function(x, y) {
			return x * x + y * y;
		}
		var dx = (point.x - globals.centroid.x);
		var dy = (point.y - globals.centroid.y);
		var min_dim = Math.min(globals.size.width, globals.size.height);
		var size_scale = globals.params.radius_size;
		var nx = size_scale * dx / min_dim;
		var ny = size_scale * dy / min_dim;
		var noise_scale = globals.params.noise_size;
		var sx = noise_scale * dx / globals.size.width;
		var sy = noise_scale * dy / globals.size.height;
		var sqdist_center = sqdist(nx, ny);
		var sqdist_scaled = sqdist_center;
		
		var rnval = globals.noiseObj.noise(sx, sy);
		var distance_penalty = Math.min(1.5,.3 * sqdist_scaled);
		var elevation = Math.max(-1, (rnval + 1.0) / 2.0 - distance_penalty);
		return elevation;
	},
	point_check: function(diagram) {
		var pointset = [];
		for (var i = 0; i < diagram.cells.length; i++) {
			var cell = diagram.cells[i];
			for (var j = 0; j < cell.halfedges.length; j++) {
				var edge = cell.halfedges[j].edge;
				pointset.push(edge.va);
				pointset.push(edge.vb);
			}
		}
		return pointset;
	},
	generate_land: function(diagram) {
		diagram = mapgen_functions.clear_terrain(diagram);
		/* generate perlin noise for coastlines */
		globals.noiseObj = new SimplexNoise();
		return mapgen_functions.refine_land(diagram);
	},
	generate_winds: function(diagram) {
		var ffield = new FluidField();
		ffield.setResolution(Math.round(globals.size.height/defaults.wind_scale),
				      Math.round(globals.size.width/defaults.wind_scale));
		for (var i = 0; i < globals.size.width; i++) {
			for (var j = 0; j < globals.size.height; j++) {
				var x = Math.round(i/defaults.wind_scale);
				var y = Math.round(j/defaults.wind_scale);
				var elev = mapgen_functions.calculate_elevation({x:i,y:j});
				ffield.setObstacle(x, y, Math.max(0,elev - .5));
			}
		}
		globals.wind_field = ffield;
		return diagram;
	},
	refine_winds: function(diagram) {
		var ffield = globals.wind_field;
		var width = Math.round(globals.size.width/defaults.wind_scale);
		var height = Math.round(globals.size.height/defaults.wind_scale);
		for (var i = 0; i < width; i++) {
			ffield.setDensity(i, 0, .5);
			ffield.setVelocity(i, 0, 0, 5);
			ffield.setDensity(i, height, 0);
			ffield.setDensity(i, height-1, 0);
			ffield.setDensity(i, height-2, 0);
			ffield.setVelocity(i, height, Math.random() * 2 - 1, 5);
		}
		globals.wind_field.update();
		return diagram;
	},
	refine_land: function(diagram, iterations) {
		var is_coast = function(edge) {
			if (!edge.rSite)
				return "NORMAL";
			var type1 = diagram.cells[edge.lSite.voronoiId].type;
			var type2 = diagram.cells[edge.rSite.voronoiId].type;
			if (type1 !== type2) {
				return "COAST";
			} else {
				return "NORMAL";
			}
		}
		var iterate_river = function(start_points, chance) {
			var end_points = []
			for (var i = 0; i < start_points.length; i++) {
				if (Math.random() < chance) {
					var start = start_points[i];
					var orig_elev = start.elevation;
					var old_gain = -1000000;
					var up_edge = start.edges[0];
					var up_other = start;
					for (var j = 0; j < start.edges.length; j++) {
						var pEdge = start.edges[j];
						if (!pEdge.rSite) {
							continue;
						}
						var other;
						if (start === pEdge.va) {
							other = pEdge.vb;
						} else {
							other = pEdge.va;
						}
						var gain = other.elevation - start.elevation;
						var cell1 = diagram.cells[pEdge.lSite.voronoiId];
						var cell2 = diagram.cells[pEdge.rSite.voronoiId];

						if (gain > old_gain && pEdge.type === "NORMAL"
						    		&& cell1.type == "LAND"
					    			&& cell2.type == "LAND") {
							old_gain = gain;
							up_edge = pEdge;
							up_other = other;
						}
					}
					if (old_gain > 0) {
						up_edge.type = "RIVER";
						end_points.push(other);
					}
				}
			}
			return end_points;
		}
		for (var i = 0; i < diagram.corners.length; i++) {
			var corner = diagram.corners[i];
			corner.elevation = mapgen_functions.calculate_elevation(corner);
		}
		for (var i = 0; i < diagram.cells.length; i++) {
			var cell = diagram.cells[i];
			var elev_sum = 0;
			for (var j = 0; j < cell.halfedges.length; j++) {
				var point = cell.halfedges[j].getStartpoint();
				elev_sum += point.elevation;
			}
			cell.elevation = elev_sum / cell.halfedges.length;
			if (cell.elevation > 0) {
				cell.type = "LAND";
			} else {
				cell.type = "WATER";
			}
		}
		var river_chance = 0;
		var start_points = [];
		for (var i = 0; i < diagram.edges.length; i++) {
			var edge = diagram.edges[i];
			edge.type = is_coast(edge);
			
			if (edge.type == "COAST") {
				/* chance of being a river */
				start_points.push(edge.va);
			}
		}
		for (var i = 0; i < 10; i++) {
			start_points = iterate_river(start_points, river_chance);
			river_chance *= 1.5;
		}
		return diagram;
	},
	clear_terrain: function(diagram) {
		for (var i = 0; i < diagram.cells.length; i++) {
			var cell = diagram.cells[i];
			cell.type = "NONE";
		}
		return diagram;
	}
}
var draw_functions = {
	draw_winds : function(ctx, point_list, radius, color) {
		radius = radius || 1;
		globals.context.fillStyle = color || "#000000";
		var field = globals.wind_field;
		for (var i = 0; i < point_list.length; i++) {
			var point = point_list[i];
			var u = field.getXVelocity(Math.round(point.x/defaults.wind_scale),
						       Math.round(point.y/defaults.wind_scale));
			var v = field.getYVelocity(Math.round(point.x/defaults.wind_scale),
						       Math.round(point.y/defaults.wind_scale));
			var density = field.getDensity(Math.round(point.x/defaults.wind_scale),
						       Math.round(point.y/defaults.wind_scale));
			var speed = Math.sqrt(u*u + v*v);
			var s = utilities.colormap_jet(speed * 5);
			ctx.fillStyle = s;
			ctx.beginPath();
			ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
			ctx.fill();
		}
	},
	draw_elev : function(ctx, point_list, radius, color) {
		radius = radius || 1;
		globals.context.fillStyle = color || "#000000";
		var field = globals.wind_field;
		for (var i = 0; i < point_list.length; i++) {
			var point = point_list[i];
			var pt = {
				x:Math.round(point.x/defaults.wind_scale) * defaults.wind_scale,
				y:Math.round(point.y/defaults.wind_scale) * defaults.wind_scale}
			var elev = mapgen_functions.calculate_elevation(pt);
			var s = utilities.colormap_jet(elev);
			ctx.fillStyle = s;
			ctx.beginPath();
			ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
			ctx.fill();
		}
	},
	draw_points : function(ctx, point_list, radius, color) {
		radius = radius || 1;
		globals.context.fillStyle = color || "#000000";
		for (var i = 0; i < point_list.length; i++) {
			var point = point_list[i];
			if (point.elevation) {
				var s = utilities.colormap_jet(point.elevation);
				ctx.fillStyle = s;
			}
			ctx.beginPath();
			ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
			ctx.fill();
		}
	},
	draw_voronoi : function(ctx, voronoi, thickness, color) {
		globals.context.strokeStyle = color || "#000000";
		globals.lineWidth = thickness || 1;
		var rgbstr = function(r,g,b) {
			return "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
		}

		for (var i = 0; i < voronoi.cells.length; i++) {
			var cell = voronoi.cells[i];
			if (cell.type == "LAND") {
				var elev = cell.elevation;
				var st = rgbstr(100 - elev * 100,  120 + elev * 135, 100 - 80 * elev);
				ctx.fillStyle = st;
			} else if (cell.type == "WATER") {
				var elev = 1 + cell.elevation;
				var st = rgbstr(30 + elev * 30, 60 + elev * 40, 100 + 50 * elev);
				ctx.fillStyle = st;
			} else {
				ctx.fillStyle = "#505050";
			}
			
			var spoint = cell.halfedges[0].getStartpoint();
			ctx.beginPath();
			ctx.moveTo(spoint.x,spoint.y);
			for (var j = 1; j < cell.halfedges.length; j++) {
				var point = cell.halfedges[j].getStartpoint();
				ctx.lineTo(point.x, point.y);
			}
			ctx.fill();
		}
		for (var i = 0; i < voronoi.edges.length; i++) {
			var edge = voronoi.edges[i];
			if (edge.type == "COAST") {
				ctx.lineWidth = globals.lineWidth * 3;
				ctx.strokeStyle = "#A09030";
			} else if (edge.type == "RIVER") {
				ctx.lineWidth = globals.lineWidth * 2;
				ctx.strokeStyle = "#0000FF";
			} else if (edge.type == "NORMAL") {
				ctx.lineWidth = globals.lineWidth;
				ctx.strokeStyle = "#202020";
			} else {
				ctx.lineWidth = globals.lineWidth;
				ctx.fillStyle = "#505050";
			}
			ctx.beginPath();
			ctx.moveTo(edge.va.x, edge.va.y);
			ctx.lineTo(edge.vb.x, edge.vb.y);
			ctx.stroke();
		}
	},
	draw_border : function(ctx, width) {
		var cv = globals.canvas[0];
		ctx.fillStyle = "#000000";
		ctx.fillRect(0, 0, cv.width, cv.height);
		ctx.fillStyle = "#FFFFFF";
		ctx.fillRect(width, width,
				cv.width - width * 2, cv.height - width * 2);
	}
}

core.init();
});
