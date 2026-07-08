import * as THREE from 'three';
import {
	Fn, float, vec2, vec3, mat2, uniform,
	positionWorld, cameraPosition, screenSize,
	mix, clamp, pow, abs, sin, cos, fract, floor,
	dot, normalize, reflect, max, smoothstep, length,
	Loop, If
} from 'three/tsl';

import { World } from './World';
import { IUpdatable } from '../interfaces/IUpdatable';

// Sea constants (from the original Seascape GLSL shader)
const NUM_STEPS = 8;
const ITER_GEOMETRY = 3;
const ITER_FRAGMENT = 5;
const SEA_HEIGHT = 0.6;
const SEA_CHOPPY = 1.0;
const SEA_SPEED = 1.0;
const SEA_FREQ = 0.16;

/**
 * Faithful TSL port of the raymarched "Seascape" ocean shader.
 * Original by Jonathan Blaire / Alexander Alekseev, adapted for Sketchbook.
 */
export class Ocean implements IUpdatable
{
	public updateOrder: number = 10;
	public material: THREE.MeshBasicNodeMaterial;

	private world: World;
	private uTime: unknown;
	private lightDir: unknown;

	constructor(object: unknown, world: World)
	{
		this.world = world;

		this.uTime = uniform(0.1);
		this.lightDir = uniform(new THREE.Vector3());

		const uTime = this.uTime;
		const lightDir = this.lightDir;

		const SEA_BASE = vec3(0.1, 0.19, 0.22);
		const SEA_WATER_COLOR = vec3(0.8, 0.9, 0.6);
		// mat2(1.6,1.2,-1.2,1.6) applied as `uv * m` (row vector) == transpose(m) * uv
		const octave_m = mat2(1.6, -1.2, 1.2, 1.6);

		const hash = Fn(([p]: unknown[]) => {
			const h = dot(p, vec2(127.1, 311.7));
			return fract(sin(h).mul(43758.5453123));
		});

		const noise = Fn(([p]: unknown[]) => {
			const i = floor(p);
			const f = fract(p);
			const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
			const a = hash(i.add(vec2(0.0, 0.0)));
			const b = hash(i.add(vec2(1.0, 0.0)));
			const c = hash(i.add(vec2(0.0, 1.0)));
			const d = hash(i.add(vec2(1.0, 1.0)));
			const res = mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
			return float(-1.0).add(res.mul(2.0));
		});

		const diffuse = Fn(([n, l, p]: unknown[]) => {
			return pow(dot(n, l).mul(0.4).add(0.6), p);
		});

		const specular = Fn(([n, l, e, s]: unknown[]) => {
			const nrm = s.add(8.0).div(3.1415 * 8.0);
			return pow(max(dot(reflect(e, n), l), 0.0), s).mul(nrm);
		});

		const getSkyColor = Fn(([e]: unknown[]) => {
			const ey = max(e.y, 0.0);
			return vec3(
				pow(float(1.0).sub(ey), 2.0),
				float(1.0).sub(ey),
				float(0.6).add(float(1.0).sub(ey).mul(0.4))
			);
		});

		const sea_octave = Fn(([uvIn, choppy]: unknown[]) => {
			const uv = uvIn.add(noise(uvIn));
			const wv = float(1.0).sub(abs(sin(uv))).toVar();
			const swv = abs(cos(uv));
			wv.assign(mix(wv, swv, wv));
			return pow(float(1.0).sub(pow(wv.x.mul(wv.y), 0.65)), choppy);
		});

		// map() and map_detailed() differ only in iteration count.
		const makeMap = (iterations: number) => Fn(([p]: unknown[]) => {
			const freq = float(SEA_FREQ).toVar();
			const amp = float(SEA_HEIGHT).toVar();
			const choppy = float(SEA_CHOPPY).toVar();
			const uv = vec2(p.x.mul(0.75), p.z).toVar();
			const SEA_TIME = uTime.mul(SEA_SPEED);
			const h = float(0.0).toVar();
			Loop(iterations, () => {
				const d1 = sea_octave(uv.add(SEA_TIME).mul(freq), choppy);
				const d2 = sea_octave(uv.sub(SEA_TIME).mul(freq), choppy);
				h.addAssign(d1.add(d2).mul(amp));
				uv.assign(octave_m.mul(uv));
				freq.mulAssign(1.9);
				amp.mulAssign(0.22);
				choppy.assign(mix(choppy, 1.0, 0.2));
			});
			return p.y.sub(h);
		});

		const map = makeMap(ITER_GEOMETRY);
		const map_detailed = makeMap(ITER_FRAGMENT);

		const getSeaColor = Fn(([p, n, l, eye, dist]: unknown[]) => {
			const fresnel = clamp(float(1.0).sub(max(dot(n, eye.negate()), 0.0)), 0.0, 1.0);
			const fres = pow(fresnel, 3.0).mul(0.65);

			const reflected = getSkyColor(reflect(eye, n));
			const refracted = SEA_BASE.add(diffuse(n, l, float(80.0)).mul(SEA_WATER_COLOR).mul(0.12));

			const color = mix(refracted, reflected, fres).toVar();

			const atten = max(float(1.0).sub(dot(dist, dist).mul(0.001)), 0.0);
			color.addAssign(SEA_WATER_COLOR.mul(p.y.sub(SEA_HEIGHT)).mul(0.18).mul(atten));

			const night = clamp(dot(l, vec3(0.0, 1.0, 0.0)).add(0.1), 0.0, 0.5).mul(2.0);
			color.mulAssign(vec3(night));

			color.addAssign(vec3(specular(n, l, eye, float(60.0))));

			return color;
		});

		const getNormal = Fn(([p, eps]: unknown[]) => {
			const ny = map_detailed(p);
			const nx = map_detailed(vec3(p.x.add(eps), p.y, p.z)).sub(ny);
			const nz = map_detailed(vec3(p.x, p.y, p.z.add(eps))).sub(ny);
			return normalize(vec3(nx, eps, nz));
		});

		// Returns the hit point p (the original returns t via an out param).
		const heightMapTracing = Fn(([ori, dir]: unknown[]) => {
			const oriComp = vec3(ori.x, ori.y.sub(positionWorld.y.sub(SEA_HEIGHT)), ori.z);
			const p = vec3(0.0).toVar();
			const tm = float(0.0).toVar();
			const tx = float(1000.0).toVar();
			const hx = map(oriComp.add(dir.mul(tx))).toVar();
			const hm = map(oriComp.add(dir.mul(tm))).toVar();
			const tmid = float(0.0).toVar();

			If(hx.greaterThan(0.0), () => {
				p.assign(oriComp.add(dir.mul(tx)));
			}).Else(() => {
				Loop(NUM_STEPS, () => {
					tmid.assign(mix(tm, tx, hm.div(hm.sub(hx))));
					p.assign(oriComp.add(dir.mul(tmid)));
					const hmid = map(p);
					If(hmid.lessThan(0.0), () => {
						tx.assign(tmid);
						hx.assign(hmid);
					}).Else(() => {
						tm.assign(tmid);
						hm.assign(hmid);
					});
				});
			});

			return p;
		});

		const oceanColor = Fn(() => {
			const dir = normalize(positionWorld.sub(cameraPosition));
			const p = heightMapTracing(cameraPosition, dir);
			const dist = positionWorld.sub(cameraPosition);
			const EPSILON_NRM = float(0.1).div(screenSize.x);
			const n = getNormal(p, dot(dist, dist).mul(EPSILON_NRM));

			const color = mix(
				getSkyColor(dir),
				getSeaColor(p, n, lightDir, dir, dist),
				pow(smoothstep(0.0, -0.05, dir.y), 0.3)
			);

			return pow(color, vec3(0.8)).mul(1.2);
		});

		const oceanOpacity = Fn(() => {
			const dist = positionWorld.sub(cameraPosition);
			const fogfac = clamp(length(dist), 300.0, 600.0).sub(300.0).div(300.0);
			return float(1.0).sub(fogfac);
		});

		this.material = new THREE.MeshBasicNodeMaterial();
		this.material.colorNode = oceanColor();
		this.material.opacityNode = oceanOpacity();
		this.material.transparent = true;

		object.material = this.material;
	}

	public update(timeStep: number): void
	{
		this.uTime.value += timeStep;
		this.lightDir.value.copy(this.world.sky.sunPosition).normalize();
	}
}
