import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js'; 
import { MathUtils } from 'https://unpkg.com/three@0.163.0/src/math/MathUtils.js';
import { ImprovedNoise } from 'https://unpkg.com/three@0.163.0/examples/jsm/math/ImprovedNoise.js';
import * as BufferGeometryUtils from 'https://unpkg.com/three@0.163.0/examples/jsm/utils/BufferGeometryUtils.js';
import { Vector3 } from 'https://unpkg.com/three@0.163.0/src/math/Vector3.js';
import { TransformControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js';
import { XRButton } from 'https://unpkg.com/three@0.163.0/examples/jsm/webxr/XRButton.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.163.0/examples/jsm/webxr/XRControllerModelFactory.js'; 
import { TextGeometry } from 'https://unpkg.com/three@0.163.0/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/FontLoader.js';
import { RGBELoader } from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/RGBELoader.js';
import * as Generation from "./generationUtil.js";
import * as Recombination from "./recombinationUtil.js";
import * as SphereUtil from "./sphere.js";

const hdrFile = "./assets/black.hdr";
//scene set up variables and window variables

var container, camera, renderer;
var voltageLevel;
var cameraControls;
var gui;
const voltageControl = document.getElementById('voltage');
var minScalar = 0.22;
var maxScalar = 0.88;
var cube1;


//PN Junction Initial Variables
var electronSpheres = [];
var holeSpheres = [];
var numSpheres = 50;

var cubeSize = new THREE.Vector3(150, 75, 75);
var clock = new THREE.Clock();

var boxMin = -(cubeSize.x/2) + 1;
var boxMax = (cubeSize.x/2) - 1;


//electric field attributes
var arrowNegative;
var innerBoxSize = 25;
var innerCubeGeometry;
var innerCubeMaterial;
var innerCube;
var voltage = 0.0;

var voltageText = "Voltage: " + voltage;
var voltageTextMesh;
var textgeometry;
const TRIGGER_THRESHOLD = 0.1;


//scatter variables
var scatterTimeMean = 2;
const perlin = new ImprovedNoise();

//battery variables
var positiveBatteryElements = [];
var negativeBatteryElements = [];
let batteryAdded = false; // Global flag

let voltageChangedOnce = false;

// populate boltz distribution table
var boltz = []; 

//recombination variables
var minDistance = 30;
var e_sphere_outside_depvarion_range = false;
var h_sphere_outside_depvarion_range = false;
var recombination_orbs = [];

//generation variables
var generatedPairs = []; //[{electron, hole}, {electron, hole}]


//VR control variables
var controller1, controller2;
var controllerGrip1, controllerGrip2;
var dolly;
var xrSession = null;

// controller states
const controllerStates = {
	leftController: {
		thumbstick: {x:0, y:0},
		trigger: 0,
        triggerPressed: false
	},
	rightController: {
		thumbstick: {x:0, y:0},
		trigger: 0,
        triggerPressed: false
	}
};


//movement settings
const vrSettings = {
	moveSpeed: 2,
	rotationSpeed: 0.05
};

const loader = new FontLoader();
var scene = new THREE.Scene();

init();

update();

setInterval(() => {
    let generatedPair = Generation.generatePair(cubeSize);
    scene.add(generatedPair.orbSphere);
    scene.add(generatedPair.electron.object);
    scene.add(generatedPair.hole.object);
    generatedPairs.push(generatedPair);
}, 2000);


setInterval(() => {
    let generatedPair = Generation.generatePair(cubeSize);
    scene.add(generatedPair.orbSphere);
    scene.add(generatedPair.electron.object);
    scene.add(generatedPair.hole.object);
    generatedPairs.push(generatedPair);
}, 2000);

//RECOMBINATION ORB CLEAN UP
setInterval(() => {
    //creates hole/electron pair and adds to generatedPairs array
    Recombination.recombinationOrbRemove(recombination_orbs, scene);
}, 2000);

 
function init() {
    //camera, background textures, background, scene, initial geometry, materials, renderer
    const norm_vel = [{nv: 0.1, quantity: 3}, {nv: 0.2, quantity: 10}, {nv: 0.3, quantity: 21}, {nv: 0.4, quantity: 35}, {nv: 0.5, quantity: 49}, 
        {nv: 0.6, quantity: 63}, {nv: 0.7, quantity: 74}, {nv: 0.8, quantity: 82}, {nv: 0.9, quantity: 86}, {nv: 1.0, quantity: 86},
        {nv: 1.1, quantity: 83}, {nv: 1.2, quantity: 77}, {nv: 1.3, quantity: 69}, {nv: 1.4, quantity: 59}, {nv: 1.5, quantity: 50}, {nv: 1.6, quantity: 40},
        {nv: 1.7, quantity: 32}, {nv: 1.8, quantity: 24}, {nv: 1.9, quantity: 18}, {nv: 3.0, quantity: 13}, {nv: 2.1, quantity: 9}, {nv: 2.2, quantity: 6}, {nv: 2.3, quantity: 4},
        {nv: 3.5, quantity: 3}, {nv: 4, quantity: 2}, {nv: 5, quantity: 1}, {nv: 6, quantity: 1}];
    for (var i = 0; i < norm_vel.length; i++) {
        var count = 0;
        while (count < norm_vel[i].quantity) {
            boltz.push(norm_vel[i].nv);
            count++;
        }
    }
    
    container = document.getElementById('three-container-scene-1');
   
	// scene.background = new THREE.Color(0x121212);
    // scene.background = new THREE.Color(0xFFFFFF); // black background
    new RGBELoader()
    .load(hdrFile, function (texture) {
        scene.background = texture;  // This makes HDR the background
        scene.environment = texture; // This applies HDR for lighting/reflection        
    }, undefined, function (error) {
        console.error("Failed to load HDR file:", error);
    })

    //camera
    camera = new THREE.PerspectiveCamera( 75, container.clientWidth / container.clientHeight, 0.1, 1500);
    // camera.position.z = 150;
    camera.position.set(0, 0, 150);
    //renderer
    renderer = new THREE.WebGLRenderer({ alpha: false });

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    initXR();
    container.appendChild( renderer.domElement );
	container.appendChild(XRButton.createButton(renderer));
	dolly = new THREE.Object3D();
	setUpVRControls();


     // Add explicit size check
     if (!container) {
        console.error('Container not found');
        return;
    }
	
		
	//lighting
    // const light = new THREE.AmbientLight( 0xffffff, 3); // soft white light
    // scene.add( light );

    const light = new THREE.AmbientLight( 0xffffff, 1 );  // softer light
    scene.add(light);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // GUI
    gui = new dat.GUI({autoPlace: false});
    gui.domElement.style.position = 'relative';
    gui.domElement.style.right = '-450px'; // 👈 This moves it to the right
    gui.domElement.style.top = '10px';

    cameraControls = {
        translateZ : 150,
        translateX: 0,
        rotateY: MathUtils.degToRad(0),
    };

    voltageLevel = {
        x: 0.0,
    };

    document.getElementById("myText").innerHTML = 0;

    // moved to update

    gui.add(cameraControls, 'translateX', -100, 100).onChange(() => {
        camera.position.x = cameraControls.translateX;
    });
    gui.add(cameraControls, 'translateZ', -50, 150).onChange(() => {
        camera.position.z = cameraControls.translateZ;
    });

    gui.add(cameraControls, 'rotateY', -50, 50).onChange(() => {
        camera.rotation.y = MathUtils.degToRad(cameraControls.rotateY);
    });

    const resetButton = { 'Reset Cube': resetGUI };

    // Add a button to reset GUI controls
    gui.add(resetButton, 'Reset Cube');

    
    container.appendChild(gui.domElement);


    voltageControl.addEventListener('input', () => {
        voltageLevel = parseFloat(voltageControl.value);
        voltage = voltageLevel;
        document.getElementById("myText").innerHTML = voltage;
     });

 
    

    // window resize handler
    window.addEventListener( 'resize', onWindowResize);


    

    loader.load( 'https://unpkg.com/three@0.163.0/examples/fonts/helvetiker_regular.typeface.json', function ( font ) {
        loader._font = font;
        textgeometry = new TextGeometry( voltageText, {
            font: font,
            size: 5,
            depth: 0.5
        } );
        const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        voltageTextMesh = new THREE.Mesh(textgeometry, textMaterial);
        voltageTextMesh.position.set(-20, 60, 0); // Position it where visible in VR
        scene.add(voltageTextMesh);
    
    } );

   

    // Create an angular path
    const curvePath = new THREE.CurvePath();

    // Define the points for our angular path
    const points = [
    new THREE.Vector3(-75, 0, 10),
    new THREE.Vector3(-120, 0, 10),
    new THREE.Vector3(-120, -65, 10),
    new THREE.Vector3(-30, -65, 10),

   
    ];

    // Create line segments between each pair of points
    for (var i = 0; i < points.length - 1; i++) {
    const lineCurve = new THREE.LineCurve3(points[i], points[i + 1]);
    curvePath.add(lineCurve);
    }

    // Create a visible path for reference
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePath.getPoints(50));
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    const visiblePath = new THREE.Line(geometry, material);
    scene.add(visiblePath);

    //ELECTRON WIRE
    // Create an angular path
    const electronPath = new THREE.CurvePath();

    // Define the points for our angular path
    const electronPathPoints = [
    new THREE.Vector3(75, 0, 10),
    new THREE.Vector3(120, 0, 10),
    new THREE.Vector3(120, -65, 10),
    new THREE.Vector3(30, -65, 10),

    
    ];

    // Create line segments between each angular path points
    for (var i = 0; i < electronPathPoints.length - 1; i++) {
    const lineCurve = new THREE.LineCurve3(electronPathPoints[i], electronPathPoints[i + 1]);
    electronPath.add(lineCurve);
    }

    // Create a visible path
    const geometry2 = new THREE.BufferGeometry().setFromPoints(electronPath.getPoints(50));
    const material2 = new THREE.LineBasicMaterial({ color: 0xffffff });
    const visiblePath2 = new THREE.Line(geometry2, material2);
    scene.add(visiblePath2);

    // create cube container
    const cubeGeometry = box(cubeSize.x, cubeSize.y, cubeSize.z);
    const cubeMaterial = new THREE.LineDashedMaterial({ color: 0xFFFFFF, dashSize: 3, gapSize: 1});
    cube1 = new THREE.LineSegments(cubeGeometry, cubeMaterial);
    cube1.computeLineDistances();
    cube1.position.set(0, 0, 0);

    //battery geometry
    const batteryCylinderGeo =  new THREE.CylinderGeometry( 10, 10, 60, 32 );
    const wireframe = new THREE.WireframeGeometry( batteryCylinderGeo );

    const battery = new THREE.LineSegments( wireframe );
    battery.rotateZ(Math.PI/2);

    battery.material.depthTest = false;
    battery.material.opacity = 0.25;
    battery.material.transparent = true;
    battery.position.set(0, -70, 0);

    scene.add( battery );

    // create a plane in the middle to separate P type and N type
    const planeGeo = new THREE.PlaneGeometry(cubeSize.z, cubeSize.y);
    const planeMaterial = new THREE.LineDashedMaterial({
        color: 0xffffff,
        dashSize: 3,
        gapSize: 1,
    });
    // const planeMaterial = new THREE.MeshBasicMaterial( {color: 0xFFFFFF, side: THREE.DoubleSide, transparent: true} );
    var plane = new THREE.LineSegments(planeGeo, planeMaterial);
    plane.computeLineDistances();
    plane.position.set(0, 0, 0);
    plane.rotateY(Math.PI/2);

    scene.add(cube1, plane);

    var randomVelocity;
    //create initial holes and acceptors
    for (var i = 0; i < numSpheres; i++) {
        // change this to boltzmann distributed velocity
        randomVelocity = SphereUtil.getBoltzVelocity(boltz);
        var holes = SphereUtil.createSphere(i, -(cubeSize.x/2) + 1, -2, 0xFF3131, false, cubeSize);
        scene.add(holes.object);
        createIon(-(cubeSize.x/2) + 1, -2, 0xffffff, 'acceptor');
        holeSpheres.push({
            value: "h",
            initPos: holes.object.position,
            crossReady: true, 
            crossed: false, 
            pause: false,
            lerpProgress: 0, 
            lerping: false, 
            lerpPartner: new THREE.Vector3(), 
            recombine: true,
            canMove: true, 
            id:"normal",
            object: holes.object, 
            material: holes.material, 
            velocity: randomVelocity, 
            speed: Math.random() * (maxScalar - minScalar + 1) + minScalar, 
            scatterStartTime: performance.now(),
            scatterTime: (scatterTimeMean + (perlin.noise(i * 100, i * 200, performance.now() * 0.001) - 0.5)*0.3)
        });
    }

    //create initial electrons and donors
    for (var i = 0; i < numSpheres; i++) {
        randomVelocity = SphereUtil.getBoltzVelocity(boltz);
        createIon(2, (cubeSize.x/2) - 1, 0xffffff, 'donor');
        var electron = SphereUtil.createSphere(i, 2, (cubeSize.x/2) - 1, 0x1F51FF, false, cubeSize);
        scene.add(electron.object);
        electronSpheres.push({
            value: "e", 
            initPos: electron.object.position,
            crossReady: true,
            crossed: false,
            pause: false,
            lerpProgress: 0, 
            lerping: false, 
            lerpPartner: new THREE.Vector3(), 
            recombine: true, 
            canMove: true, 
            id: "normal", 
            object: electron.object, 
            material: electron.material, 
            velocity: randomVelocity, 
            speed: Math.random() * (maxScalar - minScalar + 1) + minScalar, 
            scatterStartTime: performance.now(), 
            scatterTime: (scatterTimeMean + (perlin.noise(i * 100, i * 200, performance.now() * 0.001) - 0.5)*0.3)});
    }

}

