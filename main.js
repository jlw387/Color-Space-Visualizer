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

const pipeds = new THREE.Group();

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

// Set starting visibility

piped_ciergb.visible = true;

piped_xyz.visible = false;
piped_adobe.visible = false;
piped_apple.visible = false;
piped_srgb.visible = false;

// Add gamut parallelepipeds to group/scene

pipeds.add(piped_xyz);
pipeds.add(piped_ciergb);
pipeds.add(piped_adobe);
pipeds.add(piped_apple);
pipeds.add(piped_srgb);

scene.add(pipeds);

// Used for reducing unnecessary computation
var gamuts_dirty = true;

// Set up basis changing

var basis_dropdown = document.getElementById("basis_dropdown");
basis_dropdown.addEventListener("change", handleBasisChange);

var oldBasis = basis_dropdown.value;
var newBasis = oldBasis;
var basisToXYZ = CIERGBToXYZ;

var transitioning_color_space = false;
var transition_step = 0;
var transition_duration = 10;

// Set up gamut triangles

const gamut_triangles = new THREE.Group();

const triangle_ciergb = new THREE.Group();
const triangle_adobe = new THREE.Group();
const triangle_apple = new THREE.Group();
const triangle_srgb = new THREE.Group();
const triangle_xyz = new THREE.Group();

const gamutTriangleVertexGeo = new THREE.SphereGeometry(0.02,16,8);
const gamutTriangleLineGeo = new THREE.CylinderGeometry(
    0.0125,    // Radius at the top
    0.0125, // Radius at the bottom
    1,       // Height of the cylinder
    16, // Number of radial segments
  );

// Set starting visibility

triangle_ciergb.visible = true;

triangle_xyz.visible = false;
triangle_adobe.visible = false;
triangle_apple.visible = false;
triangle_srgb.visible = false;

gamut_triangles.visible = false;

// Add gamut triangles to group/scene  

gamut_triangles.add(triangle_ciergb);
gamut_triangles.add(triangle_adobe);
gamut_triangles.add(triangle_apple);
gamut_triangles.add(triangle_srgb);
gamut_triangles.add(triangle_xyz);

scene.add(gamut_triangles);

// 3D Color Viewer

const colorViewerToggleElements = ["3DColor_basis_dropdown", 
                                    "3DColorRCoordinate", 
                                    "3DColorGCoordinate", 
                                    "3DColorBCoordinate", 
                                    "3DColorAxesVisibleCheckbox"];

const colorViewerGroup = new THREE.Group();

const colorViewerSphereGroup = new THREE.Group();

const colorViewerPointGeo = new THREE.SphereGeometry(0.05,32,16);
var colorViewerMaterial = new THREE.MeshBasicMaterial({color: 0x808080});
var colorViewerPointMesh = new THREE.Mesh(colorViewerPointGeo, colorViewerMaterial);

colorViewerPointMesh.translateX(0.5);
colorViewerPointMesh.translateY(0.5);
colorViewerPointMesh.translateZ(0.5);

colorViewerSphereGroup.add(colorViewerPointMesh);

const colorViewerAxesGroup = new THREE.Group();

const rAxisColor = 0xC00000;
const bAxisColor = 0x0000A0;
const gAxisColor = 0x00C000;

var colorViewerRAxis = new THREE.Group();
var colorViewerBAxis = new THREE.Group();
var colorViewerGAxis = new THREE.Group();

colorViewerAxesGroup.add(colorViewerRAxis);
colorViewerAxesGroup.add(colorViewerBAxis);
colorViewerAxesGroup.add(colorViewerGAxis);

colorViewerAxesGroup.visible = false;

colorViewerGroup.add(colorViewerSphereGroup);
colorViewerGroup.add(colorViewerAxesGroup);

colorViewerGroup.visible = false;

scene.add(colorViewerGroup);

var color_viewer_dirty = true;



// Add Visible Locus to Scene

const visible_locus = new THREE.Group();
const normalized_locus_curve = new THREE.Group();

visible_locus.visible = false;
normalized_locus_curve.visible = false;

