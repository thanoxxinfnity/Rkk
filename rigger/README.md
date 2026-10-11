# Rigger: low-RAM rig and animation tool

One HTML file. It runs in the browser, needs no install, and draws only when something changes, so it stays light on low-RAM PCs.

## Start it

`index.html` is one self-contained file (three.js is inside it). It works **offline**, needs **no install and no Python**.

**Just double-click `index.html`.** It opens in your browser (Chrome or Firefox work best).

If you prefer a terminal, this also works:

    cd Rkk/rigger
    python3 -m http.server 8000      (Windows: python -m http.server 8000)

Then open http://localhost:8000. Stop it with Ctrl + C.

If the page shows a message instead of the tool, read it: it says what is wrong (for example, the browser has no WebGL: turn on hardware acceleration or try another browser).

## How to use

1. **Demo character** loads a T-pose mesh with a finger rig. Or **Import .glb** loads your own model, then click **Auto-fit humanoid**.
2. **Auto-fit humanoid** builds a 49-bone rig from the mesh's proportions: spine, neck, head, legs, arms, and 15 finger bones per hand (thumb, index, middle, ring, pinky, 3 bones each). Bone names end in `L` or `R`.
3. **Rig** mode (key `1`): fix any joint that is off with the gizmo (`W` move, `E` rotate). Parents move their children.
4. **Pose** mode (key `2`): the mesh is auto-weighted to the bones. Rotate bones in degrees on the right, or with the gizmo.
5. **Mirror L→R** copies a left bone's pose or rest to its right partner.
6. **K** keyframes all bones at the playhead. Move the playhead, pose again, and key again. **Space** plays. Green ticks mark keys.
7. **Export .glb** downloads one file with the mesh, skeleton and animation.

## Low-RAM tips

- Keep meshes under about 50,000 vertices. The tool warns above 200,000.
- Textures in imported files still use memory while loading. The tool keeps only the geometry, not the materials.
- Close other browser tabs while you work.

## Limits (honest)

- Auto-fit assumes an upright model (Y up, front facing +Z) in a T-pose. For A-pose or odd models, fix the joints in Rig mode.
- Weights are automatic (nearest bones, 4 per vertex, the Sharp value sets how sharp the falloff is). There is no hand-painted weight editing. If fingers are merged into the hand, weights can bleed between fingers.
- No IK yet. Hands and feet are posed with rotations (FK).
- Only `.glb` and `.gltf` import. FBX and OBJ are not supported yet.
- Undo is not implemented yet.
- Keyframes are stored per bone in local space. If you change the rest pose after keying, existing keys can shift. Re-key after big rig changes.

## For developers

`index.html` is built. Edit `src/main.js` and `src/template.html`, then run:

    npm install
    npm run build

The build bundles three.js into `index.html` with esbuild.