function update() {
    renderer.setAnimationLoop( function(timestamp, frame) {
        // updateId = requestAnimationFrame( update );
        
		if (frame) {
            const session = frame.session;
            if (session) {
                var lastTriggerState = {left: false, right: false};
                const inputSources = Array.from(session.inputSources);
                
                inputSources.forEach(inputSource => {
                    if (!inputSource.gamepad) return;

                    const state = inputSource.handedness === 'left' ? 
                        controllerStates.leftController : 
                        controllerStates.rightController;

                    if (inputSource.gamepad.axes.length >= 4) {
                        // Get thumbstick values (using axes 2 and 3 for Oculus controllers)
                        state.thumbstick.x = inputSource.gamepad.axes[2] || 0;
                        state.thumbstick.y = inputSource.gamepad.axes[3] || 0;
                
                        // Get trigger values (usually first button in buttons array)
                        state.trigger = Math.abs(inputSource.gamepad.buttons[0].value);
                        state.triggerPressed = state.trigger > TRIGGER_THRESHOLD;
                        
                        // Adjust voltage based on triggers
                        if (state === controllerStates.rightController &&  state.triggerPressed && !lastTriggerState.right) {
                            // Increase voltage (max 0.4)
                            voltage = Math.min(0.4, voltage + 0.08);
                            lastTriggerState.right = state.triggerPressed;
                        } else if (state === controllerStates.leftController &&  state.triggerPressed && !lastTriggerState.left) {
                            // Decrease voltage (min -1.4)
                            voltage = Math.max(-1.4, voltage - 0.08);
                            lastTriggerState.left = state.triggerPressed;
                        }

                        if (voltageTextMesh) {
                            voltageTextMesh.geometry.dispose();
                            textgeometry = new TextGeometry('Voltage: ' + voltage.toFixed(2), {
                                font: loader._font, // Use cached font
                                size: 5,
                                depth: 0.5
                            });
                            voltageTextMesh.geometry = textgeometry;    
                        }

                    }
                });
            }
        }

    

        var currentTime = performance.now();
        var time = clock.getDelta()/15;
        scene.remove(innerCube);

        // console.log("electron #:" + electronSpheres.length);
        // console.log("hole #:" + holeSpheres.length);

        //add innercube for electric field
                                            
        // update inner box size based on formula using voltage
        innerBoxSize = 24.2*(0.58*(Math.sqrt(9.2 - voltage * 1.13 /0.05)));

        innerCubeGeometry = box(innerBoxSize, cubeSize.y, cubeSize.z);
        innerCubeMaterial = new THREE.LineDashedMaterial({ color: 0xFF0000, dashSize: 3, gapSize: 1});

        innerCube = new THREE.LineSegments(innerCubeGeometry, innerCubeMaterial);
        innerCube.computeLineDistances();
        
        innerCube.position.set(0, 0, 0);
        scene.add(innerCube);

        var origin = new THREE.Vector3(innerBoxSize/2, 0, 0 );
        const length = innerBoxSize;
        const hex = 0xffff00;

        updateArrow(origin, length, hex);
    
        //SCATTER (update velocities for scattering)
        scatter(currentTime); 

        addAcceleration(electronSpheres, innerBoxSize, time, -1);
        addAcceleration(holeSpheres, innerBoxSize, time, 1);

        //GENERATION ANIMATION
        Generation.generationAnim(holeSpheres, electronSpheres, generatedPairs, scene, boltz);

        //determines if distance of generated pair is far enough to allow recombinationn
        Recombination.updateRecombinationStatus(electronSpheres, holeSpheres, minDistance);
        //RECOMBINATION ANIMATION
        Recombination.recombinationAnim(electronSpheres, holeSpheres, innerBoxSize, scene, recombination_orbs);

        //check if a hole or electron needs to be supplied if they cross only if voltage level is negative
        // sphereCrossed(electronSpheres, 'e');
        // sphereCrossed(holeSpheres, 'h');

        if (voltage < 0) {
            sphereCrossed(electronSpheres, 'e');
            sphereCrossed(holeSpheres, 'h');
            // checkGeneratedStatus();
        }

        if (voltage > 0) {
            // maintains balance...of 50 max e and h
            // sphereCrossed(electronSpheres, 'e');
            // sphereCrossed(holeSpheres, 'h');
            // console.log(Recombination.recombinationOccured);
            console.log("recombination count when: " + Recombination.recombinationCount);
            if (Recombination.recombinationOccured && !batteryAdded) {
                // console.log("recombination occured");
                var e_position = new THREE.Vector3(cubeSize.x/2 + 50, 0, 0);
                var electron = SphereUtil.createSphereAt(e_position, 0x1F51FF, false);
                scene.add(electron.object);
                electron.value = "e";
                positiveBatteryElements.push(electron);
                    
                var h_position = new THREE.Vector3(-cubeSize.x/2 - 50, 0, 0);
                var hole = SphereUtil.createSphereAt(h_position, 0xFF3131, false);
                scene.add(hole.object);
                hole.value = "h";
                positiveBatteryElements.push(hole);
                Recombination.setRecombinationStatus(false);
                batteryAdded = true;
                // console.log("length of pos array" + positiveBatteryElements.length);
            } else {
                batteryAdded = false;
                console.log("recombination check false, has not occurred yet");
            }
        }
        
        if (positiveBatteryElements.length > 0) { //if something exists in battery
            positive_battery_anim();
        }

        if (negativeBatteryElements.length > 0) {
            negative_battery_anim();
        }

        //UPDATE SPHERE POSITION
        updateSpherePosition();

        // let newUpdatedArrays = controlSphereAmount(electronSpheres, holeSpheres);
        // electronSpheres = newUpdatedArrays.electronSpheres;
        // holeSpheres = newUpdatedArrays.holeSpheres;

        // checkBounds(holeSpheres, electronSpheres, hBoundsMin, hBoundsMax, eBoundsMin, eBoundsMax);
        checkBounds(holeSpheres, electronSpheres, boxMin, boxMax);
        // orbitControls.update();
		updateCamera();
        renderer.render( scene, camera );
		
    });
}
// Define buildController function
function buildController(data) {
    var geometry, material;

    switch (data.targetRayMode) {
        case 'tracked-pointer':
            geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));

            material = new THREE.LineBasicMaterial({ 
                vertexColors: true, 
                blending: THREE.AdditiveBlending 
            });

            return new THREE.Line(geometry, material);

        case 'gaze':
            geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(0, 0, -1);
            material = new THREE.MeshBasicMaterial({ 
                opacity: 0.5, 
                transparent: true 
            });
            return new THREE.Mesh(geometry, material);
    }
}

