import * as THREE from 'three';

export function UpdateParallelipiped(piped, mat, hex)
{
    if(piped == null)
    {
        piped = new THREE.Group();
    }
    piped.clear();

    const r = new THREE.Vector3(1,0,0);
    const g = new THREE.Vector3(0,1,0);
    const b = new THREE.Vector3(0,0,1);

    r.applyMatrix3(mat);
    g.applyMatrix3(mat);
    b.applyMatrix3(mat);

    const origin = new THREE.Vector3(0,0,0);
    
    const lengthV1 = r.length();
    const lengthV2 = g.length();
    const lengthV3 = b.length();

    const dirR = r.clone();
    const dirG = g.clone();
    const dirB = b.clone();

    dirR.normalize();
    dirG.normalize();
    dirB.normalize();

    const arrowR = new THREE.ArrowHelper(dirR, origin, lengthV1, hex);
    const arrowG = new THREE.ArrowHelper(dirG, origin, lengthV2, hex);
    const arrowB = new THREE.ArrowHelper(dirB, origin, lengthV3, hex);

    const arrowRG = new THREE.ArrowHelper(dirG, r, lengthV2, hex);
    const arrowRB = new THREE.ArrowHelper(dirB, r, lengthV3, hex);

    const arrowGR = new THREE.ArrowHelper(dirR, g, lengthV1, hex);
    const arrowGB = new THREE.ArrowHelper(dirB, g, lengthV3, hex);

    const arrowBR = new THREE.ArrowHelper(dirR, b, lengthV1, hex);
    const arrowBG = new THREE.ArrowHelper(dirG, b, lengthV2, hex);

    const rg = origin.clone();
    const rb = origin.clone();
    const gb = origin.clone();

    rg.addVectors(r, g);
    rb.addVectors(r, b);
    gb.addVectors(g, b);

    const arrowRGB = new THREE.ArrowHelper(dirB, rg, lengthV3, hex);
    const arrowRBG = new THREE.ArrowHelper(dirG, rb, lengthV2, hex);
    const arrowGBR = new THREE.ArrowHelper(dirR, gb, lengthV1, hex);

    piped.add(arrowR);
    piped.add(arrowG);
    piped.add(arrowB);

    piped.add(arrowRG);
    piped.add(arrowRB);

    piped.add(arrowGR);
    piped.add(arrowGB);

    piped.add(arrowBR);
    piped.add(arrowBG);

    piped.add(arrowRGB);
    piped.add(arrowRBG);
    piped.add(arrowGBR);
}

// Implemented with piece-wise gaussians based on Wyman, Sloan, and Shirley's 
// paper: "Simple Analytic Approximations to the CIE XYZ Color Matching Functions"
// (Journal of Computer Graphics Techniques, 2013)
export function EvaluateXYZColorMatchingFunction(lambda)
{
    const x1 = (lambda - 442.0) * ((lambda < 442.0) ? 0.0624 : 0.0374);
    const x2 = (lambda - 599.8) * ((lambda < 599.8) ? 0.0264 : 0.0323);
    const x3 = (lambda - 501.1) * ((lambda < 501.1) ? 0.0490 : 0.0382);

    const x = 0.362 * Math.exp(-0.5 * x1 * x1) + 1.056 * Math.exp(-0.5 * x2 * x2)
                                               - 0.065 * Math.exp(-0.5 * x3 * x3);
                                               
    const y1 = (lambda - 568.8) * ((lambda < 568.8) ? 0.0213 : 0.0247);
    const y2 = (lambda - 530.9) * ((lambda < 530.9) ? 0.0613 : 0.0322);

    const y = 0.821 * Math.exp(-0.5 * y1 * y1) + 0.286 * Math.exp(-0.5 * y2 * y2); 

    const z1 = (lambda - 437.0) * ((lambda < 437.0) ? 0.0845 : 0.0278);
    const z2 = (lambda - 459.0) * ((lambda < 459.0) ? 0.0385 : 0.0725);

    const z = 1.217 * Math.exp(-0.5 * z1 * z1) + 0.681 * Math.exp(-0.5 * z2 * z2);  
    
    return new THREE.Vector3(x,y,z);
}

function HexFromRGB(r, g, b)
{
    return (r << 16) + (g << 8) + (b);
}

export function GetHexCode(lambda)
{
    if(lambda >= 580)
    {
        const t = lambda > 650 ? 1 : (lambda - 580) / 70;
        //console.log(lambda, t);
        return HexFromRGB(255, Math.floor((1 - t) * 255), 0);
    }
    else if(lambda >= 530)
    {
        const t = (lambda - 530) / 50;
        //console.log(lambda, t);
        return HexFromRGB(Math.floor(t * 255), 255, 0);
    }
    else if(lambda >= 490)
    {
        const t = (lambda - 490) / 40;
        //console.log(lambda, t);
        return HexFromRGB(0, 255, Math.floor((1 - t) * 255));
    }
    else if(lambda >= 450)
    {
        const t = (lambda - 450) / 40;
        //console.log(lambda, t);
        return HexFromRGB(0, Math.floor(t * 255), 255);
    }
    else
    {
        const t = lambda <= 380 ? 0 : (lambda - 380) / 70;
        //console.log(lambda, t);
        return HexFromRGB(Math.floor((1 - t) * 64), 0, 255);
    }

    // if(lambda >= 700)
    // {
    //     return 0xffffff;
    // }
    // else if(lambda <= 380)
    // {
    //     return 0;
    // }
    // else
    // {
    //     const t = (lambda - 380) / 320.0;
    //     const val = Math.floor(t * 255);
    //     console.log(lambda, t, val << 16, val << 8, val, (val << 16) + (val << 8) + val, (val << 16 + val << 8 + val).toString(16));
    //     return (val << 16) + (val << 8) + val;
    // }

}

export function Sigmoid(t, k)
{
    return 1/(1 + Math.pow((1 / t - 1), k));
}