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

	// First-person / over-shoulder arm aim pose (radians; left mirrors Z)
	armUpperX: -0.15,
	armUpperZ: 0.28,
	armLowerX: -0.35,
	armLowerZ: 0.12,
	armRecoil: 0.6,           // extra upper-arm kick at full recoil

	// Vehicle front-mounted camera
	vehicleFrontDistance: 3.2,
	vehicleFrontHeight: 1.1,
};
