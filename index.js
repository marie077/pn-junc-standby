import * as THREE from 'https://unpkg.com/three/build/three.module.js'; 
import { MathUtils } from 'https://unpkg.com/three/src/math/MathUtils.js';
import { ImprovedNoise } from 'https://unpkg.com/three/examples/jsm/math/ImprovedNoise.js';
import * as BufferGeometryUtils from 'https://unpkg.com/three@0.163.0/examples/jsm/utils/BufferGeometryUtils.js';
import { Sphere } from 'https://unpkg.com/three@0.163.0/src/math/Sphere.js';
import { Vector3 } from 'https://unpkg.com/three@0.143.0/src/math/Vector3.js';

//scene set up variables and window variables
let container, camera, scene, renderer;
let voltageLevel;
let cameraControls;
let energyLevel;
let temperatureLevel;
let gui;
let minScalar = 0.22;
let maxScalar = 0.88;
let shouldAnimate = false;

//PN Junction Initial Variables
let electronSpheres = [];
let holeSpheres = [];
let numSpheres = 150;
let cube1;
let cubeSize = new THREE.Vector3(150, 75, 75);
let clock = new THREE.Clock();
let acc_hole = 0;
let acc_electron = 0;

let hBoundsMin = -(cubeSize.x/2) + 1;
let hBoundsMax = (cubeSize.x/2) - 1;
let eBoundsMin = -(cubeSize.x/2) + 1;
let eBoundsMax = (cubeSize.x/2) - 1;

//electric field attributes
let arrowNegative;
let arrowPositive;
let innerBoxSize = 25;
let innerCubeGeometry;
let innerCubeMaterial;
let innerCube;
let voltage = 0.0;

//boltzmann distribution variables
let energy = 0.0;
const temperature = 300;
const boltzmann_const = 1.380649e-23

//scatter variables
let scatterTimeMean = 2;
const perlin = new ImprovedNoise();

//recombination variables
let e_coll_check;
const sparkMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0.0 } // Uniform for time animation
    },
    vertexShader: `
        uniform float time;

        void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform float time;

        void main() {
            float intensity = 1.0 - abs(sin(time * 10.0));
            gl_FragColor = vec4(intensity, intensity, intensity, 1.0);
        }
    `
});

//on mouse move
// document.addEventListener( 'mousemove', onDocumentMouseMove );
init();
update();

