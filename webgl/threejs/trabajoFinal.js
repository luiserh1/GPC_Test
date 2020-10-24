/*
*	Trabajo Final GPC. Luis Serrano Hernández
*	El juegarral
*/
"use strict"; // Ayuda a hacer un poco más estricto el tipado de las variables

const pi = Math.PI;

////////////////////////
// VARIABLES GLOBALES //
////////////////////////
// Imprescindibles
var renderer, scene, camera;
// Controlador de la cámara
var cameraController;
// Controladores de la entrada por teclado y ratón
var domEvents, keyboard;
// Controlador del tiempo
var clock;
// Controlador de la configuración y efectos del mapa
var mapController;
// Controlador del rendimiento
var stats;
// El mapa general
var map;

// Material de depuración
var materialDebug = new THREE.MeshBasicMaterial({color:'white', wireframe:true});

//////////////////////////////////////
// FUNCIONES DE GEOMETRÍAS Y MALLAS //
//////////////////////////////////////
function tileGeometry(radius, heigth) { return new THREE.CylinderGeometry( radius, radius, heigth, 6 ); }

function tileBorderGeometry(RM, heigth)
{
    var geo = new THREE.Geometry();

    var rm = 0.9 * RM;
    var sh = heigth / 2;
    var coordenadas = [];
    var currentAngle = 0;
    // Se construyen una línea por cada prisma hexagonal (externo e interno) por cada iteración (4 vértices en total) en el siguiente orden:
    //      Extterno    Intterno
    //      2           4
    //      |           |
    //      |           |
    //      |           |
    //      1           3
    for (var i = 0; i < 6; i++)
    {
        var xM, xm, zM, zm;
        xM = RM * Math.sin(currentAngle);
        zM = RM * Math.cos(currentAngle);
        xm = rm * Math.sin(currentAngle);
        zm = rm * Math.cos(currentAngle);
        coordenadas.push(xM); coordenadas.push(-sh); coordenadas.push(zM); // 1
        coordenadas.push(xM); coordenadas.push(sh); coordenadas.push(zM); // 2
        coordenadas.push(xm); coordenadas.push(-sh); coordenadas.push(zm); // 3
        coordenadas.push(xm); coordenadas.push(sh); coordenadas.push(zm); // 4
        currentAngle += pi / 3;
    }

    // Tras haber seguido el esquema anterior ahora podemos indeicar el orden de los vértices para generar los triángulos
    // Se generan 8 triángulos por iteración:
    // -> 2 cara frontal    -> 2 cara externa superior
    // -> 2 cara interior   -> 2 cara inferior
    // TODO -> Dibujar esquema y subirlo a espacio compartido
    var indices = [];
    for (var i = 0; i < coordenadas.length + 4; i += 4)
    {
        // Guardamos todos los índices de los 8 vértices con los que vamos a trabajar por iteración
        var x, x1, x2, x3, x4, x5, x6, x7;
        x = i;          x1 = i + 1;
        x2 = i + 2;     x3 = i + 3;

        // La última arista cierra con la primera
        var j = i;
        if (i / 4 == 5) j = -4;
        x4 = j + 4;     x5 = j + 5;
        x6 = j + 6;     x7 = j + 7;
        // Los vértices de los triángulos se introducen en orden horario, vara generarlos en orden antihorario es suficiente con
        // recorrer el array de índices en orden reverso
        // Triángulos cara frontal
        indices.push(x);    indices.push(x1);   indices.push(x4);
        indices.push(x4);   indices.push(x1);   indices.push(x5);
        // Triángulos cara trasera
        indices.push(x1);   indices.push(x3);   indices.push(x5);
        indices.push(x5);   indices.push(x3);   indices.push(x7);
        // Triángulos cara superior
        indices.push(x2);   indices.push(x);    indices.push(x4);
        indices.push(x6);   indices.push(x2);   indices.push(x4);
        // Triángulos cara inferior
        indices.push(x3);   indices.push(x2);   indices.push(x6);
        indices.push(x7);   indices.push(x3);   indices.push(x6);
    }

    // Guardando la suma acumulada por cada coordenada se puede obtener un pivote centrado en la geometría sacando la media
    // Se obtiene la suma a la vez que se registran los vértices
    var vertexSum = [0, 0, 0];
    for (var i = 0; i < coordenadas.length; i += 3)
    {
        var ver = new THREE.Vector3(coordenadas[i], coordenadas[i+1], coordenadas[i+2]);
        geo.vertices.push(ver);
        vertexSum[0] += coordenadas[i];
        vertexSum[1] += coordenadas[i+1];
        vertexSum[2] += coordenadas[i+2];
    }
    // Se registran las caras. Leyendo de atrás hacia delante se generan los triángulos con los vértices en sentido antihorario
    for (var i = indices.length-1; i > 0; i -= 3)
    {
        var triangulo = new THREE.Face3(indices[i], indices[i-1], indices[i-2]);
        // for (var j = 0; j < 3; j++) { }
        geo.faces.push(triangulo);
    }

    // Cálculo del pivote (desactivado por ser el origen por defecto gracias a la forma en la que se construye)
    /*var numVertex = coordenadas.length / 3;
    var pivotX, pivotY, pivotZ;
    pivotX = vertexSum[0] / numVertex;
    pivotY = vertexSum[1] / numVertex;
    pivotZ = vertexSum[2] / numVertex;
    // Finalmente, se centra el pivote moviendo la geometría de forma que este quede en (0,0,0)
    geo.applyMatrix( new THREE.Matrix4().makeTranslation( -pivotX, -pivotY, -pivotZ ) );*/

    return geo;
}

