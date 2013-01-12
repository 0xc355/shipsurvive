(function () {
    "use strict";
    /**
     * Created with JetBrains WebStorm.
     * User: Excess
     * Date: 1/11/13
     * Time: 6:51 PM
     * To change this template use File | Settings | File Templates.
     */

    //frametimer stuff?
    var timer = new FrameTimer();
    timer.tick();

    var sprites = new SpriteSheet({
        width:5 * 4,
        height:3 * 4,
        sprites:[
            { name:'stand' },
            { name:'eat'}
        ]
    });
    var birdImage = new Image();


    birdImage.src = 'images/bird_sheet4x.png';


/* set up canvas to not smooth pixels */
    var canvas = document.getElementById('b');
    var ctx = document.getElementById('b').getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;


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
    heroImage.src = "images/hero.png";
    heroImage.width = 40;
    heroImage.height = 68;


//load cloud image
    var cloudReady = false;
    var cloudImage = new Image();
    cloudImage.onload = function () {
        cloudReady = true;
    };
    cloudImage.src = "images/cloud1.png";
    cloudImage.height = 26;
    cloudImage.width = 112;

//load birds
    var birdReady = true;


//////////Game objects


//game over variable
    var gameOver = false;
//this is the player
    var hero = {
        speed: 250, //movement in pixels per second
        x: 0,
        y: 0,
        box: {width: heroImage.width, height: heroImage.height}
    };
    var resetRandom = function (obj) {
        //Throw the monster somewhere on the screen
        obj.x = obj.box.width + (Math.random() * (canvas.width - obj.box.width * 2));
        obj.y = obj.box.height + (Math.random() * (canvas.height - obj.box.height * 2));
    };


///create clouds array
    var clouds = [];
///this spawns the clouds into the array
    var spawnClouds = function () {
        for (var i = 0; i < 20; i++) {
            var cloud = {
                x:0,
                y:0
            };
            //create a lot of monsters
            cloud.box = {width:31, height:25};
            resetRandom(cloud);
            clouds.push(cloud);

        }
    };

///spawn clouds intially
    spawnClouds();


///create birds array
    var birds = [];

///this spawns the birds into the array
    var spawnBirds = function () {
        for (var i = 0; i < 20; i++) {
            var speed = .2;
            var bird = {
                x: 0,
                y: 0,
                walk: new Animation([
                { sprite:'stand', time:speed },
                { sprite:'eat', time:speed }], sprites)
            };
            //create a lot of birds
            bird.box = {width:31, height:25};
            bird.walk.animate(Math.random() * .2);
            resetRandom(bird);
            birds.push(bird);
        }
    };

///spawn birds intially
    spawnBirds();


///collision detected?
    function intersectsBox(objA, objB) {
        if (objB.x <= (objA.x + objA.box.width)
            && objA.x <= (objB.x + objB.box.width)
            && objB.y <= (objA.y + objA.box.height)
            && objA.y <= (objB.y + objB.box.height))
            return true;
    }


    var randomNumber = 0;


//Handle keyboard controls
    var keysDown = {};

    addEventListener("keydown", function (e) {
        keysDown[e.keyCode] = true;
    }, false);

    addEventListener("keyup", function (e) {
        delete keysDown[e.keyCode];
    }, false);


//Update game objects
    var update = function (modifier) {





        //bind keyboard controls
        if (38 in keysDown) { //player holding up
            hero.y -= hero.speed * modifier;
        }
        if (40 in keysDown) { //player holding down
            hero.y += hero.speed * modifier;
        }
        if (37 in keysDown) { //player holding left
            heroImage.src = "images/hero.png";

            hero.x -= hero.speed * modifier;
        }
        if (39 in keysDown) { //player holding right
            hero.x += hero.speed * modifier;
        }


    };


//Draw everything
    var render = function (delta) {
        if (bgReady) {
            ctx.drawImage(bgImage, 0, 0, 528, 464);
        }
        if (gameOver) {
            heroReady = false;
            ctx.fillText("You starved to death!", 325, 290);
        }
        else if (heroReady) {
            ctx.drawImage(heroImage, hero.x, hero.y, heroImage.width, heroImage.height);
        }

        if (cloudReady) {
            for (var i = 0; i < clouds.length; i++) {
                ctx.drawImage(cloudImage, clouds[i].x, clouds[i].y, cloudImage.width, cloudImage.height);
            }
        }

        if (birdReady) {
            for (var i = 0; i < clouds.length; i++) {
                birds[i].walk.animate(delta);
                var frame = birds[i].walk.getSprite();
                ctx.drawImage(birdImage, frame.x, frame.y, 5 * 4, 3 * 4, birds[i].x, birds[i].y, 5 * 4, 3 * 4)
            }
        }
    };

//Main game loop
    var main = function () {
        var now = Date.now();
        var delta = (now - then) / 1000;

        update(delta);
        render(delta);

        then = now;
    };

//Play
    var then = Date.now();
    setInterval(main, 5); //execute as fast as possible
})();