scene.add(visible_locus);
scene.add(normalized_locus_curve);

var visible_locus_dirty = true;


// Add Unit Triangle

const plane_dist = 1;
const tri_eps = 0.0001; // Prevents z-fighting with larger unit plane

const unit_plane_normal = new THREE.Vector3(1, 1, 1);
unit_plane_normal.normalize();

const unit_triangle_geo = new THREE.BufferGeometry();
const vertices = new Float32Array( [
    plane_dist + tri_eps, 0.0, 0.0, // v1
    0.0, plane_dist + tri_eps, 0.0, // v2
    0.0, 0.0, plane_dist + tri_eps // v3
] );

unit_triangle_geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
const unit_triangle_material = new THREE.MeshBasicMaterial( {color: 0xA0A0A0,
                                                  side: THREE.DoubleSide} );
unit_triangle_material.transparent = true;
unit_triangle_material.opacity = 0.5;

const unit_triangle_mesh = new THREE.Mesh(unit_triangle_geo, unit_triangle_material);

unit_triangle_mesh.visible = false;

scene.add(unit_triangle_mesh);


// Add Unit Plane

const width = 20; // Adjust this to make it sufficiently large
const height = 20; // Adjust this to make it sufficiently large

const unit_plane_geo = new THREE.PlaneGeometry(width, height, 1, 1);

// Set up unit plane material
const unit_plane_material = new THREE.MeshBasicMaterial( {color: 0xA0A0A0,
    side: THREE.DoubleSide} );
unit_plane_material.transparent = true;
unit_plane_material.opacity = 0.5;

// Create plane mesh
const unit_plane_mesh = new THREE.Mesh(unit_plane_geo, unit_plane_material);

// Set the plane's position
unit_plane_mesh.position.set(plane_dist/3, plane_dist/3, plane_dist/3);

// Rotate mesh to correct normal
unit_plane_mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), unit_plane_normal);

unit_plane_mesh.visible = false;

scene.add(unit_plane_mesh);

// Set up opacity sliders

var opacity_sliders = document.querySelectorAll(".opacity-slider");
opacity_sliders.forEach(function(slider){
    slider.addEventListener("input", handleOpacityChange);
});


// Used for reducing unnecessary computation
var unit_meshes_dirty = true;
var diagram_camera_dirty = false;


// Set up visibility checkboxes

var checkboxes = document.querySelectorAll(".visible-checkbox");

checkboxes.forEach(function(checkbox) {
    checkbox.addEventListener("change", handleVisibilityChange);
});


// Set up color basis input

// Get references to the coordinate input elements
const colorBasisInput = document.getElementById("3DColor_basis_dropdown");
colorBasisInput.addEventListener("change", handleColorViewerChange);



// Set up coordinate inputs

// Get references to the coordinate input elements
const rInput = document.getElementById("3DColorRCoordinate");
const gInput = document.getElementById("3DColorGCoordinate");
const bInput = document.getElementById("3DColorBCoordinate");

// Add event listeners for coordinate input value changes
rInput.addEventListener("change", handleColorViewerChange);
gInput.addEventListener("change", handleColorViewerChange);
bInput.addEventListener("change", handleColorViewerChange);



// Set up diagram mode slider

document.getElementById("diagramModeToggle").addEventListener("change", swapDiagramMode);

