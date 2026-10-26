# Training photo edits

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
