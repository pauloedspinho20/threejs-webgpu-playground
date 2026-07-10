import * as THREE from "three";
import * as CANNON from "cannon-es";
import * as Utils from "../../FunctionLibrary";
import { ICollider } from "../../interfaces/ICollider";
import { Object3D } from "three";
import { threeToCannon, ShapeType } from "three-to-cannon";

export class TrimeshCollider implements ICollider {
  public mesh: THREE.Mesh;
  public options: Record<string, any>;
  public body: CANNON.Body;
  public debugModel: unknown;

  constructor(mesh: Object3D, options: Record<string, any>) {
    this.mesh = mesh.clone() as THREE.Mesh;

    // Bake world transform into geometry
    let geometry = this.mesh.geometry.clone();
    
    // three-to-cannon naively assumes geometry is non-indexed, so we must unroll it
    if (geometry.index) {
        geometry = geometry.toNonIndexed();
    }
    
    geometry.applyMatrix4(mesh.matrixWorld);
    this.mesh.geometry = geometry;

    const defaults = {
      mass: 0,
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Quaternion(0, 0, 0, 1),
      friction: 0.3,
    };
    options = Utils.setDefaults(options, defaults);
    this.options = options;

    const mat = new CANNON.Material("triMat");
    mat.friction = options.friction;
    // mat.restitution = 0.7;

    const result = threeToCannon(this.mesh, { type: ShapeType.MESH });
    if (!result) {
      console.warn(`Could not generate CANNON.Shape for mesh:`, mesh);
      return;
    }
    const shape = result.shape as CANNON.Shape;
    // shape['material'] = mat;

    // Add phys shape with offset and orientation if provided by threeToCannon
    const physBox = new CANNON.Body({
      mass: options.mass as number,
      position: Utils.cannonVector(options.position as THREE.Vector3),
      quaternion: Utils.cannonQuat(options.rotation as THREE.Quaternion),
    });

    physBox.addShape(shape, result.offset, result.orientation);

    physBox.material = mat;

    this.body = physBox;
  }
}
