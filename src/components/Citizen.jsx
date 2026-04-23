import { useRef } from "react"
import { useLayoutEffect } from "react"
import { InstancedMesh } from "three"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { Color } from "three"
const ROADS = [-27, -15, 0, 15, 27]

function randomRoad() {
    return ROADS[Math.floor(Math.random() * ROADS.length)]
}
function randomColor() {
    return new Color(Math.random(), Math.random(), Math.random())
}
const dummy = new THREE.Object3D();
export default function Citizen() {
    const instanceHead = useRef(null);
    const instanceBody = useRef(null);
    
    const citizens = useRef([])

    
    useLayoutEffect(() => {
        citizens.current = Array.from({ length: 25 }, () => 
        ({
            x: randomRoad(),
            z: randomRoad(),
            tx: randomRoad(),
            tz: randomRoad(),
            speed: 0.1 + Math.random() * 0.1,
            angle: 0,
        }));
    }, [])

    useLayoutEffect(() => {
        
        if (!instanceHead.current || !instanceBody.current) return;
        
        for (let i = 0; i < citizens.current.length; i++) {

            instanceHead.current.setColorAt(i, randomColor());
            instanceBody.current.setColorAt(i, randomColor());
        }
        instanceHead.current.instanceColor.needsUpdate = true;
        instanceBody.current.instanceColor.needsUpdate = true;
    }, [])

    useFrame(() => {
        console.log('frame running, citizens:', citizens.current.length);
        for (let i = 0; i < citizens.current.length; i++) {
           
            const citizen = citizens.current[i];
            citizen.x += Math.cos(citizen.angle) * citizen.speed
            citizen.z += Math.sin(citizen.angle) * citizen.speed

            const distance = Math.sqrt((citizen.x - citizen.tx) ** 2 + (citizen.z - citizen.tz) ** 2)
            if (distance < 1) {
                citizen.tx = randomRoad();
                citizen.tz = randomRoad();
                citizen.angle = Math.atan2(citizen.z - citizen.tz, citizen.x - citizen.tx);
            }
            else{
                citizen.angle = Math.atan2(citizen.tz - citizen.z, citizen.tx - citizen.x);
            }
            dummy.position.set(citizen.x, 0.6, citizen.z);
            dummy.lookAt(new THREE.Vector3(citizen.tx, 0.6, citizen.tz));
            dummy.updateMatrix()
            instanceBody.current.setMatrixAt(i, dummy.matrix);
            
            dummy.position.set(citizen.x, 1.25, citizen.z);
            dummy.lookAt(new THREE.Vector3(citizen.tx, 1.25, citizen.tz));
            dummy.updateMatrix()
            
            instanceHead.current.setMatrixAt(i, dummy.matrix);
            
        }
        instanceHead.current.instanceMatrix.needsUpdate = true;
        instanceBody.current.instanceMatrix.needsUpdate = true;
    })

    

    return (
        
        <group>
            <instancedMesh ref={instanceHead} args={[undefined, undefined, 25]}>
                <boxGeometry args={[0.38, 0.38, 0.38]} />
                <meshStandardMaterial color="white" />
            </instancedMesh>
            <instancedMesh ref={instanceBody} args={[undefined, undefined, 25]}>
                <boxGeometry args={[0.5, 0.8, 0.5]} />
                <meshStandardMaterial color="white" />
            </instancedMesh>
        </group>
    )
}