function init() {
    //camera, background textures, background, scene, initial geometry, materials, renderer
    container = document.createElement( 'div' );
    document.body.appendChild( container );
    //scene
    scene = new THREE.Scene();

    //camera
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1500 );
    // camera.position.x = 86;
    // camera.rotation.y = MathUtils.degToRad(38);
    camera.position.z = 116;
    //renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild( renderer.domElement );

    // GUI
    gui = new dat.GUI();
    cameraControls = {
        translateZ : 116,
        translateX: 0,
        rotateY: MathUtils.degToRad(0),
    };

    voltageLevel = {
        x: 0.0,
    };

    energyLevel = {
        state: 0.0,
    }

    temperatureLevel = {
        temp: 300,
    }
    const resetButton = { 'Reset Cube': resetGUI };

    gui.add(cameraControls, 'translateX', -100, 100).onChange(() => {
        camera.position.x = cameraControls.translateX;
    });
    gui.add(cameraControls, 'translateZ', -50, 150).onChange(() => {
        camera.position.z = cameraControls.translateZ;
    });

    gui.add(cameraControls, 'rotateY', -50, 50).onChange(() => {
        camera.rotation.y = MathUtils.degToRad(cameraControls.rotateY);
    });

    gui.add(voltageLevel, 'x', -1, 0.4).name('Voltage (V)').step(0.1).onChange(() => {
        voltage = voltageLevel.x;
    });

    gui.add(energyLevel, 'state', -50, 50).name('Energy State').step(0.1).onChange(() => {
        energy = energyLevel.state;
    });

    // gui.add(temperatureLevel, 'temp', -100, 500).name('temperature').step(0.1).onChange(() => {
    //     temperature = temperatureLevel.temp;
    // });
    // Add a button to reset GUI controls
    gui.add(resetButton, 'Reset Cube');

    // window resize handler
    window.addEventListener( 'resize', onWindowResize );

    // create cube container
    const cubeGeometry = box(cubeSize.x, cubeSize.y, cubeSize.z);
    const cubeMaterial = new THREE.LineDashedMaterial({ color: 0xFFFFFF, dashSize: 3, gapSize: 1});
    cube1 = new THREE.LineSegments(cubeGeometry, cubeMaterial);
    cube1.computeLineDistances();
    cube1.position.set(0, 0, 0);

    // create a plane in the middle to separate P type and N type
    const planeGeo = new THREE.PlaneGeometry(cubeSize.z, cubeSize.y);
    const planeMaterial = new THREE.LineDashedMaterial({
        color: 0xffffff,
        dashSize: 3,
        gapSize: 1,
    });
    // const planeMaterial = new THREE.MeshBasicMaterial( {color: 0xFFFFFF, side: THREE.DoubleSide, transparent: true} );
    let plane = new THREE.LineSegments(planeGeo, planeMaterial);
    plane.computeLineDistances();
    plane.position.set(0, 0, 0);
    plane.rotateY(Math.PI/2);


    scene.add(cube1, plane);

    let randomVelocity;
    //create initial holes and acceptors
    for (let i = 0; i < numSpheres; i++) {
        // change this to boltzmann distributed velocity
        randomVelocity = getBoltzVelocity();
        let holes = createSphere(i, -(cubeSize.x/2) + 1, -2, 0xE3735E, true);
        let holeSphere = new Sphere(holes.position, holes.object.geometry.parameters.radius);
        createIon(-(cubeSize.x/2) + 1, -2, 0x6495ED, 'acceptor');
        holeSpheres.push({ object: holes.object, material: holes.material, sphereBound: holeSphere, velocity: randomVelocity, speed: Math.random() * (maxScalar - minScalar + 1) + minScalar, scatterStartTime: performance.now(), scatterTime: (scatterTimeMean + (perlin.noise(i * 100, i * 200, performance.now() * 0.001) - 0.5)*0.3), highEnergy: false})
    }

    //create initial electrons and donors
    for (let i = 0; i < numSpheres; i++) {
        randomVelocity = getBoltzVelocity();
        createIon(2, (cubeSize.x/2) - 1, 0xC70039, 'donor');
        let electron = createSphere(i, 2, (cubeSize.x/2) - 1, 0x71bbd4, false);
        let electronSphere = new Sphere(electron.position, electron.object.geometry.parameters.radius)
        electronSpheres.push({ object: electron.object, material: electron.material, sphereBound: electronSphere, velocity: randomVelocity, speed: Math.random() * (maxScalar - minScalar + 1) + minScalar, scatterStartTime: performance.now(), scatterTime: (scatterTimeMean + (perlin.noise(i * 100, i * 200, performance.now() * 0.001) - 0.5)*0.3)});
    }

    //waits for two seconds before electrons and holes diffuse
    setTimeout(() => {
        shouldAnimate = true;
    }, 4000);
}

