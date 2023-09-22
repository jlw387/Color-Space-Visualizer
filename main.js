import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import * as colormath from './colormath.js';

// Basic Rendering Setup

const scene = new THREE.Scene();
const origin = new THREE.Vector3(0,0,0);
const cameraFocus = new THREE.Vector3(0.5,0.5,0.5);
scene.background = new THREE.Color(0x222222);

// Need multiple cameras for diagram view
const camera = new THREE.PerspectiveCamera( 75, 1.5, 0.1, 1000 );
var stored_camera = camera.clone();

const renderer = new THREE.WebGLRenderer();
const canvasWidth = Math.min(window.innerWidth, Math.floor(window.innerHeight * 1.5)) / 1.25;
renderer.setSize( canvasWidth, Math.floor(canvasWidth / 1.5) );

const render_element = document.getElementById("renderCanvas");
render_element.appendChild( renderer.domElement );

camera.position.set(2.5,2.5,2.5);
const controls = new OrbitControls( camera, renderer.domElement );
controls.target = cameraFocus;

console.log(camera.projectionMatrix);

// Add Axes to scene
const axes = new THREE.AxesHelper(2)
scene.add(axes);

// Common Linear Color Spaces (defined in XYZ coords) (taken from http://www.brucelindbloom.com/Eqn_RGB_XYZ_Matrix.html)

// CIE RGB
const CIERGBToXYZ = new THREE.Matrix3().set(0.4887180, 0.3106803, 0.2006017,
                                            0.1762044, 0.8129847, 0.0108109,
                                            0.0000000, 0.0102048, 0.9897952);

const XYZToCIERGB = CIERGBToXYZ.clone();
XYZToCIERGB.invert();

// Adobe RGB
const AdobeRGBToXYZ = new THREE.Matrix3().set(0.5767309, 0.1855540, 0.1881852,
                                        0.2973769, 0.6273491, 0.0752741,
                                        0.0270343, 0.0706872, 0.9911085);

const XYZToAdobeRGB = AdobeRGBToXYZ.clone();
XYZToAdobeRGB.invert();

// AppleRGB
const AppleRGBToXYZ = new THREE.Matrix3().set(0.4497288, 0.3162486, 0.1844926,
                                        0.2446525, 0.6720283, 0.0833192,
                                        0.0251848, 0.1411824, 0.9224628);

const XYZToAppleRGB = AppleRGBToXYZ.clone();
XYZToAppleRGB.invert();

// sRGB
const SRGBToXYZ = new THREE.Matrix3().set(0.4124564, 0.3575761, 0.1804375,
                                    0.2126729, 0.7151522, 0.0721750,
                                    0.0193339, 0.1191920, 0.9503041);

const XYZToSRGB = SRGBToXYZ.clone();
XYZToSRGB.invert();

// Create default gamut parallelepipeds

const piped_ciergb = new THREE.Group();
const piped_adobe = new THREE.Group();
const piped_apple = new THREE.Group();
const piped_srgb = new THREE.Group();
const piped_xyz = new THREE.Group();

// Create gamut color variables

// Need to keep these default values synced with HTML defaults
var ciergbColor = 0x808080;
var adobeColor = 0xff00ff;
var appleColor = 0xffff00;
var srgbColor = 0x40C0C0;
var xyzColor = 0xffffff;


// Set up gamut color pickers

var colorpickers = document.querySelectorAll(".gamut-colorpicker");

colorpickers.forEach(function(colorpicker) {
    colorpicker.addEventListener("input", handleGamutColorChange);
});

colormath.UpdateParallelipiped(piped_xyz, new THREE.Matrix3(), xyzColor);
colormath.UpdateParallelipiped(piped_ciergb, CIERGBToXYZ, ciergbColor);
colormath.UpdateParallelipiped(piped_adobe, AdobeRGBToXYZ, adobeColor);
colormath.UpdateParallelipiped(piped_apple, AppleRGBToXYZ, appleColor);
colormath.UpdateParallelipiped(piped_srgb, SRGBToXYZ, srgbColor);

// Set starting Visibility

piped_ciergb.visible = true;

piped_xyz.visible = false;
piped_adobe.visible = false;
piped_apple.visible = false;
piped_srgb.visible = false;

