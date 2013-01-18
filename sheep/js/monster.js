
//////frametimer stuff?
var timer = new FrameTimer();
timer.tick();

//////set up canvas to not smooth pixels
var canvas = document.getElementById('b');
var ctx = document.getElementById('b').getContext("2d");
ctx.imageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false;

var bounds = {x:0, y:0, box:{width:960, height:640}};
//load Background image
var bgReady = false;
var bgImage = new Image();
bgImage.onload = function () {
	bgReady = true;
};
bgImage.src = "images/background.png";

//load hero image
var heroReady = false;
var heroImage = new Image();
heroImage.onload = function () {
	heroReady = true;
};
heroImage.src = "images/troll.png";
heroImage.height = 68;
heroImage.width = 27;

var openImage = new Image();
openImage.src = "images/troll_open.png";
openImage.height = 68;
openImage.width = 27;


//load hunger meter image
var hungerMeterReady = false;
var hungerMeterImage = new Image();
hungerMeterImage.onload = function () {
	hungerMeterReady = true;
};
hungerMeterImage.src = "images/hunger_meter.png";
hungerMeterImage.height = 240;
hungerMeterImage.width = 16;

//load eat image
var eatReady = false;
var eatImage = new Image();

eatImage.src = "images/troll_eat.png";
eatImage.height = 47;
eatImage.width = 40;

var currentImage = heroImage;
//load dead image
var heroDeadReady = false;
var heroDeadImage = new Image();
heroDeadImage.src = "images/dead.png";
heroDeadImage.height = 68;
heroDeadImage.width = 27;


///monster eaten
var monstersCaught = 0;


//monster image (sheep are monsters!)
var monsterReady = false;
var monsterImage = new Image();
monsterImage.onload = function () {
	monsterReady = true;
};
monsterImage.src = "images/sheep.png";
monsterImage.width = 31;
monsterImage.height = 25;

var lastClicked = {x:0,y:0};
var mouse_on = false;

var getMousePos = function (canvas, evt) {
	var rect = canvas.getBoundingClientRect();
	return {
	  x: evt.clientX - rect.left,
	  y: evt.clientY - rect.top
	};
};

var mouse_down_f = function (event) {
	mouse_on = true;
	lastClicked = getMousePos(canvas, event);
};
var mouse_move_f = function (event) {
	lastClicked = getMousePos(canvas, event);
};
var mouse_up_f = function (event) {
	mouse_on = false;
};

canvas.addEventListener('mousedown', mouse_down_f, true);
canvas.addEventListener('mousemove', mouse_move_f, true);
canvas.addEventListener('mouseup', mouse_up_f, true);

//////////Game objects


//game over variable
var gameOver = false;

//this is the player
var hero = {
	speed: 512, //movement in pixels per second
	x: 0,
	y: 0,
	box:{width: heroImage.width, height: heroImage.height}
};

//this is the player's 'eat' sprite
var eat = {
	speed: 512,
	x: 0,
	y: 0,
	box:{width: eatImage.width + 7, height: eatImage.height + 20}
};

//this is the hunger meter getting loaded
var hungerMeter = {
	x: 30,
	y: 320,
};

//set the total HUNGER points
var maxHungerPoints = 100;
var hungerPoints = 100;

//set hunger meter to scale and stay in position based on hunger points
function checkHunger(){
	hungerMeterImage.height = 240 * hungerPoints/maxHungerPoints;
	hungerMeter.y = 320 + (240 - hungerMeterImage.height);
}

//the 'make hungrier' function
function moreHungry(){
	if (hungerPoints > 0)
		hungerPoints = hungerPoints - 1;
	else
		gameOver = true;

};

//finally, make hunger naturally decrease over time
var createHunger = setInterval(moreHungry, 150); //runs the moreHungry function every 175 milliseconds

// Reset the game when the player catches a monster
var resetCenter = function(objA) {
	objA.x = canvas.width/2;
	objA.y = canvas.height/2;
};

var resetRandom = function (obj) {
	//Throw the monster somewhere on the screen
	obj.x = obj.box.width + (Math.random() * (canvas.width - obj.box.width * 2));
	obj.y = obj.box.height + (Math.random() * (canvas.height - obj.box.height * 2));
};

var resetPathing = function(obj) {
	obj.speed = Math.random()*30 + 20;
	obj.direction = Math.random()*2*Math.PI;
	obj.duration = Math.random()*5;
}

//move so object is at the closest point inside the bounds
var moveInsideBounds = function(obj, bounds) {
	obj.x = Math.min(bounds.x+bounds.box.width, Math.max(obj.x, bounds.x));
	obj.y = Math.min(bounds.y+bounds.box.height, Math.max(obj.y, bounds.y));
}

///create monsters array
monsters = [];