function setUpVRControls() {
    // Create dolly for camera movement
    dolly = new THREE.Object3D();
    dolly.position.set(0, 0, 0);
    dolly.add(camera);
    scene.add(dolly);

    //controllers
    controller1 = renderer.xr.getController(0);
    controller2 = renderer.xr.getController(1);
    
    controller1.addEventListener('selectstart', onSelectStart);
    controller1.addEventListener('selectend', onSelectEnd);
    controller1.addEventListener('connected', function(event) {
        this.add(buildController(event.data));
    });
    controller1.addEventListener('disconnected', function() {
        this.remove(this.children[0]);
    });

    controller2.addEventListener('selectstart', onSelectStart);
    controller2.addEventListener('selectend', onSelectEnd);
    controller2.addEventListener('connected', function(event) {
        this.add(buildController(event.data));
    });
    controller2.addEventListener('disconnected', function() {
        this.remove(this.children[0]);
    });

    //controllerModelFactory
    const controllerModelFactory = new XRControllerModelFactory();
    
    //controllergrips
    controllerGrip1 = renderer.xr.getControllerGrip(0);
    controllerGrip2 = renderer.xr.getControllerGrip(1);
    
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
    
    // Add controllers to dolly
    dolly.add(controller1);
    dolly.add(controller2);
    dolly.add(controllerGrip1);
    dolly.add(controllerGrip2);
}

