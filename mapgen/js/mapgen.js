/* generates a map graph */
$(function(){
 "use strict";
var globals = {},
defaults = {
	background: 'white',
	font: '14px Arial',
	num_seed_points: 200
},
containers = {};

/* core functions */

var core = {
	init: function() {
		globals.canvas = $('#board');
		var cv = globals.canvas[0];
		console.log($('#board'));
		globals.context = cv.getContext('2d');
		globals.context.background = defaults.background;
		globals.bounds = {
			start_x: 5, start_y: 5,
			end_x: globals.canvas[0].width-5,
			end_y: globals.canvas[0].height-5
		};
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
	relax: function() {
		
		globals.seed_points = mapgen_functions.voronoi_relaxation(
					globals.voronoi_diagram);
		globals.voronoi_diagram = mapgen_functions.do_voronoi(
					globals.seed_points, globals.bounds);
		var centroids = mapgen_functions.voronoi_relaxation(
					globals.voronoi_diagram);
		var test_points = mapgen_functions.point_check(globals.voronoi_diagram);
		globals.voronoi_diagram = mapgen_functions.generate_land(
					globals.voronoi_diagram);
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
		core.redraw_map(centroids, test_points);
	},
	redraw_map: function(centroids, test_points) {
		draw_functions.draw_border(globals.context, 0);
		draw_functions.draw_points(globals.context, globals.seed_points, 2);
		draw_functions.draw_points(globals.context, centroids, 2, "#FF0000");
		draw_functions.draw_points(globals.context, test_points, 2, "#0000FF");
		draw_functions.draw_voronoi(globals.context, globals.voronoi_diagram, 1);
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
		for (var i = 0; i < diagram.cells.length; i++) {
			var cell = diagram.cells[i];
			var rnval = Math.random();
			if (rnval < .5) {
				cell.type = "LAND";
			} else {
				cell.type = "WATER";
			}
		}
		return diagram;
	},
	refine_land: function(diagram, iterations) {
		for (var n = 0; n < iterations; n++) {
			for (var i = 0; i < diagram.cells.length; i++) {
				var cell = diagram.cells[i];
				var types = {"LAND":0, "WATER":0, "NONE":0};
				for (var j = 0; j < cell.halfedges.length; j++) {
					var hedge = cell.halfedges[j];
					var other_cell = hedge.edge.rSite;
					if (other_cell) {
						var other_site = diagram.cells[other_cell.voronoiId];
						types[other_site.type] += 1;
					}
				}
				if (types["LAND"] > types["WATER"]) {
					cell.type = "LAND";
				} else {
					cell.type = "WATER";
				}
			}
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
	draw_points : function(ctx, point_list, radius, color) {
		radius = radius || 1;
		globals.context.fillStyle = color || "#000000";
		for (var i = 0; i < point_list.length; i++) {
			var point = point_list[i];
			ctx.beginPath();
			ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
			ctx.fill();
		}
	},
	draw_voronoi : function(ctx, voronoi, thickness, color) {
		globals.context.strokeStyle = color || "#000000";
		globals.lineWidth = thickness || 1;

		for (var i = 0; i < voronoi.cells.length; i++) {
			var cell = voronoi.cells[i];
			if (cell.type == "LAND") {
				ctx.fillStyle = "#40E045";
			} else if (cell.type == "WATER") {
				ctx.fillStyle = "#1055E0";
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
