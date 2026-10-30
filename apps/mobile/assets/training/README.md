# Training photo edits

## Get the owner talking: active recording

`lesson-4-recording-v1.jpg` is an AI-generated edit of `lesson-4.jpg`, made with the built-in `image_gen` tool using `precise-object-edit`. The phone now shows a live preview of the barber, a red recording indicator and timer, and a stop control. The original asset is retained.

The generated image was 1402 × 1122 pixels and was encoded as JPEG at quality 90 for mobile delivery. The compact banner keeps `{ x: 0.5, y: 0.25 }` so the barber's face and active phone screen remain visible.

Final prompt:

```text
Use case: precise-object-edit.
Edit target: the supplied "Get the owner talking" training photo, not a new scene.
Primary request: change ONLY the black, unlit smartphone display held upright by the field agent on the right. Make the phone visibly on and actively recording the barber on the left. Show a believable bright live camera preview of that same barber leaning on the chair and gesturing, a small red recording indicator with elapsed timer "00:18" near the top of the screen, and a red square stop control near the bottom. Keep the existing phone size and perspective; the recording interface must fit inside its screen glass, with natural daylight reflections, and be legible as an active screen even when viewed in a small mobile banner.
Preserve the rest of the photograph: the exact two people, their facial identities, hair, clothing, barber's towel, hands/fingers, gestures, phone orientation and grip, chair, mirrors, fan, barbershop interior, daylight, camera angle, positions and composition. Change only the phone's visible screen; preserve hand occlusion. No extra hands/fingers or phones, no altered faces, no new foreground objects, no captions/logos/watermarks and no glow outside the phone.
Photorealistic and natural. Keep the same 5:4 landscape composition and framing, approximately 1400 by 1120 pixels. Do not crop or expand the scene. Opaque background.
```

## Clear audio: phone recording

`lesson-2-recording-v1.jpg` is an AI-generated edit of `lesson-2.jpg`, made with the built-in `image_gen` tool using `precise-object-edit`. The edit turns the blank phone display into a live recording preview with a red timer and stop control. It keeps the original scene and subject arrangement. The original asset is retained.

The generated image was 1402 × 1122 pixels. The mobile asset uses those dimensions and was encoded as JPEG at quality 90 for delivery. The existing banner crop position remains `{ x: 0.5, y: 0.28 }`.

Final prompt:

```text
Use case: precise-object-edit.
Edit target: the supplied training photo, not a new scene.
Primary request: turn on ONLY the black smartphone display held upright by the man on the right. The screen must visibly show an active video recording of the mechanic standing on the left: a small believable live camera preview of that same mechanic and workshop, a bright red recording indicator with elapsed timer "00:12", and a red square stop control near the bottom of the screen. Make the screen clearly illuminated and the recording status immediately recognizable at small banner size. Fit the interface inside the existing screen glass with the correct perspective and natural daylight reflections.
Preserve the original photograph precisely: same two people, faces, hair, clothes, pose, hands/fingers, phone body/size/orientation, wristwatch, mechanic's cloth, raised car, tools, garage, lighting, viewpoint, composition and framing. Change only the visible phone screen; preserve finger occlusion at its edge. No additional devices, no new hands, no extra fingers, no caption, no watermark, no glow outside the phone. Photorealistic and unobtrusive.
Keep the original 1120 by 896 landscape composition and 5:4 aspect ratio; do not crop or expand the scene. Opaque background.
```

## Good lighting: window-facing setup

`lesson-1-lighting-v1.jpg` is an AI-generated replacement made with the built-in `image_gen` tool. `lesson-1.jpg` provided the people, clothing and salon reference. The new composition shows the owner facing soft window light, with the agent near the window photographing her at eye level. It demonstrates the lesson instead of showing both people reviewing a phone. The original asset is retained.

The generated image was 1402 × 1122 pixels and was encoded as JPEG at quality 90 for mobile delivery. The compact banner uses `{ x: 0.5, y: 0.15 }` to keep the owner's complete head, phone and window visible.

Final prompt:

```text
Use case: precise-object-edit.
Asset type: a small photographic banner for a mobile field-agent training lesson called "Good lighting".
Input image role: reference for the identities of the Filipina salon owner (floral shirt, black apron) and younger female field agent (navy shirt), their clothing, and the everyday Philippine salon setting. Recompose their actions to demonstrate good face lighting; do not keep their original phone-reviewing pose.
Primary request: create a natural, photorealistic training photo in the same salon. A broad window is clearly visible along the LEFT edge of the scene. The owner stands just inside, facing toward that window and toward the agent's phone, so soft daylight illuminates the FRONT of her face and both eyes are clearly visible. The agent stands close to the window, between the owner and the incoming light but slightly to one side so she does not block it. Seen from an unobtrusive side viewpoint, she holds her phone upright at the owner's eye level and frames the owner. The phone is on and has a believable small camera preview. The viewer can understand the window–agent–owner positions at a glance.
Composition: LANDSCAPE 5:4, approximately 1400 by 1120 pixels, with a wider view of the same people. This image will fill a shallow 190-point-high landscape banner on a phone. Keep the owner's COMPLETE head and shoulders and the window/light direction within the upper-middle central band of the image. Leave breathing room above her hair; no head cutoffs. Show the owner in a slight three-quarter view, calm and comfortable. The background behind her is an ordinary darker salon wall or shelving, not a bright window. Agent can be partly foreground, but must not obscure the owner's face.
Lighting: real soft window daylight from in FRONT of the owner, evenly readable face, no harsh shadows, no squinting, no dramatic artificial beams. Natural candid documentary photography, realistic skin and hands.
Avoid: bright windows BEHIND the owner, a silhouette or backlit face, both people looking down together at a phone, blank/off phone screen, extra people/limbs/fingers, captions, text labels, arrows, diagrams, split panels, logos or watermarks. Opaque background.
```