// Add gamut parallelepipeds to Scene

scene.add(piped_xyz);
scene.add(piped_ciergb);
scene.add(piped_adobe);
scene.add(piped_apple);
scene.add(piped_srgb);

// Used for reducing unnecessary computation
var pipeds_dirty = true;

// Add Diagram Unit Plane

const plane_dist = 1;

const unit_plane_geo = new THREE.BufferGeometry();
const vertices = new Float32Array( [
    plane_dist, 0.0, 0.0, // v1
    0.0, plane_dist, 0.0, // v2
    0.0, 0.0, plane_dist // v3
] );

unit_plane_geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
const unit_plane_alpha_texture = new THREE.TextureLoader().load( "ChromaticityPlaneAlphaTexture.png" );
const unit_plane_material = new THREE.MeshBasicMaterial( {alphaMap: unit_plane_alpha_texture, 
                                                  color: 0xA0A0A0,
                                                  side: THREE.DoubleSide} );
unit_plane_material.transparent = true;
const unit_plane_mesh = new THREE.Mesh(unit_plane_geo, unit_plane_material);

unit_plane_mesh.visible = false;

scene.add(unit_plane_mesh);

// Used for reducing unnecessary computation
var unit_plane_mesh_dirty = true;

// Add Visible Locus to Scene

const visible_locus = new THREE.Group();
const normalized_locus_curve = new THREE.Group();

visible_locus.visible = false;
normalized_locus_curve.visible = false;

scene.add(visible_locus);
scene.add(normalized_locus_curve);

var visible_locus_dirty = true;

// Set up basis changing

var basis_dropdown = document.getElementById("basis_dropdown");
basis_dropdown.addEventListener("change", handleBasisChange);

var oldBasis = basis_dropdown.value;
var newBasis = oldBasis;
var basisToXYZ = CIERGBToXYZ;

var transitioning_color_space = false;
var transition_step = 0;
var transition_duration = 10;


// Set up gamut visibility checkboxes

var checkboxes = document.querySelectorAll(".visible-checkbox");

checkboxes.forEach(function(checkbox) {
    checkbox.addEventListener("change", handleVisibilityChange);
});

// Set up diagram mode slider

document.getElementById("diagramModeToggle").addEventListener("change", swapDiagramMode);

function isDiagramMode()
{
    return document.getElementById("diagramModeToggle").checked;
}

function swapToDiagramCamera()
{
    // Store old camera to swap back later
    stored_camera = camera.clone();
    controls.enabled = false;

    const x_width = Math.max(3, 2 * camera.aspect);
    const y_height = Math.max(2, 3 / camera.aspect);

    const ortho = new THREE.OrthographicCamera(0.5 - x_width/2, 0.5 + x_width/2,
                                               0.5 + y_height/2, 0.5 - y_height/2, 
                                               1, 20);
    ortho.translateZ(10);
    ortho.lookAt(new THREE.Vector3(0,0,0));

    camera.copy(ortho);
}

function swapFromDiagramCamera()
{
    controls.enabled = true;

    camera.copy(stored_camera);
}

function swapDiagramMode(event)
{
    console.log("Swap!");
    var locus_visibility = document.getElementById("spectralLocusVisibleCheckbox").checked;
    if(event.target.checked){
        swapToDiagramCamera();
        if(locus_visibility != normalized_locus_curve.visible)
            visible_locus_dirty = true;
        visible_locus.visible = false;
        normalized_locus_curve.visible = locus_visibility;
    }
    else{
        swapFromDiagramCamera();
        if(locus_visibility != visible_locus.visible)
            visible_locus_dirty = true;
        visible_locus.visible = locus_visibility;
        normalized_locus_curve.visible = false;
    }      
}

function handleBasisChange(){
    if(basis_dropdown.value == oldBasis) 
        return;
    
    newBasis = basis_dropdown.value;

    transitioning_color_space = true;
}

function getBasisMatrix(basis)
{
    switch(basis)
    {
        case 'xyz':
            return new THREE.Matrix3();

        case 'ciergb':
            return CIERGBToXYZ.clone();

        case 'adobe':
            return AdobeRGBToXYZ.clone();
        
        case 'apple':
            return AppleRGBToXYZ.clone();
        
        case 'srgb':
            return SRGBToXYZ.clone();

        default:
            return new THREE.Matrix3();
    }
}

