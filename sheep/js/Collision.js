"use strict"
var get_distance = function (obj1, obj2) {
	var dx = obj2.x - obj1.x;
	var dy = obj2.y - obj1.y;
	return Math.sqrt(dx*dx + dy*dy);
}
var insideRect = function(p, rect) {
	return p.x > rect.x && p.x < (rect.x + rect.box.width) && 
		p.y > rect.y && p.y < (rect.y + rect.box.height);
}
var lineLineIntersects = function(a1, a2, b1, b2) {
    var ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
    var ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x);
    var u_b  = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);

    if ( u_b != 0 ) {
        var ua = ua_t / u_b;
        var ub = ub_t / u_b;

        if ( 0 <= ua && ua <= 1 && 0 <= ub && ub <= 1 ) {
		return true;
        } else {
		return false;
        }
    } else {
	    return true;
    }
}
var lineRectIntersects = function(p1, p2, rect) {
	if (!p1 || !p2 || !rect) {
		return false;
	}
	if (get_distance(p1,p2) < .1) {
		return false;
	}
	if (insideRect(p1, rect) || insideRect(p2, rect))
		return true;
	var tl = {x:rect.x, y:rect.y};
	var tr = {x:rect.x + rect.box.width, y:rect.y};
	var bl = {x:rect.x, y:rect.y + rect.box.height};
	var br = {x:rect.x + rect.box.width, y:rect.y + rect.box.height};
	return lineLineIntersects(p1, p2, tl, tr) ||
		lineLineIntersects(p1, p2, tr, br) ||
		lineLineIntersects(p1, p2, br, bl) ||
		lineLineIntersects(p1, p2, bl, tl);
};
