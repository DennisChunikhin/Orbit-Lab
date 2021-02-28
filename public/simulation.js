var scene;
var camera;
var box;
var renderer;
var controls;
var mesh;
var raycaster
var mouse;
var WIDTH;
var HEIGHT;

var selected;
var simulationRunning = false;
var sim;

var movingMobile;

window.addEventListener('load', setUp);
window.addEventListener('mousemove', mouseMove);
window.addEventListener('click', mouseClick);
//window.addEventListener('touchend', touchEnd);

window.addEventListener('touchstart', () => { movingMobile = false; });
window.addEventListener('touchmove', () => { console.log("Move");movingMobile = true; }, true);

//Resize window
window.addEventListener('resize', function() {
	WIDTH = document.getElementById("main").offsetWidth;
	HEIGHT = window.innerHeight;
	renderer.setSize(WIDTH, HEIGHT);
	camera.aspect = WIDTH / HEIGHT;
	camera.updateProjectionMatrix();
});

//Keeps track of mouse position
function mouseMove(event) {
	let menuSize = document.getElementById("menu").offsetWidth;
	mouse.x = ((event.clientX-menuSize) / WIDTH) * 2 - 1;
	mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
}

//Click
function mouseClick() {
	raycaster.setFromCamera(mouse, camera);
	
	let intersects = raycaster.intersectObjects(scene.children);
	
	if (intersects.length != 0) {
		deselect();
		selectBody(intersects[0].object);
	}
	else if (mouse.x >= -1) {
		deselect();
	}

	renderer.render(scene, camera);
}

//Click on mobile
/*function touchEnd(event) {
	if (movingMobile)
		return;
	
	mouse.x = (event.changedTouches[0].clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.changedTouches[0].clientY / window.innerHeight) * 2 + 1;
	
	raycaster.setFromCamera(mouse, camera);
	
	let intersects = raycaster.intersectObjects(scene.children);
	
	if (intersects.length != 0) {
		deselect();
		selectBody(intersects[0].object);
	}
	else if (mouse.x >= -1) {
		deselect();
	}

	renderer.render(scene, camera);
}*/


//Initialize everything
function setUp() {
	makeScene();
	
	loadData();
	if (scene.children.length == 0)
		addObj();

	light();
}

//Initialize scene
function makeScene() {
	scene = new THREE.Scene();
	raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector2();
	
	WIDTH = document.getElementById("main").offsetWidth;
	HEIGHT = window.innerHeight;
	
	camera = new THREE.PerspectiveCamera(
		75,
		WIDTH / HEIGHT,
		0.1,
		1000
	);
	camera.position.z = 10;

	const loader = new THREE.TextureLoader();
    const texture = loader.load(
      'img/space_background.jpg',
      () => {
        const rt = new THREE.WebGLCubeRenderTarget(texture.image.height);
        rt.fromEquirectangularTexture(renderer, texture);
        scene.background = rt;
      });

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setClearColor("#e5e5e5");

	renderer.setSize(WIDTH, HEIGHT);

	document.getElementById('threeContainer').appendChild(renderer.domElement);

	controls = new THREE.OrbitControls(camera, renderer.domElement);
}

//Add lighting
function light() {
	var light = new THREE.HemisphereLight(0xFFFFFF, 1);
	light.position.set(5, 20, 2);
	scene.add(light);
	
	renderer.render(scene, camera);
}

//Selects object
function selectBody(object) {
	selected = object;
	
	document.getElementById("X").disabled = false;
	document.getElementById("Y").disabled = false;
	document.getElementById("Z").disabled = false;
	document.getElementById("v_X").disabled = false;
	document.getElementById("v_Y").disabled = false;
	document.getElementById("v_Z").disabled = false;
	document.getElementById("scale").disabled = false;
	document.getElementById("mass").disabled = false;
	
	object.material.color.setHex("0x003366");
	
	updateInputs(object);
}

//Puts object's attributes into the input boxes
function updateInputs(object) {
	document.getElementById("X").value = object.position.x;
	document.getElementById("Y").value = object.position.y;
	document.getElementById("Z").value = object.position.z;
	
	document.getElementById("v_X").value = object.userData.v.x;
	document.getElementById("v_Y").value = object.userData.v.y;
	document.getElementById("v_Z").value = object.userData.v.z;
	
	document.getElementById("scale").value = object.scale.x;
	document.getElementById("mass").value = object.userData.mass;
}

//Unselects object
function deselect() {
	if (selected != null)
		selected.material.color.setHex("0xfafeff");
	selected == null;
	
	document.getElementById("X").disabled = true;
	document.getElementById("Y").disabled = true;
	document.getElementById("Z").disabled = true;
	document.getElementById("v_X").disabled = true;
	document.getElementById("v_Y").disabled = true;
	document.getElementById("v_Z").disabled = true;
	document.getElementById("scale").disabled = true;
	document.getElementById("mass").disabled = true;
}

//Updates all values of selected object to what the user entered
function update() {
	selected.position.x = parseFloat(document.getElementById("X").value);
	selected.position.y = parseFloat(document.getElementById("Y").value);
	selected.position.z = parseFloat(document.getElementById("Z").value);
	
	selected.userData.v.x = parseFloat(document.getElementById("v_X").value);
	selected.userData.v.y = parseFloat(document.getElementById("v_Y").value);
	selected.userData.v.z = parseFloat(document.getElementById("v_Z").value);
	
	selected.scale.x = parseFloat(document.getElementById("scale").value);
	selected.scale.y = selected.scale.x;
	selected.scale.z = selected.scale.x;
	
	selected.userData.mass = parseFloat(document.getElementById("mass").value);
	
	updateVArrow(selected);
	saveData(getBodies());
}