function updateBasisMatrix()
{
    if(!transitioning_color_space)
    {
        return basisToXYZ;
    }
    
    transition_step += 1;
    console.log(transition_step);
    
    visible_locus_dirty = true;
    pipeds_dirty = true;
    unit_plane_mesh_dirty = true;

    if(transition_step < transition_duration)
    {
        var t = 1 - ((transition_duration - transition_step) / transition_duration);
        t = colormath.Sigmoid(t, 2);

        console.log(oldBasis);
        console.log(newBasis);

        var oldBasisMatrix = getBasisMatrix(oldBasis);
        var newBasisMatrix = getBasisMatrix(newBasis);

        console.log(oldBasisMatrix);
        console.log(newBasisMatrix);

        var oldX = new THREE.Vector3();
        var oldY = new THREE.Vector3();
        var oldZ = new THREE.Vector3();
        oldBasisMatrix.extractBasis(oldX, oldY, oldZ);
        oldX.multiplyScalar(1-t);
        oldY.multiplyScalar(1-t);
        oldZ.multiplyScalar(1-t);

        var newX = new THREE.Vector3();
        var newY = new THREE.Vector3();
        var newZ = new THREE.Vector3();
        newBasisMatrix.extractBasis(newX, newY, newZ);
        newX.multiplyScalar(t);
        newY.multiplyScalar(t);
        newZ.multiplyScalar(t);

        var transitionX = new THREE.Vector3();
        var transitionY = new THREE.Vector3();
        var transitionZ = new THREE.Vector3();
        transitionX.addVectors(oldX, newX);
        transitionY.addVectors(oldY, newY);
        transitionZ.addVectors(oldZ, newZ);

        basisToXYZ = new THREE.Matrix3(transitionX.x, transitionY.x, transitionZ.x,
                                       transitionX.y, transitionY.y, transitionZ.y,
                                       transitionX.z, transitionY.z, transitionZ.z);
    }
    else
    {
        transitioning_color_space = false;
        transition_step = 0;
        oldBasis = newBasis;
        basisToXYZ = getBasisMatrix(newBasis);
    }
    
}

function handleVisibilityChange(event){
    var id = event.target.id;

    switch(id)
    {
        case "xyzVisibleCheckbox":
            if(piped_xyz != null)
                piped_xyz.visible = event.target.checked;
            pipeds_dirty = true;
            break;

        case "ciergbVisibleCheckbox":
                if(piped_ciergb != null)
                    piped_ciergb.visible = event.target.checked;
                pipeds_dirty = true;
                break;
        
        case "adobeVisibleCheckbox":
            if(piped_adobe != null)
                piped_adobe.visible = event.target.checked;
            pipeds_dirty = true;    
            break;
        
        case "appleVisibleCheckbox":
            if(piped_apple != null)
                piped_apple.visible = event.target.checked;
            pipeds_dirty = true;
            break;
        
        case "srgbVisibleCheckbox":
            if(piped_srgb != null)
                piped_srgb.visible = event.target.checked;
            pipeds_dirty = true;
            break;
        
        case "spectralLocusVisibleCheckbox":
            if(!isDiagramMode()){
                if(visible_locus != null)
                    visible_locus.visible = event.target.checked;  
            }
            else{
                if(normalized_locus_curve != null)
                    normalized_locus_curve.visible = event.target.checked;
            }
            visible_locus_dirty = true;
            break;

        case "unitPlaneVisibleCheckbox":
            if(unit_plane_mesh != null)
                unit_plane_mesh.visible = event.target.checked;
            unit_plane_mesh_dirty = true;
            break;
    }

}

function handleGamutColorChange(event){
    var id = event.target.id;
    pipeds_dirty = true; 
    switch(id)
    {   
        case "colorpick_ciergb":
            ciergbColor = event.target.value;
            break;

        case "colorpick_adobe":
            adobeColor = event.target.value;
            break;
        
        case "colorpick_apple":
            appleColor = event.target.value;
            break; 

        case "colorpick_srgb":
            srgbColor = event.target.value;
            break;

        case "colorpick_xyz":
            xyzColor = event.target.value;
            break;
    }

}