function update() {
	requestAnimationFrame( update );
    let currentTime = performance.now();
    let time = clock.getDelta()/15;

    scene.remove(innerCube);
    let minSize = 40;

    // update inner box size based on formula using voltage
    innerBoxSize = 24.2*(0.58*(Math.sqrt(9.2 - voltage/0.05)));

    // if voltage if positive then we set a minSize for the innerbox
    if (voltage > 0) {
        innerBoxSize = Math.max(innerBoxSize, minSize);
    }

    // ARROW IMPLEMENTATION
    const origin = new THREE.Vector3( 0, 70, 0 );
    const length = 50;
    const hex = 0xffff00;

    if (voltage === 0) {
        scene.remove(arrowNegative);
        scene.remove(arrowPositive);
        arrowNegative = null;
        arrowPositive = null;
    } else if (voltage < 0) {
        scene.remove(arrowPositive);
        arrowPositive =  null;
    } else if (voltage > 0) {
        scene.remove(arrowNegative);
        arrowNegative = null;
    }
    
    if (voltage < 0) {
        if (!arrowNegative) {
            arrowNegative = new THREE.ArrowHelper(new THREE.Vector3(voltage, 0, 0), origin, length, hex );
            scene.add(arrowNegative);
        }
        
    } else if (voltage > 0) {
        if (!arrowPositive) {
            arrowPositive = new THREE.ArrowHelper(new THREE.Vector3(voltage, 0, 0), origin, length, hex );
            scene.add(arrowPositive);
        }    
    } 

    // ARROW DONE

    innerCubeGeometry = box(innerBoxSize, cubeSize.y, cubeSize.z);
    innerCubeMaterial = new THREE.LineDashedMaterial({ color: 0xFF0000, dashSize: 3, gapSize: 1});

    innerCube = new THREE.LineSegments(innerCubeGeometry, innerCubeMaterial);
    innerCube.computeLineDistances();
    
    innerCube.position.set(0, 0, 0);

    scene.add(innerCube);

    // Recombination

    for (let i = 0; i < numSpheres; i++) {
        const e_sphere = electronSpheres[i];
        for (let j = 0; j < numSpheres; j++) {
            const h_sphere = holeSpheres[j];
            if (checkCollision(e_sphere, h_sphere)) {
                // slow the colliding spheres down
                // turn it white lol
                // stop for like a second or so
                // fade out and remove from scene
                
                // let distance = new Vector3().subVectors(e_sphere.object.position, h_sphere.object.position);
                // let direction = distance.clone().normalize();
                // e_sphere.material.color.set(0x00FF00);
                // h_sphere.material.color.set(0x00FF00);
                let collisionPoint = e_sphere.object.position.clone().add(h_sphere.object.position.clone().sub(e_sphere.object.position));
                // e_sphere.speed = 0.1;
                // h_sphere.speed = 0.1;

                const mergedGeometry = BufferGeometryUtils.mergeGeometries([e_sphere.object.geometry, h_sphere.object.geometry]);
        
                // Create a new material for the combined entity
                const mergedMaterial = new THREE.LineDashedMaterial({ color: 0x00FF00 }); // Example color, adjust as needed
                
                // Create a new mesh for the combined entity
                const mergedMesh = new THREE.Mesh(mergedGeometry, mergedMaterial);
                mergedMesh.position.copy(collisionPoint);
                scene.remove(e_sphere.object);
                scene.remove(h_sphere.object);
                scene.add(mergedMesh);
            

                setTimeout(()=> {
                   scene.remove(mergedMesh);
                }, 1500);
            }
        }
    }

    /*
    update the e and h velocities based on position
    */
    
    for (let i = 0; i < numSpheres; i++) {
        // implement scatter movement
        let currElectronScatterTime = (currentTime - electronSpheres[i].scatterStartTime)/1000;
        let currHoleScatterTime = (currentTime - holeSpheres[i].scatterStartTime)/1000;

       if (currElectronScatterTime >= electronSpheres[i].scatterTime) {
           scatter(electronSpheres[i], i);
       }
       if (currHoleScatterTime >= holeSpheres[i].scatterTime) {
        scatter(holeSpheres[i], i);
        }

        /* begin velocity calculations for each hole and each electron*/

        // store x positions of e and h
       let hole_x = holeSpheres[i].object.position.x;
       let electron_x = electronSpheres[i].object.position.x;
        // check hole and electron positions within the larger box and determine appropriate velocity (efield vs. no efield)

        // if position is within -Xn < X < 0
        if ((-innerBoxSize/2 < hole_x && hole_x < 0)) {
            // check if dividing by two is appropriate or not
            acc_hole = new THREE.Vector3(-1.53*(innerBoxSize/2 + hole_x), 0 , 0);
        }

        if ((-innerBoxSize/2 < electron_x && electron_x < 0)) {
            acc_electron = new THREE.Vector3(-1.53*(innerBoxSize/2 + electron_x), 0 , 0);
            // doing this because electrons will move opposite against the e-field
            acc_electron.multiplyScalar(-1);
        }

        // is position is within 0 < X < Xn
        if ((0 < hole_x && hole_x < innerBoxSize/2)) {
            acc_hole = new THREE.Vector3(-1.53*(innerBoxSize/2 - hole_x), 0, 0);
        }

        if (0 < electron_x && electron_x < innerBoxSize/2) {
            acc_electron = new THREE.Vector3(-1.53*(innerBoxSize/2 - electron_x), 0, 0);
            // doing this because electrons will move opposite against the e-field
            acc_electron.multiplyScalar(-1);
        }

        // everywhere else -- -cubeSize.x/2 + 1 < X < -Xn || Xn < X < cubeSize.x/2 - 1
        if ((-cubeSize.x/2 + 1 < hole_x && hole_x < -innerBoxSize/2) || (innerBoxSize/2 < hole_x && hole_x < cubeSize.x/2 - 1) || (hole_x == 0)) {
            acc_hole = new THREE.Vector3(0, 0, 0);
        }

        if ((-cubeSize.x/2 + 1 < electron_x && electron_x < -innerBoxSize/2) || (innerBoxSize/2 < electron_x && electron_x < cubeSize.x/2 - 1) || (electron_x == 0)) {
            acc_electron = new THREE.Vector3(0, 0, 0);
        }

         // now that we have our acceleration calculated, let's determine the new velocities for e and h        
       const currElectronVelocity = electronSpheres[i].velocity.clone();
       const currHoleVelocity = holeSpheres[i].velocity.clone();

       const minVelocity = 0.1;
       const maxVelocity = 0.6;

       currElectronVelocity.normalize();
       currHoleVelocity.normalize();

       // randomizes the electron speed
       currElectronVelocity.multiplyScalar(electronSpheres[i].speed);
       currHoleVelocity.multiplyScalar(holeSpheres[i].speed);

       currElectronVelocity.add(acc_electron.multiplyScalar(time));
       currHoleVelocity.add(acc_hole.multiplyScalar(time));


       currElectronVelocity.add(getBoltzVelocity().multiplyScalar(time));
       currHoleVelocity.add(getBoltzVelocity().multiplyScalar(time));

       currElectronVelocity.clampLength(minVelocity, maxVelocity);
       currHoleVelocity.clampLength(minVelocity, maxVelocity);

       electronSpheres[i].object.position.add(currElectronVelocity);
       electronSpheres[i].sphereBound.center.copy(electronSpheres[i].object.position);
       electronSpheres[i].velocity = currElectronVelocity;

       holeSpheres[i].object.position.add(currHoleVelocity);
       holeSpheres[i].sphereBound.center.copy(holeSpheres[i].object.position);
       holeSpheres[i].velocity = currHoleVelocity;   
 
       checkBounds(holeSpheres[i], electronSpheres[i], hBoundsMin, hBoundsMax, eBoundsMin, eBoundsMax);

      
    }
	renderer.render( scene, camera );
}