// Handle controller input
async function initXR(frame) {


    const xrSession = await navigator.xr.requestSession('immersive-vr');

    const inputSource = xrSession.inputSources[0];
	controllerGrip1 = xrSession.requestReferenceSpace('local');
	
	//debug
    
}

function updateCamera() {
    if (!renderer.xr.isPresenting) return;

    const leftThumbstick = controllerStates.leftController.thumbstick;
    const rightThumbstick = controllerStates.rightController.thumbstick;

    // Forward/backward movement based on left thumbstick Y
    if (Math.abs(leftThumbstick.y) > 0.1) {
        dolly.position.z += leftThumbstick.y * vrSettings.moveSpeed;
    }

    // Left/right movement based on left thumbstick X
    if (Math.abs(leftThumbstick.x) > 0.1) {
        dolly.position.x += leftThumbstick.x * vrSettings.moveSpeed;
    }

    // Rotation based on right thumbstick X
    if (Math.abs(rightThumbstick.x) > 0.1) {
        dolly.rotation.y -= rightThumbstick.x * vrSettings.rotationSpeed;
    }
}


// Add these controller event functions
function onSelectStart() {
    this.userData.isSelecting = true;
}

function onSelectEnd() {
    this.userData.isSelecting = false;
}

	
function negative_battery_anim() {
    for (var i = negativeBatteryElements.length - 1; i >= 0; i--) {
        var sphere = negativeBatteryElements[i];
        var spherePosition = sphere.object.position;
        if (sphere.value == 'e') {
            if (spherePosition.x <= cubeSize.x/2) {
                //move linear
                sphere.object.position.add(new THREE.Vector3(0.2, 0, 0));

            } else {
                //fade out and remove from scene
                sphere.object.position.add(new THREE.Vector3(0.2, 0, 0));

                sphere.object.material.transparent = true;

                // Update opacity based on elapsed time
                // Calculate the distance from the electron to the edge of the system
                var distanceFromEdge = Math.abs(sphere.object.position.x - cubeSize.x/2);
                var maxDistance = 50; // Define the maximum distance at which the electron becomes fully transparent
                var opacity = THREE.MathUtils.clamp(1 - (distanceFromEdge / maxDistance), 0, 1);
                
                sphere.object.material.opacity = opacity;

                if (opacity <= 0) {
                    // Remove the electron from the scene and battery array
                    scene.remove(sphere.object);
                    negativeBatteryElements.splice(i, 1);
                }
            }

        } else if (sphere.value == 'h') {
            if (spherePosition.x >= -cubeSize.x/2) {
                //move linear
                sphere.object.position.add(new THREE.Vector3(-0.2, 0, 0));
            } else {
                //fade out and remove from scene
                sphere.object.position.add(new THREE.Vector3(-0.2, 0, 0));

                sphere.object.material.transparent = true;

                // Update opacity based on elapsed time
                // Calculate the distance from the electron to the edge of the system
                var distanceFromEdge = Math.abs(sphere.object.position.x + cubeSize.x/2);
                var maxDistance = 50; // Define the maximum distance at which the electron becomes fully transparent
                var opacity = THREE.MathUtils.clamp(1 - (distanceFromEdge / maxDistance), 0, 1);
                
                sphere.object.material.opacity = opacity;

                if (opacity <= 0) {
                    // Remove the electron from the scene and battery array
                    scene.remove(sphere.object);
                    negativeBatteryElements.splice(i, 1);
                }
            }
        }
    }
}