function updateAxisMeshes(axisGroup, axisDirVec, origin, length, color){
    axisGroup.clear();
    axisGroup.setRotationFromMatrix(new THREE.Matrix4());

    // console.log("Axis Dir:", axisDirVec);
    // console.log("Origin:", origin);
    // console.log("Length:", length);
    // console.log("Color:", color);

    const LINE_WIDTH = 0.03;
    const CONE_START_WIDTH = 0.06;
    const CONE_END_WIDTH = 0;

    const lineGeo = new THREE.CylinderGeometry(LINE_WIDTH, LINE_WIDTH, length*0.8, 16);
    const coneGeo = new THREE.CylinderGeometry(CONE_END_WIDTH, CONE_START_WIDTH, length*0.25, 16);
    
    const axisMaterial = new THREE.MeshBasicMaterial({color: color});

    const lineMesh = new THREE.Mesh(lineGeo, axisMaterial);
    const coneMesh = new THREE.Mesh(coneGeo, axisMaterial);

    lineMesh.translateY(length*0.4);
    coneMesh.translateY(length*0.875);

    axisGroup.add(lineMesh);
    axisGroup.add(coneMesh);

    const rotationAxis = new THREE.Vector3();
    rotationAxis.crossVectors(axisDirVec, new THREE.Vector3(0,1,0));
    rotationAxis.normalize();

    const angle = axisDirVec.angleTo(new THREE.Vector3(0,1,0));
    console.log("Axis Direction:", axisDirVec);
    console.log("Rotation Axis:", rotationAxis);

    axisGroup.rotateOnWorldAxis(rotationAxis, -angle); 

    axisGroup.position.set(origin.x, origin.y, origin.z);
}

function updateGamutTriangle(gamutTriangle, gamutTransformMatrix, color){
    gamutTriangle.clear();
    
    const gamut_mat = new THREE.MeshBasicMaterial({color: color}); 

    // Initialize vectors for the three primaries

    const r = new THREE.Vector3(1,0,0);
    const g = new THREE.Vector3(0,1,0);
    const b = new THREE.Vector3(0,0,1);

    // Compute transformed primary vectors

    r.applyMatrix3(gamutTransformMatrix);
    g.applyMatrix3(gamutTransformMatrix);
    b.applyMatrix3(gamutTransformMatrix);

    // Normalize (L1) transformed primary vectors 

    const r_l1_mag = r.x + r.y + r.z;
    const g_l1_mag = g.x + g.y + g.z;
    const b_l1_mag = b.x + b.y + b.z;

    r.multiplyScalar(1/r_l1_mag);
    g.multiplyScalar(1/g_l1_mag);
    b.multiplyScalar(1/b_l1_mag);


    // Create sphere meshes (gamut triangle vertices)

    const r_sphere_mesh = new THREE.Mesh(gamutTriangleVertexGeo, gamut_mat);
    const g_sphere_mesh = new THREE.Mesh(gamutTriangleVertexGeo, gamut_mat);
    const b_sphere_mesh = new THREE.Mesh(gamutTriangleVertexGeo, gamut_mat);

    r_sphere_mesh.position.set(r.x, r.y, r.z);
    g_sphere_mesh.position.set(g.x, g.y, g.z);
    b_sphere_mesh.position.set(b.x, b.y, b.z);

    // Create cylinder meshes

    const rg_cylinder = new THREE.Mesh(gamutTriangleLineGeo, gamut_mat);
    const gb_cylinder = new THREE.Mesh(gamutTriangleLineGeo, gamut_mat);
    const rb_cylinder = new THREE.Mesh(gamutTriangleLineGeo, gamut_mat);
    
    // Compute parameters for cylinder meshes (gamut triangle lines)

    const rg_midpoint = new THREE.Vector3();
    const gb_midpoint = new THREE.Vector3();
    const rb_midpoint = new THREE.Vector3();

    const rg_dir = new THREE.Vector3();
    const gb_dir = new THREE.Vector3();
    const rb_dir = new THREE.Vector3();

    rg_midpoint.addVectors(r, g).multiplyScalar(0.5);
    rg_dir.subVectors(g, r);

    gb_midpoint.addVectors(g, b).multiplyScalar(0.5);
    gb_dir.subVectors(b, g);

    rb_midpoint.addVectors(r, b).multiplyScalar(0.5);
    rb_dir.subVectors(b, r);

    // Scale Cylinders

    rg_cylinder.scale.set(1, rg_dir.length(), 1);
    gb_cylinder.scale.set(1, gb_dir.length(), 1);
    rb_cylinder.scale.set(1, rb_dir.length(), 1);

    // Normalize direction vectors

    rg_dir.normalize();
    gb_dir.normalize();
    rb_dir.normalize();

    // Orient cylinders

    rg_cylinder.position.copy(rg_midpoint);
    rg_cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), rg_dir);

    gb_cylinder.position.copy(gb_midpoint);
    gb_cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), gb_dir);

    rb_cylinder.position.copy(rb_midpoint);
    rb_cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), rb_dir);

    // Add meshes to gamut

    gamutTriangle.add(r_sphere_mesh);
    gamutTriangle.add(g_sphere_mesh);
    gamutTriangle.add(b_sphere_mesh);

    gamutTriangle.add(rg_cylinder);
    gamutTriangle.add(gb_cylinder);
    gamutTriangle.add(rb_cylinder);
}