///this spawns the monsters into the array
var spawnMonsters = function (){
	for (i = 0; i < 50; i++) {
		var monster = {
			x: 0,
			y: 0,
			tPosition:0,
			stuck: false
		};
		//create a lot of monsters
		monster.box = {width: 31, height:25};
		resetRandom(monster);
		resetPathing(monster);
		monsters.push(monster);
	}
};

///spawn monsters intially
spawnMonsters();



///collision detected?
function intersectsBox(objA, objB) {
	if (objB.x <= (objA.x + objA.box.width)
	    && objA.x <= (objB.x + objB.box.width)
    && objB.y <= (objA.y + objA.box.height)
    && objA.y <= (objB.y + objB.box.height))
    return true;
}


//// spawn monsters onces monsters are dead
function checkGameEnd() {
	if (monsters.length < 1)
		spawnMonsters();
}

//how fast the hero grows dawg
////growthRatio = (Math.sin(randomNumber)+1)/randomNumber;

randomNumber = 0;

//grow the hero, up to a maximum 4x starting size
function growHero(){
	if (randomNumber < 3){
		heroImage.width = 27 * (randomNumber + 1);
		heroImage.height = 68 * (randomNumber + 1);
		openImage.width = 27 * (randomNumber + 1);
		openImage.height = 68 * (randomNumber + 1);
		hero.box.width = 27 * (randomNumber + 1);
		hero.box.height = 68 * (randomNumber + 1);
		eatImage.width = 40 * (randomNumber + 1);
		eatImage.height = 47 * (randomNumber + 1);
		randomNumber = monstersCaught*0.04
	}

}

//Handle keyboard controls
var keysDown = {};

addEventListener("keydown", function (e) {
	keysDown[e.keyCode] = true;
}, false);

addEventListener("keyup", function (e) {
	delete keysDown[e.keyCode];
}, false);

var facing_left = false;
var tongueOut = false;
var tongueRetracting = false;
var tongueLength = 0;
var maxTongueLength = 400;
var tongueAttachPoint = {x:0, y:0};
var tongueEndPoint = {x:0, y:0};
var targetDistance = 0;
var tongueTarget = {x:0, y:0};
var tongueAngle = 0;
//Update game objects 
var update = function (modifier) {
	eatReady = false;
	checkHunger();

	//bind keyboard controls   
	if (87 in keysDown) { //player holding up
		hero.y -= hero.speed * modifier;
		eat.y -= hero.speed * modifier;
	}
	if (83 in keysDown) { //player holding down
		hero.y += hero.speed * modifier;
		eat.y += hero.speed * modifier;
	}
	if (65 in keysDown) { //player holding left
		facing_left = true;
		hero.x -= hero.speed * modifier;
		eat.x -= hero.speed * modifier;
	}
	if (68 in keysDown) { //player holding right
		facing_left = false;
		hero.x += hero.speed * modifier;
		eat.x += hero.speed * modifier;
	}
	maxTongueLength = Math.min(heroImage.width * 10, 1000);
	if (tongueOut) {
		tongueTarget = lastClicked;
		tongueAttachPoint.x = hero.x + openImage.width / 2;
		var tongueXOffset = 3 + randomNumber * 4;
		if (32 in keysDown) {
			tongueAttachPoint.y = hero.y + eatImage.height * .75;
			tongueXOffset += randomNumber * 2;
		} else {
			tongueAttachPoint.y = hero.y + openImage.height * .2;
		}
		if (facing_left) {
			tongueAttachPoint.x -= tongueXOffset;
		} else {
			tongueAttachPoint.x += tongueXOffset;
		}
		tongueAngle = Math.atan2(tongueTarget.y - tongueAttachPoint.y,
					 tongueTarget.x - tongueAttachPoint.x);
		var targTongueLength = Math.min(maxTongueLength, get_distance(tongueTarget, tongueAttachPoint));
		if (tongueRetracting) {
			if (tongueLength > 0) {
				tongueLength = tongueLength - modifier * targTongueLength * 4;
			} else {
				tongueLength = 0;
				tongueRetracting = false;
				tongueOut = false;
				for (i = 0; i < monsters.length; i++) {
					monsters[i].tPosition = 0;
					monsters[i].stuck = false;
				}
			}
		} else {
			if (tongueLength < targTongueLength - .01) {
				tongueLength = Math.min(tongueLength + modifier * targTongueLength * 4,
							targTongueLength);
			} else {
				tongueLength = targTongueLength;
				tongueRetracting = true;
			}
		}
		console.log(tongueAngle);
		console.log(tongueLength);
		tongueEndPoint.x = tongueAttachPoint.x + tongueLength * Math.cos(tongueAngle);
		tongueEndPoint.y = tongueAttachPoint.y + tongueLength * Math.sin(tongueAngle);
	}
	if (mouse_on && !tongueOut && !gameOver) {
		tongueOut = true;
		tongueRetracting = false;
	}
	if (gameOver) {
		eatReady = false;
		tongueOut = false;
	} else if (32 in keysDown) {
		eatReady = true;
		hero.speed = 0;	
	} else {
		heroReady = true;
		hero.speed = 512;	
	}

	for (i = 0; i < monsters.length; i++) {
		var dist_to_tongue = get_distance(tongueAttachPoint, monsters[i]);
		if (intersectsBox(hero, monsters[i]) && eatReady) {
			++monstersCaught;
			++hungerPoints;
			monsters.splice(i,1);
			growHero();
			checkGameEnd();
		} else if (tongueOut && monsters[i].stuck) {
			var monster = monsters[i];
			var monsterDistance = Math.min(tongueLength, monster.tPosition);
			monster.x = tongueAttachPoint.x + monsterDistance * Math.cos(tongueAngle);
			monster.y = tongueAttachPoint.y + monsterDistance * Math.sin(tongueAngle);
			monster.x -= monsterImage.width/2;
			monster.y -= monsterImage.height/2;
		} else if (tongueOut && lineRectIntersects(tongueAttachPoint, tongueEndPoint, monsters[i])
			  && dist_to_tongue > 40) {
			var monster = monsters[i];
			monster.tPosition = dist_to_tongue;
			monster.stuck = true;
		} else {
			var monster = monsters[i];
			monster.stuck = false;
			if (intersectsBox(monster, bounds)) {
				if (monster.duration > 0) {
					monster.x += modifier * monster.speed * Math.cos(monster.direction);
					monster.y += modifier * monster.speed * Math.sin(monster.direction);
					monster.duration -= modifier;
				} else {
					resetPathing(monster);
				}
			} else {
				moveInsideBounds(monster, bounds);
				resetPathing(monster);
			}
		}
	}
};