function positive_battery_anim() {
    console.log("length of postiive battery elements array:" + positiveBatteryElements.length);

    for (var i = positiveBatteryElements.length - 1; i >= 0; i--) {
        var sphere = positiveBatteryElements[i];
        var spherePosition = sphere.object.position;
        if (sphere.value == 'e') {
            if (spherePosition.x < cubeSize.x/2 - 1) {
                electronSpheres.push({
                    value: "e",
                    crossReady: true,
                    crossed: false,
                    pause: false,
                    lerpProgress: 0,
                    lerping: false,
                    lerpPartner: new THREE.Vector3(),
                    recombine: true,
                    id: "generated",
                    canMove: true,
                    object: sphere.object,
                    material: sphere.material,
                    velocity: SphereUtil.getBoltzVelocity(boltz),
                    speed: Math.random() * (maxScalar - minScalar + 1) + minScalar,
                    scatterStartTime: performance.now(),
                    scatterTime: (scatterTimeMean + (perlin.noise(Math.random(0, numSpheres) * 100, Math.random(0, numSpheres) * 200, performance.now() * 0.001) - 0.5)*0.3)
                });
                
                // Remove the electron from the battery array
                positiveBatteryElements.splice(i, 1);
            } else {
                sphere.object.position.add(new THREE.Vector3(-0.2, 0, 0));     
            }
                        
        } else if (sphere.value == 'h') { // hole
            if (spherePosition.x > -cubeSize.x/2 + 1) {
                holeSpheres.push({
                    value: "h",
                    crossReady: true,
                    crossed: false,
                    pause: false,
                    lerpProgress: 0,
                    lerping: false,
                    lerpPartner: new THREE.Vector3(),
                    recombine: true,
                    id: 'generated',
                    canMove: true,
                    object: sphere.object,
                    material: sphere.material,
                    velocity: SphereUtil.getBoltzVelocity(boltz),
                    speed: Math.random() * (maxScalar - minScalar + 1) + minScalar,
                    scatterStartTime: performance.now(),
                    scatterTime: (scatterTimeMean + (perlin.noise(Math.random(0, numSpheres) * 100, Math.random(0, numSpheres) * 200, performance.now() * 0.001) - 0.5)*0.3)
                });
                
                // Remove the electron from the battery array
                positiveBatteryElements.splice(i, 1);
            } else {
                sphere.object.position.add(new THREE.Vector3(0.2, 0, 0));
            } 
        }
    }
    
}