////////////
// CLASES //
////////////
/*
*   A map represents all the tiles, the units and the stats of the game
*/
class Map
{
    constructor(radius, centerNode)
    {
        this.radius = radius;
        this.centerNode = centerNode;
    }
}

/*
*   A tile is a piece of the terrain where units and buildings can be placed
*/
class HexaTile
{
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
        this.unit = undefined;
        this.building = undefined;
        this.mesh = undefined;
    }
}

class HexaNode
{
    constructor(upLeft, upRight, centerRight, bottomRight, bottomLeft, centerLeft)
    {
        this.upLeft = upLeft;
        this.upRight = upRight;
        this.centerRight = centerRight;
        this.bottomRight = bottomRight;
        this.bottomLeft = bottomLeft;
        this.centerLeft = centerLeft;
    }
}

/*
*   An unit is a piece in the game that can be moved and has special properties
*/
class Unit
{
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
    }
}

/*
*   A buolding is a piece in the game that cannot be moved and has special properties
*/
class Building
{
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
    }
}

//////////////////////////
// FUNCIONES AUXILIARES //
//////////////////////////

function setUpGUI()
{
    // Definicion de los controles
    mapController =
    {
		radius: 15,     // Valores iniciales
		reset: false
	};

	// Creacion interfaz
	var gui = new dat.GUI();

    // CONSTRUCCIÓN DEL MENÚ
    // Añadir subcarpeta
    var h = gui.addFolder("Configuración Mapa");
    // Configurar opciones
    // Variable que almacena la opción              Nombre dict    Nombre en dict        Min   Max    Delta   Nombre Visible
    var radiusLS =                            h.add(mapController, "radius",             10,   30,    1).name("Radio");
    var resetLS = h.add(mapController, "reset").name("Reconstruir");
    // Almacenar la opción en una variable permite configurar un <<listener>>
    // Lo cuál es imprescindible, pues necesitamos devolver el foco al canvas una vez terminada la configuración
    // Esto se logra con <<renderer.domElement.focus()>>
    radiusLS.onChange(function (nuevoValor)
    {
        renderer.domElement.focus();
    });
    resetLS.onChange(function (nuevoValor)
    {
        renderer.domElement.focus();
    });
}

/*
*   Inicializa todos los valores y componentes relativos a la(s) cámara(s)
*/
function setUpCameras(ar)
{
    var puntoInteres = new THREE.Vector3(0, 0, 0);

    // Perspectiva
    camera = new THREE.PerspectiveCamera( 50, ar, 0.1, 1500);
    camera.position.set(-10, 10, -10);

    // El controlador de la cámara recibe como parámetros la propia cámara y el canvas
    cameraController = new THREE.OrbitControls(camera, render.domElement);
    camera.lookAt(puntoInteres); // Debe ir después de la inicialización de los controladores para evitar reseteos
    cameraController.target.set(puntoInteres.x, puntoInteres.y, puntoInteres.z);
    cameraController.enableKeys = false;
    //cameraController.enableRotate = false;    
}