//Add an object
function addObj() {
	let m = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 32), new THREE.MeshPhongMaterial({ color: 0xfafeff }));
	m.position.y = 0;
	m.position.x = 0;
	
	m.userData = {v: new THREE.Vector3(), a: new THREE.Vector3(), mass: 10, vArrow: new THREE.ArrowHelper( THREE.Vector3(1,0, 0), m.position, 0, 0xfafeff )};
	
	scene.add(m);
	scene.add(m.userData.vArrow);
	
	deselect();
	selectBody(m);
}

/* -- N BODY SIMULATION -- */

//Get a list of all bodies
function getBodies() {
	let bodies = [];
	for (let i = 0; i < scene.children.length; i++) {
		if (scene.children[i].type == "Mesh")
			bodies.push(scene.children[i]);
	}
	return bodies;
}

//Calculate the acceleration of body (stored in body.userData.a)
function acceleration(body, bodies) {
	body.userData.a = new THREE.Vector3();
	let self_vect = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
	for (let i = 0; i < bodies.length; i++) {
		
		if (bodies[i] === body)
			continue;
		
		let r2 = body.position.distanceToSquared(bodies[i].position);
		let r_u = new THREE.Vector3(bodies[i].position.x, bodies[i].position.y, bodies[i].position.z).sub(self_vect).normalize()
		
		body.userData.a.add( r_u.multiplyScalar(document.getElementById("G").value * bodies[i].userData.mass / r2) );
	
	}
}

//Propagate forward one timestep
function nextTimestep() {
	let bodies = getBodies();
	
	//Calculate accelerations and move objects
	for (let i = 0; i < bodies.length; i++) {
		acceleration(bodies[i], bodies);
	}
	
	let t = document.getElementById("timestep").value;
	//Move objects
	for (let i = 0; i < bodies.length; i++) {
		//Update position
		let velocity = new THREE.Vector3(bodies[i].userData.v.x, bodies[i].userData.v.y, bodies[i].userData.v.z);
		let accel = new THREE.Vector3(bodies[i].userData.a.x, bodies[i].userData.a.y, bodies[i].userData.a.z);
		bodies[i].position.add( velocity.multiplyScalar(t).add( accel.multiplyScalar(t*t/2) ) );
		//Update velocity
		bodies[i].userData.v.add(bodies[i].userData.a.multiplyScalar(t));
		updateVArrow(bodies[i]);
	}
	
	if (selected != null)
		updateInputs(selected);
}

//Toggle simulaton on/off
function toggleSimulation() {
	if (simulationRunning) {
		document.getElementById("toggleSim1").innerHTML = '<i class="fa fa-play fa-lg"></i> Start Simulation';
		document.getElementById("toggleSim2").innerHTML = 'Start Simulation';
		window.clearInterval(sim);
	}
	else {
		document.getElementById("toggleSim1").innerHTML = '<i class="fa fa-pause fa-lg"></i> Pause Simulation';
		document.getElementById("toggleSim2").innerHTML = 'Pause Simulation';
		sim = window.setInterval(nextTimestep, 1000/parseFloat(document.getElementById("fps").value));
	}
	simulationRunning = !simulationRunning;
}

//Run simulation
function simulate() {
	while (simulationRunning) {
		setTimeout(nextTimestep, 1000/parseFloat(document.getElementById("fps").value));
	}
}

//Save object data in url hash
function saveData(bodies) {
	window.location.hash = "";
	for (let i = 0; i < bodies.length; i++) {
		let obj = bodies[i];
		let stateObject = {
			"X": obj.position.x,
			"Y": obj.position.y,
			"Z": obj.position.z,
			"VX": obj.userData.v.x,
			"VY": obj.userData.v.y,
			"VZ": obj.userData.v.z,
			"S": obj.scale.x,
			"M": obj.userData.mass
		};
		let str = JSON.stringify(stateObject);
		let res = encodeURI(str);
		window.location.hash += res;
		if (i != bodies.length-1)
			window.location.hash += "&";
	}
}

//Loads object data from url hash
function loadData() {
	let data = decodeURI(window.location.hash.substring(1)).split("&");
	
	for(let i = 0; i < data.length; i++) {
		try {
			let obj = JSON.parse(data[i]);
			
			console.log(obj);
			
			let m = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 32), new THREE.MeshPhongMaterial({ color: 0xfafeff }));
			m.position.x = obj.X
			m.position.y = obj.Y;
			m.position.z = obj.Z;
			
			m.userData = {v: new THREE.Vector3(obj.VX, obj.VY, obj.VZ), a: new THREE.Vector3(), mass: obj.M, vArrow: new THREE.ArrowHelper( THREE.Vector3(1,0, 0), m.position, 0, 0xfafeff )};
			
			m.scale.x = obj.S;
			m.scale.y = m.scale.x;
			m.scale.z = m.scale.x;
			
			scene.add(m);
			scene.add(m.userData.vArrow);
			updateVArrow(m);
		}
		catch(err) {
			continue;
		}
	}
}

//Update velocity arrows
function updateVArrow(object) {
	object.userData.vArrow.position.copy(object.position);
	object.userData.vArrow.setLength(object.userData.v.length() * 10);
	object.userData.vArrow.setDirection(object.userData.v.clone().normalize());
}

function copyUrl() {
	const dummy = document.createElement('p');
	dummy.textContent = window.location.href;
	document.body.appendChild(dummy);

	const range = document.createRange();
	range.setStartBefore(dummy);
	range.setEndAfter(dummy);

	const selection = window.getSelection();
	// First clear, in case the user already selected some other text
	selection.removeAllRanges();
	selection.addRange(range);

	document.execCommand('copy');
	document.body.removeChild(dummy);
}

var render = function () {
	requestAnimationFrame(render);

	renderer.render(scene, camera);
}

render();