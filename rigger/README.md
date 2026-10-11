# Rigger: low-RAM rig and animation tool

One HTML file. It runs in the browser, needs no install, and draws only when something changes, so it stays light on low-RAM PCs.

## Start it (terminal)

Windows (PowerShell or CMD):

    cd Rkk\rigger
    python -m http.server 8000

Mac or Linux:

    cd Rkk/rigger
    python3 -m http.server 8000

Then open **http://localhost:8000** in Chrome or Firefox.

No Python? Use Node: `npx serve rigger`. You can also try double-clicking `index.html`. If the screen stays blank, use the server command. The three.js library loads from a CDN, so the first start needs internet.

Stop the server with **Ctrl + C**.

## How to use

1. **Demo character** loads a humanoid mesh with a ready rig. Or **Import .glb** loads your own model.
2. **Rig** mode (key `1`): add bones with **+ Bone**. Drag them with the gizmo (`W` move, `E` rotate) so they sit on the joints. Bones are children of the selected bone. Edit names, positions and rotations on the right.
3. **Pose** mode (key `2`): the mesh is auto-weighted to the bones. Rotate bones in degrees on the right, or with the gizmo.
4. Press **K** (Key all bones) to keyframe the current pose at the playhead. Move the playhead, pose again, and key again.
5. **Space** plays the animation. Click a green tick to jump to a key. **Delete keys here** removes keys at the playhead.
6. **Export .glb** downloads one file with the mesh, skeleton (rig) and animation. Game engines such as Unity, Godot, Blender and Three.js can import it.

## Low-RAM tips

- Keep meshes under about 50,000 vertices. The tool warns above 200,000.
- Textures in imported files still use memory while loading. The tool keeps only the geometry, not the materials.
- Close other browser tabs while you work.

## Limits (honest)

- Weights are automatic (nearest bones, 4 per vertex). They are not hand-painted like in Blender. Use fewer bones on very dense meshes.
- Only `.glb` and `.gltf` import. FBX and OBJ are not supported yet.
- Undo is not implemented yet.
- Keyframes are stored per bone in local space. If you change the rest pose after keying, existing keys can shift. Re-key after big rig changes.
