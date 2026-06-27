<div align="center">
  <img src="./assets/film-space-logo.png" alt="Film space" width="500" style="margin-bottom: 50px;"/>
</div>

**3D camera motion capture with iPhone ARKit for AI style transfer**

Film space is built for AI video workflows. Block a scene in 3D, then walk through it with your phone in Camera mode to perform real-world camera motion. Record that footage and bring it into a tool like Seedance 2.0 — the recording gives the model a clear reference for your blocking and camera path, so you can map the motion you performed in real life onto a stylized or generated output.

<div align="center">
  <img src="./assets/film-space-demo.gif" alt="Film space — real-world camera motion mapped to a virtual scene and AI style transfer" width="618"/>
</div>

Under the hood it's a lightweight virtual studio: grid floor, human stand-ins, lens presets, and on-device recording to your photo library.

---

## What Film space Does

Film space gives you a lightweight staging environment for blocking and camera exploration:

- **AI style transfer workflow** — Record your scene here, then use that clip as a motion/camera reference in tools like Seedance 2.0 to apply a new look while preserving the path you walked in real life.
- **Virtual studio** — A 3D space with a checkerboard floor, grid, and axis guides so you can orient subjects and camera positions.
- **Human stand-ins** — Add, select, rotate, and reposition figure placeholders to block talent in the scene.
- **Edit mode** — Orbit around the studio, zoom in and out, and arrange your blocking from a bird's-eye or close-up view.
- **Camera mode** — Carry your phone through the scene. Physical movement translates into camera movement; tilt and turn to look around, as if you're operating a real camera on set.
- **Lens simulation** — Cycle through 35mm, 50mm, 75mm, and 200mm focal lengths to preview different fields of view.
- **Recording** — Capture the rendered scene (with microphone audio) and save the video to your photo library.

Film space runs entirely on your device. Landscape orientation is recommended.

<div align="center">
  <p align="center">
    <img src="./assets/film-space-camera-1.gif" alt="Film space Camera mode — outdoor blocking" width="400"/>
    <img src="./assets/film-space-camera-2.gif" alt="Film space Camera mode — street scene" width="400"/>
    <img src="./assets/film-space-camera-3.gif" alt="Film space Camera mode — studio grid" width="400"/>
  </p>
</div>

---

## Controls

The toolbar at the bottom of the screen holds all controls. Some buttons change depending on whether you're in **Edit** or **Camera** mode.

### Mode Toggle (center)

| Control | Action |
| --- | --- |
| **Edit** | Stage the scene — orbit the view, move stand-ins, and set up your blocking. |
| **Camera** | Walk through the scene using device motion and record footage. |

---

### Edit Mode

#### Canvas gestures

| Gesture | Action |
| --- | --- |
| **Drag** (no stand-in selected) | Orbit the camera around the scene. |
| **Pinch** | Zoom in and out. |
| **Tap a stand-in** | Select it for editing. |
| **Tap empty space** | Deselect the current stand-in and return to orbiting. |
| **Drag** (stand-in selected) | Move the selected stand-in across the floor. |

#### Toolbar — left side

| Control | Action |
| --- | --- |
| **↺ / ↻** (hold) | Rotate the selected stand-in counterclockwise or clockwise. Requires a selected stand-in. |
| **Figure** | Add a new human stand-in to the scene. |
| **Trash** | Delete the selected stand-in. Requires a selected stand-in. |

#### Toolbar — right side

| Control | Action |
| --- | --- |
| **↑ / ↓** (hold) | Raise or lower the camera framing (moves the orbit center vertically). |
| **Joystick** | Move the camera rig horizontally and forward/backward relative to the current view. |
| **Lock** | Save the current camera viewpoint. Use this to mark a shot you want to return to. |
| **Return** | Snap back to the locked viewpoint. Disabled until you've set a lock. |

---

### Camera Mode

In Camera mode, move through the virtual space by physically walking and turning with your phone. The app uses ARKit device tracking to translate your real-world movement into camera movement in the scene.

#### Toolbar — left side

| Control | Action |
| --- | --- |
| **Focal length** (e.g. 35mm) | Tap to cycle through 35mm → 50mm → 75mm → 200mm lenses. |

#### Toolbar — right side

| Control | Action |
| --- | --- |
| **Shoulder placement** | Place the camera at shoulder height (~1.5 m) at the scene center, using your phone's current tilt and heading. |
| **Lock** | Save your current camera position and orientation as a return point. |
| **Record** | Start or stop recording. While recording, the button shows a square stop icon. Video is saved to your photo library when you stop. |
| **Return** | Snap the camera back to the locked viewpoint at your current physical position. Disabled until you've set a lock. |

---

<div align="center">

Made with ❤️ from Munich and Palo Alto

</div>
