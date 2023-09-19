import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import * as colormath from './colormath.js';

// Basic Rendering Setup

const scene = new THREE.Scene();
const origin = new THREE.Vector3(0,0,0);
const cameraFocus = new THREE.Vector3(0.5,0.5,0.5);
scene.background = new THREE.Color(0x222222);
const camera = new THREE.PerspectiveCamera( 75, 1.5, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
const canvasWidth = Math.min(window.innerWidth, Math.floor(window.innerHeight * 1.5)) / 1.25;
renderer.setSize( canvasWidth, Math.floor(canvasWidth / 1.5) );

const render_element = document.getElementById("renderCanvas");
render_element.appendChild( renderer.domElement );

camera.position.set(2.5,2.5,2.5);
const controls = new OrbitControls( camera, renderer.domElement );
controls.target = cameraFocus;

// Add Axes to scene
const axes = new THREE.AxesHelper(2)
scene.add(axes);

// Common Linear Color Spaces (defined in XYZ coords) (taken from http://www.brucelindbloom.com/Eqn_RGB_XYZ_Matrix.html)

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

const piped_xyz = new THREE.Group();
const piped_adobe = new THREE.Group();
const piped_apple = new THREE.Group();
const piped_srgb = new THREE.Group();

// Create default color space colors

var xyzColor = 0xffffff;
var adobeColor = 0xff00ff;
var appleColor = 0xffff00;
var srgbColor = 0x808080;

colormath.UpdateParallelipiped(piped_xyz, new THREE.Matrix3(), xyzColor);
colormath.UpdateParallelipiped(piped_adobe, AdobeRGBToXYZ, adobeColor);
colormath.UpdateParallelipiped(piped_apple, AppleRGBToXYZ, appleColor);
colormath.UpdateParallelipiped(piped_srgb, SRGBToXYZ, srgbColor);

// Set starting Visibility

piped_srgb.visible = true;

piped_xyz.visible = false;
piped_adobe.visible = false;
piped_apple.visible = false;

// Add gamut parallelepipeds to Scene

scene.add(piped_xyz);
scene.add(piped_adobe);
scene.add(piped_apple);
scene.add(piped_srgb);

// Add Chromaticity Diagram Plane

const plane_dist = 1;

const cp_geo = new THREE.BufferGeometry();
const vertices = new Float32Array( [
    plane_dist, 0.0, 0.0, // v1
    0.0, plane_dist, 0.0, // v2
    0.0, 0.0, plane_dist // v3
] );

cp_geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
const cp_alpha_texture = new THREE.TextureLoader().load( "ChromaticityPlaneAlphaTexture.png" );
const cp_material = new THREE.MeshBasicMaterial( {alphaMap: cp_alpha_texture, 
                                                  color: 0xA0A0A0,
                                                  side: THREE.DoubleSide} );
cp_material.transparent = true;
const cp_mesh = new THREE.Mesh(cp_geo, cp_material);

cp_mesh.visible = false;

scene.add(cp_mesh);

// Add Visible Locus to Scene

const visible_locus = new THREE.Group();
var normalized_visible_vectors = [];

for(let lambda = 380; lambda < 750; lambda += 1)
{
    const v = colormath.EvaluateXYZColorMatchingFunction(lambda);
    const l = v.length();
    v.normalize();
    
    if(lambda >= 440) {
        const v_plane_mag = v.x + v.y + v.z;
        const v_plane = v.clone();
        v_plane.divideScalar(v_plane_mag);
        normalized_visible_vectors.push(v_plane);
    }
    
    const hex = colormath.GetHexCode(lambda);

    visible_locus.add(new THREE.ArrowHelper(v, origin, l*2, hex));
}

visible_locus.visible = false;

scene.add(visible_locus);

var normalized_locus_curve = new THREE.CatmullRomCurve3(normalized_visible_vectors);
var nlc_points = normalized_locus_curve.getPoints(740); // 650
var nlc_geo = new THREE.BufferGeometry().setFromPoints(nlc_points);

const nlc_material = new THREE.LineBasicMaterial({color: 0x000000});
const nlc_object = new THREE.Line(nlc_geo, nlc_material);

nlc_object.visible = false;

scene.add(nlc_object);

// Set up basis changing

var basis_dropdown = document.getElementById("basis_dropdown");
basis_dropdown.addEventListener("change", handleBasisChange);

var oldBasis = basis_dropdown.value;
var newBasis = oldBasis;
var basisToXYZ = SRGBToXYZ;

var transitioning = false;
var transition_step = 0;
var transition_duration = 10;


// Set up gamut visibility checkboxes

var checkboxes = document.querySelectorAll(".visible-checkbox");

checkboxes.forEach(function(checkbox) {
    checkbox.addEventListener("change", handleGamutVisibilityChange);
});


function handleBasisChange(){
    if(basis_dropdown.value == oldBasis) 
        return;
    
    newBasis = basis_dropdown.value;

    transitioning = true;
}

function getBasisMatrix(basis)
{
    switch(basis)
    {
        case 'xyz':
            return new THREE.Matrix3();

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
    if(!transitioning)
    {
        return basisToXYZ;
    }
    
    transition_step += 1;
    console.log(transition_step);
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
        transitioning = false;
        transition_step = 0;
        oldBasis = newBasis;
        basisToXYZ = getBasisMatrix(newBasis);
    }
    
}

function handleGamutVisibilityChange(event){
    var id = event.target.id;

    switch(id)
    {
        case "xyzVisibleCheckbox":
            if(piped_xyz != null)
                piped_xyz.visible = event.target.checked;
            
            break;
        
        case "adobeVisibleCheckbox":
            if(piped_adobe != null)
                piped_adobe.visible = event.target.checked;
            
            break;
        
        case "appleVisibleCheckbox":
            if(piped_apple != null)
                piped_apple.visible = event.target.checked;
            
            break;
        
        case "srgbVisibleCheckbox":
            if(piped_srgb != null)
                piped_srgb.visible = event.target.checked;
            
            break;
        
        case "spectralLocusVisibleCheckbox":
            if(visible_locus != null)
                visible_locus.visible = event.target.checked;
            
            break;
    }

}

function updateGamutPipeds(XYZToBasis) {
    // Update XYZ Piped
    var mat = new THREE.Matrix3();
    mat.premultiply(XYZToBasis);
    colormath.UpdateParallelipiped(piped_xyz, mat, xyzColor);

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
    visible_locus.clear();
    normalized_visible_vectors = [];

    for(let lambda = 380; lambda < 750; lambda += 1)
    {
        const v = colormath.EvaluateXYZColorMatchingFunction(lambda);
        const v_plane = v.clone();
        v.applyMatrix3(XYZToBasis);
        const l = v.length();
        v.normalize();

        if(lambda >= 440) {
            const v_plane_mag = v_plane.x + v_plane.y + v_plane.z;
            v_plane.divideScalar(v_plane_mag / plane_dist);
            v_plane.applyMatrix3(XYZToBasis);
            normalized_visible_vectors.push(v_plane);
        }

        const hex = colormath.GetHexCode(lambda);
        
        visible_locus.add(new THREE.ArrowHelper(v, origin, l*2, hex));
    }

    normalized_locus_curve = new THREE.CatmullRomCurve3(normalized_visible_vectors);
    nlc_points = normalized_locus_curve.getPoints(740); // 650 
    nlc_geo = new THREE.BufferGeometry().setFromPoints(nlc_points);

    nlc_object.geometry = nlc_geo;
}

function updateChromaticityPlaneVertices(XYZToBasis){
        
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
    
    cp_geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
}

function updateChromaticityPlane(XYZToBasis){
    updateChromaticityPlaneVertices(XYZToBasis);
}

function animate() {
	requestAnimationFrame( animate );

    updateBasisMatrix();

    var XYZToBasis = basisToXYZ.clone();
    XYZToBasis.invert();

    updateGamutPipeds(XYZToBasis);
    updateVisibleLocus(XYZToBasis);
    updateChromaticityPlane(XYZToBasis);

	renderer.render( scene, camera );
}

animate();