function animateCollision(electron, hole, ) {

}
function checkCollision(electron, hole) {
    // collision check...
    let distance = new Vector3().subVectors(electron.object.position, hole.object.position).length();
    //    let coll_dist = electronSpheres[i].object.geometry.parameters.radius + holeSpheres[i].object.geometry.parameters.radius;
    let coll_dist = 3;
    if (distance <= coll_dist) {
    return true;
    } else {
    return false;
    }
}

function getBoltzVelocity() {
    let boltzDistribution = Math.exp(-(energy/boltzmann_const*temperature));

    const x = Math.random(0, boltzDistribution);
    const y = Math.random(0, boltzDistribution);
    const z = Math.random(0, boltzDistribution);

    return new THREE.Vector3(x, y, z);
}


function scatter(sphere, index) {
    //reset the velocity to something random
    sphere.velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();

    //reset scatter start time and next scatter time
    sphere.scatterStartTime = performance.now();
    sphere.scatterTime = (scatterTimeMean + (perlin.noise(index * 100, index * 200, performance.now() * 0.001) - 0.5)*0.3);
    
}

function checkBounds(sphere1, sphere2, minX1, maxX1, minX2, maxX2) {
    // cube boundaries y and z
    let yedge = (cubeSize.y/2);
    let ynedge = -(yedge);
    let zedge = (cubeSize.z/2);
    let znedge = -(zedge);
    let tempMaxX1 = -4;
    let tempMinX2 = 4;
    if (shouldAnimate) {
        maxX1 = maxX1;
        minX2 = minX2;
    } else {
        maxX1 = tempMaxX1;
        minX2 = tempMinX2;
    }
    if (sphere1.object.position.x >= maxX1) {
        sphere1.object.position.x = minX1 + 1;
        // sphere1.velocity.multiplyScalar(-1);
    } else if(sphere1.object.position.x <= minX1){
        sphere1.object.position.x = THREE.MathUtils.randFloat(minX1 + 1, minX1 + 20);
        // sphere1.object.position.x = minX1 + 1;
        // sphere1.velocity.multiplyScalar(-1);
    }

    if (sphere2.object.position.x >= maxX2) {
        sphere2.object.position.x = THREE.MathUtils.randFloat(maxX2 - 15 , maxX2 - 1);
        // sphere2.velocity.multiplyScalar(-1);
    } else if(sphere2.object.position.x <= minX2){
        sphere2.object.position.x = maxX2 - 1;
        // sphere2.velocity.multiplyScalar(-1);
    }

    if (sphere1.object.position.y > yedge) {
        sphere1.object.position.y = yedge - 1;
        sphere1.velocity.multiplyScalar(-1);
    } else if (sphere1.object.position.y < ynedge) {
        sphere1.object.position.y = ynedge + 1;
        sphere1.velocity.multiplyScalar(-1);
    }

    if (sphere2.object.position.y > yedge) {
        sphere2.object.position.y = yedge - 1;
        sphere2.velocity.multiplyScalar(-1);
    } else if (sphere2.object.position.y < ynedge) {
        sphere2.object.position.y = ynedge + 1;
        sphere2.velocity.multiplyScalar(-1);
    }

    if (sphere1.object.position.z > zedge) {
        sphere1.object.position.z = zedge - 1;
        sphere1.velocity.multiplyScalar(-1);
    } else if (sphere1.object.position.z < znedge) {
        sphere1.object.position.z = znedge + 1;
        sphere1.velocity.multiplyScalar(-1);
    }

    if (sphere2.object.position.z > zedge) {
        sphere2.object.position.z = zedge - 1;
        sphere2.velocity.multiplyScalar(-1);
    } else if (sphere2.object.position.z < znedge) {
        sphere2.object.position.z = znedge + 1;
        sphere2.velocity.multiplyScalar(-1);
    }
}

