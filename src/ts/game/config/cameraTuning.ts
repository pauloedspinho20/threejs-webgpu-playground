/**
 * Live-tunable camera / arm knobs for the demo character and vehicles. Read
 * every frame by Character/Vehicle and bound to the debug GUI so the aim pose
 * and camera offsets can be dialled in during a playtest. This is demo tuning
 * only — not engine state.
 */
export const cameraTuning = {
	// On-foot aim camera (offsets from the head bone world position)
	shoulderHeadHeight: 0.55, // over-shoulder: orbit-centre height above the head
	fpEyeRaise: 0.05,         // first-person: eye height above the head bone
	fpEyeForward: 0.0,        // first-person: nudge toward the face (along the look)

	// Arm aim (world-space): the arm bones point their length axis along the aim
	// direction, tilted down and splayed apart, so the hands reach forward.
	armDownTilt: 0.35,        // how much the reach tilts below the look direction
	armSplay: 0.22,           // how far the two hands splay apart (horizontal)
	forearmBend: 0.18,        // forearm lifted back up from the upper-arm line
	armRecoil: 0.5,           // downward arm dip at full recoil

	// Vehicle front-mounted camera
	vehicleFrontDistance: 3.2,
	vehicleFrontHeight: 1.1,
};