function isDiagramMode()
{
    return document.getElementById("diagramModeToggle").checked;
}

function swapToDiagramCamera()
{
    // Store old camera to swap back later
    stored_camera = camera.clone();
    controls.enabled = false;
    diagram_camera_dirty = true;
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

function handleVisibilityChange(event){
    var id = event.target.id;

    switch(id)
    {
        case "xyzVisibleCheckbox":
            if(piped_xyz != null)
                piped_xyz.visible = event.target.checked;
            if(triangle_xyz != null)
                triangle_xyz.visible = event.target.checked;
            gamuts_dirty = true;
            break;

        case "ciergbVisibleCheckbox":
                if(piped_ciergb != null)
                    piped_ciergb.visible = event.target.checked;
                if(triangle_ciergb != null)
                    triangle_ciergb.visible = event.target.checked;
                gamuts_dirty = true;
                break;
        
        case "adobeVisibleCheckbox":
            if(piped_adobe != null)
                piped_adobe.visible = event.target.checked;
            if(triangle_adobe != null)
                triangle_adobe.visible = event.target.checked;
            gamuts_dirty = true;    
            break;
        
        case "appleVisibleCheckbox":
            if(piped_apple != null)
                piped_apple.visible = event.target.checked;
            if(triangle_apple != null)
                triangle_apple.visible = event.target.checked;
            gamuts_dirty = true;
            break;
        
        case "srgbVisibleCheckbox":
            if(piped_srgb != null)
                piped_srgb.visible = event.target.checked;
            if(triangle_srgb != null)
                triangle_srgb.visible = event.target.checked;
            gamuts_dirty = true;
            break;

        case "3DGamutsVisibleCheckbox":
            pipeds.visible = event.target.checked;
            gamuts_dirty = true;
            break;

        case "2DGamutsVisibleCheckbox":
            gamut_triangles.visible = event.target.checked;
            gamuts_dirty = true;
            break;

        case "3DColorVisibleCheckbox":
            for(let i = 0; i < colorViewerToggleElements.length; ++i)
            {
                document.getElementById(colorViewerToggleElements[i]).disabled = !event.target.checked;
            }
            colorViewerGroup.visible = event.target.checked;
            break;

        case "3DColorAxesVisibleCheckbox":
            colorViewerAxesGroup.visible = event.target.checked;
            console.log(colorViewerAxesGroup.visible);
            color_viewer_dirty = true;
            break;
            
        case "spectralLocusVisibleCheckbox":
            if(!isDiagramMode()){
                if(visible_locus != null)
                    visible_locus.visible = event.target.checked;  
            }
            else{
                if(normalized_locus_curve != null)
                    normalized_locus_curve.visible = event.target.checked;
                diagram_camera_dirty = true;
            }
            visible_locus_dirty = true;
            break;

        case "unitTriangleVisibleCheckbox":
            if(unit_triangle_mesh != null)
                unit_triangle_mesh.visible = event.target.checked;
            unit_meshes_dirty = true;
            break;

        case "unitPlaneVisibleCheckbox":
            if(unit_plane_mesh != null)
                unit_plane_mesh.visible = event.target.checked;
            unit_meshes_dirty = true;
            break;
    }

}

function handleOpacityChange(event){
    var id = event.target.id;

    switch(id)
    {
        case "unitTriangleOpacitySlider":
            unit_triangle_material.opacity = event.target.value;
            unit_meshes_dirty;
            break;

        case "unitPlaneOpacitySlider":
            unit_plane_material.opacity = event.target.value;
            unit_meshes_dirty;
            break;
    }
}

function handleGamutColorChange(event){
    var id = event.target.id;
    gamuts_dirty = true;
    color_viewer_dirty = true; 
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

function handleColorViewerChange(event){
    color_viewer_dirty = true; 
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
    

    gamuts_dirty = true;
    color_viewer_dirty = true;
    unit_meshes_dirty = true;
    visible_locus_dirty = true;
    diagram_camera_dirty = true;

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

function updateGamutPipeds(XYZToBasis) {
    // Update XYZ Piped
    var mat = new THREE.Matrix3();
    mat.premultiply(XYZToBasis);
    colormath.UpdateParallelipiped(piped_xyz, mat, xyzColor);

    // Update CIERGB Piped
    var mat = CIERGBToXYZ.clone();
    mat.premultiply(XYZToBasis);
    colormath.UpdateParallelipiped(piped_ciergb, mat, ciergbColor);

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

function updateGamutTriangles(XYZToBasis)
{
    // Update XYZ Piped
    var mat = new THREE.Matrix3();
    mat.premultiply(XYZToBasis);
    updateGamutTriangle(triangle_xyz, mat, xyzColor);

    // Update CIERGB Piped
    var mat = CIERGBToXYZ.clone();
    mat.premultiply(XYZToBasis);
    updateGamutTriangle(triangle_ciergb, mat, ciergbColor);

    // Update Adobe Piped
    var mat = AdobeRGBToXYZ.clone();
    mat.premultiply(XYZToBasis);
    updateGamutTriangle(triangle_adobe, mat, adobeColor);

    // Update Apple Piped
    var mat = AppleRGBToXYZ.clone();
    mat.premultiply(XYZToBasis);
    updateGamutTriangle(triangle_apple, mat, appleColor);

    // Update SRGB Piped
    var mat = SRGBToXYZ.clone();
    mat.premultiply(XYZToBasis);
    updateGamutTriangle(triangle_srgb, mat, srgbColor);
}

function updateColorViewer(XYZToBasis){
    const colorBasis = document.getElementById("3DColor_basis_dropdown").value;

    const r = document.getElementById("3DColorRCoordinate").value;
    const g = document.getElementById("3DColorGCoordinate").value;
    const b = document.getElementById("3DColorBCoordinate").value;

    var colorBasisToXYZMat;

    switch(colorBasis)
    {
        case "ciergb":
            colorBasisToXYZMat = CIERGBToXYZ;
            break;

        case "adobe":
            colorBasisToXYZMat = AdobeRGBToXYZ;
            break;

        case "apple":
            colorBasisToXYZMat = AppleRGBToXYZ;
            break;

        case "srgb":
            colorBasisToXYZMat = SRGBToXYZ;
            break;

        case "xyz":
            colorBasisToXYZMat = new THREE.Matrix3();
            break;
    }

    const rVec = new THREE.Vector3(1,0,0);
    const gVec = new THREE.Vector3(0,1,0);
    const bVec = new THREE.Vector3(0,0,1);

    rVec.applyMatrix3(colorBasisToXYZMat);
    gVec.applyMatrix3(colorBasisToXYZMat);
    bVec.applyMatrix3(colorBasisToXYZMat);

    rVec.applyMatrix3(XYZToBasis);
    gVec.applyMatrix3(XYZToBasis);
    bVec.applyMatrix3(XYZToBasis);

    const origin = new THREE.Vector3(0,0,0);
    
    const lengthV1 = rVec.length();
    const lengthV2 = gVec.length();
    const lengthV3 = bVec.length();

    const dirR = rVec.clone();
    const dirG = gVec.clone();
    const dirB = bVec.clone();

    dirR.normalize();
    dirG.normalize();
    dirB.normalize();


    // Update Color Point
    // console.log(colormath.HexFromRGB(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)).toString(16));

    colorViewerSphereGroup.clear();

    colorViewerMaterial = new THREE.MeshBasicMaterial({color:colormath.HexFromRGB(Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255))});
    colorViewerPointMesh = new THREE.Mesh(colorViewerPointGeo, colorViewerMaterial);

    colorViewerPointMesh.translateOnAxis(dirR, lengthV1 * r);
    colorViewerPointMesh.translateOnAxis(dirB, lengthV3 * b);
    colorViewerPointMesh.translateOnAxis(dirG, lengthV2 * g);

    colorViewerSphereGroup.add(colorViewerPointMesh);

    // Update Axes

    updateAxisMeshes(colorViewerRAxis, dirR, origin, lengthV1  * r, rAxisColor);

    var shifted_origin = origin.addScaledVector(dirR, lengthV1 * r);
    console.log("Shifted Origin R:", shifted_origin);

    updateAxisMeshes(colorViewerBAxis, dirB, shifted_origin.clone(), lengthV3  * b, bAxisColor);

    shifted_origin = shifted_origin.addScaledVector(dirB, lengthV3 * b);
    console.log("Shifted Origin R + B:", shifted_origin);

    updateAxisMeshes(colorViewerGAxis, dirG, shifted_origin.clone(), lengthV2 * g, gAxisColor);
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
            lambda_sphere.position.set(v_plane.x, v_plane.y, v_plane.z);
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
    
    unit_triangle_geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
}

function updateDiagramPlane(XYZToBasis){
    // updateDiagramPlaneVertices(XYZToBasis);
}

function updateDiagramCamera(){

    var x_center = 0.5;
    var y_center = 0.5;
    var base_x_width = 3;
    var base_y_height = 2;

    if(normalized_locus_curve.visible && normalized_locus_curve.children.length > 0){  
        const aabb = new THREE.Box3();
        aabb.setFromObject( normalized_locus_curve );

        console.log("Box Max:", aabb.max);
        console.log("Box Min:", aabb.min);

        console.log("Box Max X: ", aabb.max.x);
        console.log("Box Min X: ", aabb.min.x);
        console.log("Box X Size: ", aabb.max.x - aabb.min.x);

        if(aabb.min.x < 0.5 - base_x_width / 2){
            base_x_width = 3 - (aabb.min.x + 1);
            x_center = (aabb.min.x + 2)/2;
        }

        if(aabb.max.y > 0.5 + base_y_height / 2){
            base_y_height = aabb.max.y + 0.5;
            y_center = (aabb.max.y - 0.5)/2;
        }
    }

    const x_width = Math.max(base_x_width, base_y_height * stored_camera.aspect);
    const y_height = Math.max(base_y_height, base_x_width / stored_camera.aspect);

    console.log("x_center: ", x_center);
    console.log("y_center: ", y_center);
    console.log("x_width: ", x_width);
    console.log("y_height: ", y_height);

    const ortho = new THREE.OrthographicCamera(x_center - x_width/2, x_center + x_width/2,
                                                y_center + y_height/2, y_center - y_height/2, 
                                                1, 20);
    ortho.translateZ(10);
    ortho.lookAt(new THREE.Vector3(0,0,0));

    camera.copy(ortho);

}

function animate() {
	requestAnimationFrame( animate );

    updateBasisMatrix();

    var XYZToBasis = basisToXYZ.clone();
    XYZToBasis.invert();

    if(gamuts_dirty){
        updateGamutPipeds(XYZToBasis);
        updateGamutTriangles(XYZToBasis);
        gamuts_dirty = false;
    }
    if(color_viewer_dirty){
        updateColorViewer(XYZToBasis);
        color_viewer_dirty = false;
    }
    if(visible_locus_dirty){
        updateVisibleLocus(XYZToBasis);
        visible_locus_dirty = false;
    }
    if(unit_meshes_dirty){
        updateDiagramPlane(XYZToBasis);
        unit_meshes_dirty = false;
    }
    if(diagram_camera_dirty && isDiagramMode()){
        updateDiagramCamera();
        diagram_camera_dirty = false;
    }


	renderer.render( scene, camera );
}

animate();