function updateGamutPipeds(XYZToBasis) {
    // Update XYZ Piped
    var mat = new THREE.Matrix3();
    mat.premultiply(XYZToBasis);
    colormath.UpdateParallelipiped(piped_xyz, mat, xyzColor);

    // Update CIERGB Piped
    var mat = CIERGBToXYZ.clone();
    mat.premultiply(XYZToBasis);
    colormath.UpdateParallelipiped(piped_ciergb, mat, ciergbColor)

    // Update Adobe Piped
    var mat = AdobeRGBToXYZ.clone();
    mat.premultiply(XYZToBasis);
    colormath.UpdateParallelipiped(piped_adobe, mat, adobeColor);

    // Update Apple Piped
    var mat = AppleRGBToXYZ.clone();
    mat.premultiply(XYZToBasis);
    colormath.UpdateParallelipiped(piped_apple, mat, appleColor);

    // Update SRGB Piped
    var mat = SRGBToXYZ.clone();
    mat.premultiply(XYZToBasis);
    colormath.UpdateParallelipiped(piped_srgb, mat, srgbColor);
}

function updateVisibleLocus(XYZToBasis)
{
    if(!isDiagramMode()){
        visible_locus.clear();

        for(let lambda = 380; lambda < 750; lambda += 1)
        {
            const v = colormath.EvaluateXYZColorMatchingFunction(lambda);
            v.applyMatrix3(XYZToBasis);
            const l = v.length();
            v.normalize();

            const hex = colormath.GetHexCode(lambda);
            
            visible_locus.add(new THREE.ArrowHelper(v, origin, l*2, hex));
        }
    }
    else{
        normalized_locus_curve.clear();

        for(let lambda = 440; lambda < 650; lambda += 1) {
            const v_plane = colormath.EvaluateXYZColorMatchingFunction(lambda);
            const hex = colormath.GetHexCode(lambda);

            v_plane.applyMatrix3(XYZToBasis);
            const v_plane_mag = v_plane.x + v_plane.y + v_plane.z;
            v_plane.divideScalar(v_plane_mag / plane_dist);
            
            const lambda_sphere_geo = new THREE.SphereGeometry(0.01,8,4);
            const lambda_mat = new THREE.MeshBasicMaterial({color: hex});
            const lambda_sphere = new THREE.Mesh(lambda_sphere_geo, lambda_mat);
            lambda_sphere.translateX(v_plane.x);
            lambda_sphere.translateY(v_plane.y);
            lambda_sphere.translateZ(v_plane.z);
            normalized_locus_curve.add(lambda_sphere);
        }
    }
}

function updateDiagramPlaneVertices(XYZToBasis){
        
    const x_vertex = new THREE.Vector3(plane_dist,0,0);
    const y_vertex = new THREE.Vector3(0,plane_dist,0);
    const z_vertex = new THREE.Vector3(0,0,plane_dist);

    x_vertex.applyMatrix3(XYZToBasis);
    y_vertex.applyMatrix3(XYZToBasis);
    z_vertex.applyMatrix3(XYZToBasis);
    
    const vertices = new Float32Array( [
        x_vertex.x, x_vertex.y, x_vertex.z, // v1
        y_vertex.x, y_vertex.y, y_vertex.z, // v2
        z_vertex.x, z_vertex.y, z_vertex.z // v3
    ] );
    
    unit_plane_geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
}

function updateDiagramPlane(XYZToBasis){
    // updateDiagramPlaneVertices(XYZToBasis);
}

function animate() {
	requestAnimationFrame( animate );

    updateBasisMatrix();

    var XYZToBasis = basisToXYZ.clone();
    XYZToBasis.invert();

    if(pipeds_dirty){
        updateGamutPipeds(XYZToBasis);
        pipeds_dirty = false;
    }
    if(visible_locus_dirty){
        updateVisibleLocus(XYZToBasis);
        visible_locus_dirty = false;
    }
    if(pipeds_dirty){
        updateDiagramPlane(XYZToBasis);
        unit_plane_mesh_dirty = false;
    }

	renderer.render( scene, camera );
}

animate();