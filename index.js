import * as THREE from 'three';
import { MathUtils } from 'three/src/math/MathUtils';

//scene set up variables and window variables
let container, camera, scene, renderer;
let mouseX = 0;
let mouseY = 0;
let electricFieldControl;
let cameraControls;
let initialCameraControls;
let initialElectricFieldControl;
let gui;
let minScalar = 0.22;
let maxScalar = 0.88;

//PN Junction Initial Variables
let spheres = [];
let cube;
let cubeSize = 50;
let clock = new THREE.Clock();
let xLevel = 0.0;

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
    camera.position.x = 86;
    camera.rotation.y = MathUtils.degToRad(38);
    camera.position.z = 92;
    //renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild( renderer.domElement );

    // GUI
    gui = new dat.GUI();
    cameraControls = {
        translateZ : 92,
        translateX: 86,
        rotateY: MathUtils.degToRad(38),
    };

    initialCameraControls = {
        translateZ : 92,
        translateX: 86,
        rotateY: MathUtils.degToRad(38),
    };

    electricFieldControl = {
        x: 0.0,
    };

    initialElectricFieldControl = {
        x: 0.0,
    };



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

    gui.add(electricFieldControl, 'x', -10.0, 10.0).name('Electric Field V/cm   ').step(0.01).onChange(() => {
        xLevel = electricFieldControl.x;
    });

    // Add a button to reset GUI controls
    gui.add(resetButton, 'Reset Cube');

      

    // window resize handler
    window.addEventListener( 'resize', onWindowResize );
  
    //background
    //3d cube texture
    // const path = 'Textures/Cube/Pisa/';
    // const format = '.png';
    // const urls = [
    // path + 'Px' + format, path + 'Nx' + format,
    // path + 'Py' + format, path + 'Ny' + format,
    // path + 'Pz' + format, path + 'Nz' + format
    // ];

    // const textureCube = new THREE.CubeTextureLoader().load( urls );
    //add background to scene
    // scene.background = textureCube;

    // create cube container
    createCube();
    // create initial electrons
    for (let i = 0; i < 10; i++) {
        createSphere();
    }
}

// Function to reset GUI controls
function resetGUI() {
    console.log('reset attempted');
    Object.assign(cameraControls, initialCameraControls, electricFieldControl, initialElectricFieldControl);
        camera.position.x = 86;
        camera.rotation.y = MathUtils.degToRad(38);
        camera.position.z = 92; 
    gui.updateDisplay(); // Update GUI to reflect the changes
}



// Function to create a sphere inside the cube
function createSphere() {
  const geometry = new THREE.SphereGeometry(1, 32, 32);
  const material = new THREE.MeshBasicMaterial({ color: 0xF8DE7E});
  const sphere = new THREE.Mesh(geometry, material);
  
  // Random position within the cube
  sphere.position.set(
    THREE.MathUtils.randFloat(-cubeSize/2 + 1, cubeSize/2 - 1),
    THREE.MathUtils.randFloat(-cubeSize/2 + 1, cubeSize/2 - 1),
    THREE.MathUtils.randFloat(-cubeSize/2 + 1, cubeSize/2 - 1)
  );
  
  cube.add(sphere);
  let randomVelocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  spheres.push({ object: sphere, velocity: randomVelocity,
    speed: Math.random() * (maxScalar - minScalar + 1) + minScalar, initVelocity: randomVelocity});
}

function createCube() {
    // Create a cube to contain spheres
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x808080, wireframe: true, transparent: true, opacity: 0.1});
    cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    scene.add(cube);
}

function update() {
	requestAnimationFrame( update );
    let time = clock.getDelta() * 20;
    
    //dis my electric field...
    let electricField = new THREE.Vector3(xLevel, 0, 0);
    
    // scatter every 6 seconds
    if (Date.now() % 6000 < 16.7) {
        console.log("6 sec");
        spheres.forEach((sphere) => {
            sphere.object.material = new THREE.MeshBasicMaterial({color: 0xFF5733});
            setTimeout(() => {
                sphere.object.material = new THREE.MeshBasicMaterial({color: 0xF8DE7E});
            }, 1000);
            sphere.velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
        });
    }
    // adjust velocity
    spheres.forEach((sphere) => {
       
        sphere.velocity.normalize();
        //electric field check, electrons are constantly increasing
        if (electricField.length() !== 0) {
            console.log("time:", time);
            console.log("pre-xVel:", sphere.velocity.x)
            // random direction when electric field is active
            // sphere.velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
            // // random speed when electric field is active
            // sphere.speed =Math.random() * (maxScalar - minScalar + 1) + minScalar

            

            // Calculate the increment based on the electric field
            let incVelocityX = electricField.x * time;

            // Scale the direction vector with the increment

            console.log("post-xVel:", -incVelocityX);
            //if the sphere velocity is positive then negate new increasing velocity
            // if (sphere.velocity.x > 0) {
            sphere.velocity.x = sphere.initVelocity.x - incVelocityX;
            // } 
        }
        // console.log(sphere.velocity);
       
        // randomizes the electron speed
        sphere.velocity.multiplyScalar(sphere.speed);
       

        // Apply a minimum velocity threshold
        const minVelocity = 0.2;
        const maxVelocity = 0.6;
        sphere.velocity.clampLength(minVelocity, maxVelocity);
        
        checkBounds(sphere);
        sphere.object.position.add(sphere.velocity);
    });

    
	renderer.render( scene, camera );
}

function checkBounds(sphere) {
    // cube boundaries
    let edge = (cubeSize/2) - 1;
    let nedge = -(edge);
    
    if (sphere.object.position.x >= edge) {
        console.log('sphere greater than x pos edge');
        sphere.object.position.x = -edge;
        // sphere.velocity.x *= -1.8;
    } else if(sphere.object.position.x <= nedge){
        sphere.object.position.x = edge;
    }

    if (sphere.object.position.y >= edge) {
        console.log('sphere greater than y pos edge');
        sphere.object.position.y = -edge;
        // sphere.velocity.y *= -1.8;
    } else if (sphere.object.position.y <= nedge) {
        sphere.object.position.y = edge;
    }
    if (sphere.object.position.z >= edge) {
        console.log('sphere greater than z pos edge');
        sphere.object.position.z = edge;
        // sphere.velocity.z *= -1.8;
    } else if (sphere.object.position.z <= nedge) {
        sphere.object.position.z = -edge;
    }
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}