function controlSphereAmount(electronSpheres, holeSpheres) {
    var e_array_length = electronSpheres.length;
    var h_array_length = holeSpheres.length;


    if (e_array_length > numSpheres) {
        var randomIndex = Math.floor(Math.random() * electronSpheres.length);
        scene.remove(electronSpheres[randomIndex].object);
        electronSpheres[randomIndex].object.geometry.dispose();
        electronSpheres[randomIndex].object.material.dispose();
        electronSpheres.splice(randomIndex, 1);
    }
    if (h_array_length > numSpheres) {
        var randomIndex = Math.floor(Math.random() * holeSpheres.length);
        scene.remove(holeSpheres[randomIndex].object);
        holeSpheres[randomIndex].object.geometry.dispose();
        holeSpheres[randomIndex].object.material.dispose();
        holeSpheres.splice(randomIndex, 1);
    }

    return {electronSpheres, holeSpheres};
}


//keeps track of the newly created electrons/holes after a sphere crosses to the other side
function sphereCrossed(typeArray, type) { 
    var e_count = 0;
    var h_count = 0;

    if (!voltageChangedOnce) {
        // e_count = electronSpheres.length;
        // h_count = holeSpheres.length;
        voltageChangedOnce = true;
    }
    for (var i = 0; i < typeArray.length; i++) {
        var spherePosition = typeArray[i].object.position.x;
        // added voltage > 0 check too since similar processes occuring for both
        if (voltage < 0) {
            //AZAD CODE
            if (type == 'e') {    
                if (spherePosition > innerBoxSize/2) {
                    e_count= e_count+1;
                    //takes out electrons if count exceeds 50 max
                    if (e_count > numSpheres) {
                        e_count= e_count-1;
                        //console.log('e_count=',e_count);
                        var position = new THREE.Vector3(cubeSize.x/2 - 5, 0, 0);
                        var electron = SphereUtil.createSphereAt(position, 0x1F51FF, false);
                        scene.add(electron.object);
                    
                        electron.value = "e";

                        typeArray[i].crossed = true;
                        negativeBatteryElements.push(electron);


                        var randomIndex = Math.floor(Math.random() * electronSpheres.length);
                        scene.remove(electronSpheres[randomIndex].object);
                        electronSpheres[randomIndex].object.geometry.dispose();
                        electronSpheres[randomIndex].object.material.dispose();
                        electronSpheres.splice(randomIndex, 1);
                    }

                }

            } else if (type == 'h') {
                if (spherePosition < -innerBoxSize/2 ) {
                    h_count= h_count+1;
                    //removes holes if it exceeds max 50
                    if (h_count > numSpheres ) {
                            //console.log('h_count=',h_count);
                        h_count= h_count-1;    
                        var position = new THREE.Vector3(-cubeSize.x/2 + 5, 0, 0);
                        var hole = SphereUtil.createSphereAt(position, 0xFF3131, false);
                        scene.add(hole.object);
                        hole.value = "h";
                        typeArray[i].crossed = true;
                        negativeBatteryElements.push(hole);

                        //remove last electron from the existing electronArray
                        var randomIndex = Math.floor(Math.random() * holeSpheres.length);
                        scene.remove(holeSpheres[randomIndex].object);
                        holeSpheres[randomIndex].object.geometry.dispose();
                        holeSpheres[randomIndex].object.material.dispose();
                        holeSpheres.splice(randomIndex, 1);
                    }
                }
            }
        }

        //AZAD CODE
        if (voltage === 0 ) {
            if (type == 'e') {
                if (spherePosition > innerBoxSize/2) {
                    e_count= e_count+1;
                    if (e_count > numSpheres ) {
                        e_count= e_count-1;
                        // console.log("removing electron because it reached above:" + numSpheres);
                        var randomIndex = Math.floor(Math.random() * electronSpheres.length);
                        scene.remove(electronSpheres[randomIndex].object);
                        electronSpheres[randomIndex].object.geometry.dispose();
                        electronSpheres[randomIndex].object.material.dispose();
                        electronSpheres.splice(randomIndex, 1);
                    }

                }

            } else if (type == 'h') {
                if (spherePosition < -innerBoxSize/2 ) {
                    h_count= h_count+1;
                    if (h_count > numSpheres ) {
                            //console.log('h_count=',h_count);
                        h_count= h_count-1;    
                        // console.log("removing hole because it reached above:" + numSpheres);

                        //remove last electron from the existing electronArray
                        var randomIndex = Math.floor(Math.random() * holeSpheres.length);
                        scene.remove(holeSpheres[randomIndex].object);
                        holeSpheres[randomIndex].object.geometry.dispose();
                        holeSpheres[randomIndex].object.material.dispose();
                        holeSpheres.splice(randomIndex, 1);
                    }
                }
            }
        }
    }
}