/*
*   Cargar la escena con objetos (Principal)
*/
function loadHexagonalMapScene(radius)
{
    scene = new THREE.Scene();
    map = {}; // TODO enums, primero pos y luego mesh 

    // Materiales
    // General
    var materialDefault = new THREE.MeshBasicMaterial({color:'red', wireframe:true});
    var materialTile = new THREE.MeshBasicMaterial({color:'green', wireframe:false});
    var materialBorder = new THREE.MeshBasicMaterial({color:'orange', wireframe:false});

    // Cargando el mapa
    var tileRadius = 1;
    var tileHeigth = 1;
    var tileMargin = tileRadius / 10;
    var map = new THREE.Group();

    var tileBorderGeo = tileBorderGeometry(tileRadius * 1.02, tileHeigth * 1.02);
    var tileGeo = tileGeometry(tileRadius, tileHeigth);

    var hexaMesh = new THREE.Mesh(tileGeo, materialTile);
    var hexaBorderMesh = new THREE.Mesh(tileBorderGeo, materialBorder);
    var tileGroup = new THREE.Group();
    console.error(hexaMesh.type);
    console.error(tileGroup.type);
    tileGroup.add(hexaMesh);
    tileGroup.add(hexaBorderMesh);
    map.add(tileGroup);
    for (var i = 1; i < radius; i++)
    {
        var angle = pi / 6;
        for (var j = 0; j < 6; j++)
        {
            hexaMesh = new THREE.Mesh(tileGeo, materialTile);
            hexaBorderMesh = new THREE.Mesh(tileBorderGeo, materialBorder);
            tileGroup = new THREE.Group();
            tileGroup.add(hexaMesh);
            tileGroup.add(hexaBorderMesh);
            tileGroup.translateX(i * (tileRadius * Math.sqrt(3) + tileMargin) * Math.sin(angle));
            tileGroup.translateZ(i * (tileRadius * Math.sqrt(3) + tileMargin) * Math.cos(angle));

            var nextAngle = angle + pi / 3;
            var nextPos = new THREE.Vector3(i * (tileRadius * Math.sqrt(3) + tileMargin) * Math.sin(nextAngle),
                                            0,
                                            i * (tileRadius * Math.sqrt(3) + tileMargin) * Math.cos(nextAngle));
            var tilePos = new THREE.Vector3();
            tileGroup.getWorldPosition(tilePos);
            for (var k = 1; k < i; k++)
            {
                var interTileGroup = tileGroup.clone(true);
                
                var despX = k * (nextPos.x - tilePos.x) / i;
                var despZ = k * (nextPos.z - tilePos.z) / i;

                interTileGroup.applyMatrix( new THREE.Matrix4().makeTranslation(despX, 0, despZ));

                map.add(interTileGroup);
            }

            map.add(tileGroup);

            angle += pi / 3;
        }
    }
    console.info("Hay un total de " + map.children.length + " tiles")
    
    scene.add(map);
    //scene.add(new THREE.AxesHelper(15));
    console.info("Escena cargada");
}

/*
*   Realiza los cálculos y ajustes necesarios para mantener la escena en pantalla pese
*   a los posibles cambos de tamaño del viewport
*/
function updateAspectRatio() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    var ar = window.innerWidth  / window.innerHeight;
    camera.aspect = ar;
    // Se ha variado el volumen de la vista
    camera.updateProjectionMatrix();
}

/*
*   Cambios entre frames.
*/
function update()
{

}

/*
*   Función a cargo de dibujar cada frame
*/
function render() {
    requestAnimationFrame(render);

    update();

    renderer.clear();

    // La cámara principal ocupa todala ventana
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.render( scene, camera );
}

function animateIncrementalRendering(percent)
{
    // OJO
    //var protoScene = scene.clone();
    var protoScene = new THREE.Scene();

    var objectsToRender = [];
    var elementsToAnalyze = [scene];
    for (let element of elementsToAnalyze)
    {
        if (element.type == "Group" || element.type == "Object3D")
            for (let child of element.children) 
                elementsToAnalyze.push(child);
        else
            objectsToRender.push(element);
    }

    var objPercent = percent *  1.2;
    if (objPercent > 1) objPercent = 1;
    var objectsToRender = Math.ceil(objPercent * objectsToRender.length);
    for (let obj of objectsToRender)
    {
        var facesToRender = Math.ceil(percent * obj.geometry.faces.length);

    }
}

function init()
{
    // Motor de render
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor( new THREE.Color(0x0000AA) );
    // Esta opción requiere "Cleans" manuales
    renderer.autoClear = false;
    // El canvas pasa a estar asociado al contenedor definido en el documento HTML
    document.getElementById('container').appendChild(renderer.domElement);

    // Camara
    var ar = window.innerWidth / window.innerHeight;
    setUpCameras(ar);

    // Interfaz Gráfica de Usuario
    setUpGUI();

    // Controles
    domEvents = new THREEx.DomEvents(camera, renderer.domElement);
    keyboard = new THREEx.KeyboardState(renderer.domElement);
    renderer.domElement.setAttribute("tabIndex", "0");
    renderer.domElement.focus();
    
    // Seguimiento del rendimiento
    stats = new Stats();
    stats.showPanel( -1 ); // 0: fps, 1: ms, 2: mb, 3+: custom 
    document.body.appendChild( stats.dom );

    // Eventos
    window.addEventListener('resize', updateAspectRatio);

    // Controlar el tiempo
    clock = new THREE.Clock(true);

    // Carga de la escena principal
    loadHexagonalMapScene(5);

    // Inicio del ciclo de renderizado
    render();
}

//////////////
// ARRANQUE //
//////////////
init();