//Draw everything
var render = function () {
	if (bgReady) {
		ctx.drawImage(bgImage, 0, 0, 960, 640);
	}

	var hunger_y = 200 * hungerPoints/maxHungerPoints;
	ctx.fillStyle = "#FF0000";
	ctx.fillRect(30, 540 - hunger_y, 20, hunger_y);

	if (gameOver) {
		heroReady = false;
		heroDeadReady = true;
		ctx.fillText("You starved to death!", 325, 290);
	}
	else if (heroReady) {
		var drawY = 0;
		var extraX = 0;
		if (eatReady) {
			currentImage = eatImage;
			drawY = heroImage.height - eatImage.height;
			extraX = heroImage.width * .3;
		} else if (tongueOut) {
			currentImage = openImage;
		} else {
			currentImage = heroImage;
		}
		if (facing_left) {
			ctx.translate(hero.x, hero.y);
			ctx.scale(-1,1);
			ctx.drawImage(currentImage, -currentImage.width + extraX, drawY,
				      currentImage.width, currentImage.height);
			ctx.scale(-1,1);
			ctx.translate(-hero.x, -hero.y);
		} else {
			ctx.drawImage(currentImage, hero.x, hero.y + drawY,
				      currentImage.width, currentImage.height);
		}
		if (tongueOut) {
			ctx.strokeStyle = "#FF4040";
			ctx.lineWidth = 2 + randomNumber * 2;
			ctx.beginPath();
			ctx.moveTo(tongueAttachPoint.x, tongueAttachPoint.y);
			ctx.lineTo(tongueEndPoint.x, tongueEndPoint.y);
			ctx.stroke();
		}
	}
	if (monsterReady) {
		for (i = 0; i < monsters.length; i++) {
			ctx.drawImage(monsterImage, monsters[i].x, monsters[i].y,
				      monsterImage.width, monsterImage.height);
		}
		if (heroDeadReady) {
			hero.speed = 0;
			ctx.drawImage(heroDeadImage, hero.x , hero.y, heroImage.width, heroImage.height);
		}
	}
	//Score
	ctx.fillStyle = "rgb(0, 0, 0)";
	ctx.font = "bold 30 px Helvetica";
	ctx.textAlign = "left";
	ctx.textBaseline = "top";
	ctx.fillText("Sheep consumed: " + monstersCaught, 27, 32);
	ctx.fillText("Press SPACE to eat sheep!", 27, 64);
	ctx.fillText("Hunger", 27, 560);
	ctx.fillText("Meter", 27, 595);
}

//Main game loop
var main = function () {
	var now = Date.now();
	var delta = now - then;

	update(delta / 1000);
	render();

	then = now;
};

//Play
resetCenter(hero);
resetCenter(eat);
var then = Date.now();
setInterval(main, 5); //execute as fast as possible