// Function to reset GUI controls
function resetGUI() {
    console.log('reset attempted');
    Object.assign(cameraControls, electricFieldControl);
        electricFieldControl.x = 0;
        camera.position.x = 0;
        camera.rotation.y = MathUtils.degToRad(0);
        camera.position.z = 116; 
        voltage = 0;
    gui.updateDisplay(); // Update GUI to reflect the changes
}


function createIon(minx, maxx, color, ionType) {
    let capsuleLength = 3;
    let radius = 0.5;
    const geometry = new THREE.CapsuleGeometry(radius, capsuleLength);
    //negative shape
    if (ionType == "acceptor") {
        let material = new THREE.MeshBasicMaterial({color: color, transparent: true, opacity: 0.2});
        let acceptor = new THREE.Mesh(geometry, material);
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
        let geometry2 = new THREE.CapsuleGeometry(radius, capsuleLength);
        geometry2.rotateZ(Math.PI/2);  
        let mergedGeometry = new BufferGeometryUtils.mergeGeometries([geometry, geometry2]);
        let material = new THREE.MeshBasicMaterial({color: color, transparent: true,  opacity: 0.4});
        let donor = new THREE.Mesh(mergedGeometry, material);
        donor.position.set(
            THREE.MathUtils.randFloat(minx, maxx),
            THREE.MathUtils.randFloat(-cubeSize.y/2 + 1, cubeSize.y/2 - 1),
            THREE.MathUtils.randFloat(-cubeSize.z/2 + 1, cubeSize.z/2 - 1)
        );
        scene.add(donor);
    }
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


// Function to create a sphere inside the cube
function createSphere(i, minPos, maxPos, sphereColor, transparency) {
    let opacityVal = null;
    if (transparency) {
        opacityVal = 0.6;
    }
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: sphereColor, transparent: transparency, opacity: opacityVal});
    const sphere = new THREE.Mesh(geometry, material);

    // Random position within the cube as specified
    sphere.position.set(
    THREE.MathUtils.randFloat(minPos, maxPos),
    THREE.MathUtils.randFloat(-cubeSize.y/2 + 1, cubeSize.y/2 - 1),
    THREE.MathUtils.randFloat(-cubeSize.z/2 + 1, cubeSize.z/2 - 1)
    );
    scene.add(sphere);
    return {object: sphere, material: material};
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}