function addAcceleration(type, innerBoxSize, time, scalar) {
    for (var i = 0; i < type.length; i++) {
        var spherePosition = type[i].object.position.x;
        var acc = new THREE.Vector3(0, 0, 0);
        // if position is within -Xn < X < 0
        if ((-innerBoxSize/2 < spherePosition && spherePosition < 0)) {
            // check if dividing by two is appropriate or not
            acc = new THREE.Vector3(-1.53*(innerBoxSize/2 + spherePosition), 0 , 0);
        }
    
        // is position is within 0 < X < Xn
        if ((0 < spherePosition && spherePosition < innerBoxSize/2)) {
            acc = new THREE.Vector3(-1.53*(innerBoxSize/2 - spherePosition), 0, 0);
        }
    
        // everywhere else -- -cubeSize.x/2 + 1 < X < -Xn || Xn < X < cubeSize.x/2 - 1
        if ((-cubeSize.x/2 + 1 < spherePosition && spherePosition < -innerBoxSize/2) || (innerBoxSize/2 < spherePosition && spherePosition < cubeSize.x/2 - 1) || (spherePosition == 0)) {
            acc = new THREE.Vector3(0, 0, 0);
        }
    
        if (scalar < 0) {
            electronSpheres[i].velocity.add(acc.multiplyScalar(time).multiplyScalar(scalar));
        } else {
            holeSpheres[i].velocity.add(acc.multiplyScalar(time));
        }
    }
}

function updateSpherePosition() {
    const minVelocity = 0.9;
    const maxVelocity = 30;
    for (var sphere of [...electronSpheres, ...holeSpheres]) {
        const currVelocity = sphere.velocity.clone();
        currVelocity.clampLength(minVelocity, maxVelocity);
        if (sphere.canMove == true) {

           sphere.object.position.add(currVelocity);
           sphere.velocity = currVelocity;
        }
    }    
}


function checkCollision(electron, hole) {
    // collision check...
    // if two are created from generation then they can't recombine
    var distance = new Vector3().subVectors(electron.object.position, hole.object.position).length();
    var coll_dist = 20;
    if (electron.recombine && hole.recombine) {
        if (distance <= coll_dist) {
            return true;
        } else {
            return false;
        }
    }
}


function scatter(currentTime) {
     // implement scatter movement
     for (var i = 0; i < electronSpheres.length; i++) {
        for (var j = 0; j < holeSpheres.length; j++) {
            var electronScatterTime = (currentTime - electronSpheres[i].scatterStartTime)/1000;
            if (electronScatterTime >= electronSpheres[i].scatterTime) {
                electronSpheres[i].velocity = SphereUtil.getBoltzVelocity(boltz);
                electronSpheres[i].scatterStartTime = performance.now();
                electronSpheres[i].scatterTime = (scatterTimeMean + (perlin.noise(i * 100, i * 200, performance.now() * 0.001) - 0.5)*0.3);
            }

            var holeScatterTime = (currentTime - holeSpheres[j].scatterStartTime)/1000;
            if (holeScatterTime >= holeSpheres[j].scatterTime) {
                holeSpheres[j].velocity = SphereUtil.getBoltzVelocity(boltz);
                holeSpheres[j].scatterStartTime = performance.now();
                holeSpheres[j].scatterTime = (scatterTimeMean + (perlin.noise(j * 100, j * 200, performance.now() * 0.001) - 0.5)*0.3);
            }
        }
     }     
}

