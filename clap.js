window.addEventListener("load", function () {
    var easing = {
        linear: function (x) {
            return x;
        },
        singlePower: function (n) {
            return function (x) {
                return Math.pow(x, n);
            };
        }
    };
    function animate (fn, init, start, end, time, ease, callback) {
        ease = ease || easing.linear;
        var sTime = Date.now();
        var prev = init;
        function dn () {
            var pTime = Date.now() - sTime;
            var nowRat = Math.max(Math.min(pTime / time, 1), 0);
            var now = start + ease(nowRat) * (end - start);
            var stop = fn(now - prev);
            prev = now;
            if (nowRat < 1 && !stop)
                requestAnimationFrame(dn);
            else if (stop) {
                fn(stop - prev);
                prev = stop;
                if (callback)
                    callback();
            } else if (callback)
                callback();
        }
        dn();
    }
    var engine = Matter.Engine.create();
    engine.timing.timeScale = 1;
    var render = Matter.Render.create({
        element: document.body,
        engine: engine,
        options: {
            background: "#ffffff",
            showVelocity: false,
            wireframes: false,
            hasBounds: true
        }
    });

    Matter.Events.on(engine, "beforeUpdate", function () {
        var bodies = Matter.Composite.allBodies(engine.world);
        bodies.forEach(function (b, i) {
            if (b.position.y > 1200 || b.position.x > 1500 || b.position.y < -1000 || b.position.x < -500) {
                Matter.Events.trigger(b, 'beforeFallOut', {});
                Matter.Composite.remove(engine.world, b, true);
            }
        })
    });

    Matter.Render.run(render);

    /*
    * Moblie-friendly:
    *   view = 700 x 400
    *   Auto scale (center)
    */
    var sceneWid = 400;
    var sceneHig = 700;

    function calcWorldPoint (clientX, clientY) {
        var sWid = render.bounds.max.x - render.bounds.min.x;
        var sHig = render.bounds.max.y - render.bounds.min.y;
        var xScaled = sWid / render.canvas.width * clientX;
        var yScaled = sHig / render.canvas.height * clientY;
        var xWorld = xScaled + render.bounds.min.x;
        var yWorld = yScaled + render.bounds.min.y;
        return {x: xWorld, y: yWorld};
    }

    var draging = null;
    var dragTouchId = null;
    var draglock = false;
    function isFired (body) {
        return body.label == "fire";
    }
    Matter.Events.on(engine, "collisionEnd", function (evt) {
        var pairs = evt.pairs;
        pairs.forEach(function (pair) {
            if(isFired(pair.bodyA)) {
                Matter.Events.trigger(pair.bodyB, "collideFire", {fire: pair.bodyA, removeFire: function () {
                    Matter.Composite.remove(engine.world, pair.bodyA);
                    stopTimeScaleAnimation = true;
                }});
            } else if (isFired(pair.bodyB)) {
                Matter.Events.trigger(pair.bodyA, "collideFire", {fire: pair.bodyB, removeFire: function () {
                    Matter.Composite.remove(engine.world, pair.bodyB);
                    stopTimeScaleAnimation = true;
                }});
            }
        });
    });
    document.body.addEventListener("mousedown", function (evt) {
        evt.preventDefault();
        if (draglock)
            return;
        draging = calcWorldPoint(evt.clientX, evt.clientY);
    });
    function createFire (clientX, clientY) {
        var forceScale = 1/3;
        var worldpt = calcWorldPoint(clientX, clientY);
        var force = {x: (worldpt.x - draging.x) * forceScale, y: (worldpt.y - draging.y) * forceScale};
        var fire = Matter.Bodies.circle(draging.x, draging.y, 15, {
            density: 3,
            label: "fire",
            render: {
                fillStyle: "#000",
                strokeStyle: "transparent"
            },
            restitution: 1
        });
        Matter.Body.applyForce(fire, draging, force);
        Matter.Composite.add(engine.world, fire);
        draging = null;
    }
    document.body.addEventListener("mouseup", function (evt) {
        evt.preventDefault();
        if (draging) {
            createFire(evt.clientX, evt.clientY);
        }
    });
    document.body.addEventListener("touchstart", function (evt) {
        evt.preventDefault();
        if (evt.touches.length == 1 && !draglock) {
            var touchInvolved = evt.touches[0];
            draging = calcWorldPoint(touchInvolved.clientX, touchInvolved.clientY);
            dragTouchId = touchInvolved.identifier;
        }
    });
    document.body.addEventListener("touchend", function (evt) {
        evt.preventDefault();
        if (draging && dragTouchId !== null) {
            Array.prototype.find.call(evt.changedTouches, function (touch) {
                if (dragTouchId !== null && touch.identifier == dragTouchId) {
                    dragTouchId = null;
                    createFire(touch.clientX, touch.clientY);
                    return true;
                }
                return false;
            });
        }
    });

    function wall (x0, y0, x1, y1) {
        var wid = x1 - x0;
        var hig = y1 - y0;
        var wbody = Matter.Bodies.rectangle(x0 + wid / 2, y0 + hig / 2, wid, hig, {
            render: {
                fillStyle: "#ccc",
                strokeStyle: "#333"
            },
            isStatic: true
        });
        Matter.Composite.add(engine.world, wbody);
    }
    wall(0, -500, 10, sceneHig + 500);
    wall(sceneWid - 10, -500, sceneWid, sceneHig + 500);

    function startGame (over) {
        var dest = Matter.Bodies.circle(Math.random() * (sceneWid - 20) + 10, sceneHig, 30, {
            density: 0.5,
            label: "dest",
            render: {
                fillStyle: "#0b0",
                strokeStyle: "#bbb"
            },
            restitution: 1
        });
        setTimeout(function () {
            Matter.Body.applyForce(dest, dest.position, {x: 0, y: -100});
        }, 100);
        Matter.Composite.add(engine.world, dest);
        Matter.Events.on(dest, "beforeFallOut", function () {
            over();
        });
    }
    function overHandle () {
        startGame(overHandle);
    }

    function onResize () {
        var wid = window.innerWidth;
        var hig = window.innerHeight;
        render.canvas.width = render.options.width = wid;
        render.canvas.height = render.options.height = hig;
        var scale1 = hig / sceneHig;
        var scale2 = wid / sceneWid;
        var scaleR = Math.min(scale1, scale2);
        var nWid = sceneWid * scaleR;
        var nHig = sceneHig * scaleR;
        var offX = (wid - nWid) / 2;
        var offY = (hig - nHig) / 2;
        // 1 / ((max.x - min.x) / wid) = scaleR
        //   => wid / (max.x - min.x) = scaleR
        //   => (max.x - min.x) * scaleR = wid
        //   => max.x - min.x = wid / scaleR
        //   => max.x = wid / scaleR + min.x
        //   && max.y = hig / scaleR + min.y

        // translate(-min.x, -min.y)
        //   => -min.x = offX
        //   => min.x = -offX
        //   && min.y = -offY

        // Strange things may happen.
        // Didn't figure out how to do this yet.
        render.bounds = {
            min: {x: -offX, y: -offY},
            max: {x: wid / scaleR - offX, y: hig / scaleR - offY}
        };
    }
    window.addEventListener("resize", onResize);
    onResize();

    document.body.style.marginLeft =
    document.body.style.marginTop =
    document.body.style.marginBottom =
    document.body.style.marginRight = "0";
    document.body.style.overflow = "hidden";

    Matter.Engine.run(engine);

    setTimeout(function () {
        startGame(overHandle);
    }, 100);
});