function checkBounds(sphere1, sphere2, min, max) {
    // cube boundaries y and z for (var i = 0; i < )
    var yedge = (cubeSize.y/2);
    var ynedge = -(yedge);
    var zedge = (cubeSize.z/2);
    var znedge = -(zedge);

    for (var i = 0; i < sphere1.length; i++) {
        if (sphere1[i].object.position.x >= max) {
            sphere1[i].object.position.x = min + 1;
            // sphere1.velocity.multiplyScalar(-1);
        } else if(sphere1[i].object.position.x <= min){
            sphere1[i].object.position.x = THREE.MathUtils.randFloat(min + 1, min + 20);
            // sphere1.object.position.x = minX1 + 1;
            // sphere1.velocity.multiplyScalar(-1);
        }
        if (sphere1[i].object.position.y > yedge) {
            sphere1[i].object.position.y = yedge - 1;
            sphere1[i].velocity.multiplyScalar(-1);
        } else if (sphere1[i].object.position.y < ynedge) {
            sphere1[i].object.position.y = ynedge + 1;
            sphere1[i].velocity.multiplyScalar(-1);
        }
        if (sphere1[i].object.position.z > zedge) {
            sphere1[i].object.position.z = zedge - 1;
            sphere1[i].velocity.multiplyScalar(-1);
        } else if (sphere1[i].object.position.z < znedge) {
            sphere1[i].object.position.z = znedge + 1;
            sphere1[i].velocity.multiplyScalar(-1);
        }
    }

    for (var i = 0; i < sphere2.length; i++) {
        if (sphere2[i].object.position.x >= max) {
            sphere2[i].object.position.x = THREE.MathUtils.randFloat(max - 15 , max - 1);
            // sphere2.velocity.multiplyScalar(-1);
        } else if(sphere2[i].object.position.x <= min){
            sphere2[i].object.position.x = max - 1;
            // sphere2.velocity.multiplyScalar(-1);
        }
    
        if (sphere2[i].object.position.y > yedge) {
            sphere2[i].object.position.y = yedge - 1;
            sphere2[i].velocity.multiplyScalar(-1);
        } else if (sphere2[i].object.position.y < ynedge) {
            sphere2[i].object.position.y = ynedge + 1;
            sphere2[i].velocity.multiplyScalar(-1);
        }
    
        if (sphere2[i].object.position.z > zedge) {
            sphere2[i].object.position.z = zedge - 1;
            sphere2[i].velocity.multiplyScalar(-1);
        } else if (sphere2[i].object.position.z < znedge) {
            sphere2[i].object.position.z = znedge + 1;
            sphere2[i].velocity.multiplyScalar(-1);
        }
    }
}

// Function to reset GUI controls
function resetGUI() {
    gui.__controllers.forEach(controller => controller.setValue(controller.initialValue));
}


function createIon(minx, maxx, color, ionType) {
    var capsuleLength = 3;
    var radius = 0.5;
    const geometry = new THREE.CapsuleGeometry(radius, capsuleLength);
    //negative shape
    if (ionType == "acceptor") {
        var material = new THREE.MeshBasicMaterial({color: color, transparent: true, opacity: 0.2});
        var acceptor = new THREE.Mesh(geometry, material);
        // acceptor.rotateX(Math.PI/2);
        acceptor.rotateZ(Math.PI/2);
        acceptor.position.set(
            THREE.MathUtils.randFloat(minx, maxx),
            THREE.MathUtils.randFloat(-cubeSize.y/2 + 1, cubeSize.y/2 - 1),
            THREE.MathUtils.randFloat(-cubeSize.z/2 + 1, cubeSize.z/2 - 1)
        );
        scene.add(acceptor);
    } else if (ionType == 'donor') { //positive shape
        //create second geometry for plus shape
        var geometry2 = new THREE.CapsuleGeometry(radius, capsuleLength);
        geometry2.rotateZ(Math.PI/2);  
        var mergedGeometry = new BufferGeometryUtils.mergeGeometries([geometry, geometry2]);
        var material = new THREE.MeshBasicMaterial({color: color, transparent: true,  opacity: 0.2});
        var donor = new THREE.Mesh(mergedGeometry, material);
        donor.position.set(
            THREE.MathUtils.randFloat(minx, maxx),
            THREE.MathUtils.randFloat(-cubeSize.y/2 + 1, cubeSize.y/2 - 1),
            THREE.MathUtils.randFloat(-cubeSize.z/2 + 1, cubeSize.z/2 - 1)
        );
        scene.add(donor);
    }
}


function updateArrow(origin, length, hex) {
    var headLength = innerBoxSize/4; //size of arrow head
    scene.remove(arrowNegative);
    arrowNegative = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), origin, length, hex, headLength);
    scene.add(arrowNegative);
}

function box( width, height, depth ) {

    width = width * 0.5,
    height = height * 0.5,
    depth = depth * 0.5;

    const geometry = new THREE.BufferGeometry();
    const position = [];

    position.push(
        - width, - height, - depth,
        - width, height, - depth,

        - width, height, - depth,
        width, height, - depth,

        width, height, - depth,
        width, - height, - depth,

        width, - height, - depth,
        - width, - height, - depth,

        - width, - height, depth,
        - width, height, depth,

        - width, height, depth,
        width, height, depth,

        width, height, depth,
        width, - height, depth,

        width, - height, depth,
        - width, - height, depth,

        - width, - height, - depth,
        - width, - height, depth,

        - width, height, - depth,
        - width, height, depth,

        width, height, - depth,
        width, height, depth,

        width, - height, - depth,
        width, - height, depth
     );

    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( position, 3 ) );

    return geometry;

}


function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}


