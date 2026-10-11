# Game brief: use rigged characters from Rigger

This brief is for the agent (Claude Code) that builds the game. It describes the files the Rigger tool exports, so the game can load them and animate them correctly.

## 1. What the input files are

Rigger (`rigger/index.html`) exports one binary glTF file per character: `rigged-character.glb` (or the name the user chose on download).

Each `.glb` contains:

- A root node named `Character`.
- Under it, a node `Rig` with the bone hierarchy. The top bone is `hips`. Every other bone is a child of another bone.
- Under it, a node `Mesh`: a `SkinnedMesh` with a skin that lists all bones as joints, and per-vertex weights (`JOINTS_0`, `WEIGHTS_0`).
- One animation named `Take`. It has two channels per bone: `position` and `quaternion`. Keys are linear. Times are in seconds. The clip loops.

Units are meters, Y is up (glTF standard). The auto-fit humanoid is about 1.7 to 1.8 units tall. The character faces +Z (assumed; verify with a test render).

Rigger can export only one clip per file, always named `Take`. If the game needs several animations (idle, walk, run, attack), the user exports one GLB per animation. Each export starts from the same rig, so the bone names match. Then the game loads the rig once and takes the `Take` clip from each file. Alternatively, rename the clip in the code after loading.

## 2. Bone naming (auto-fit humanoid)

Use these names. The game code should look bones up by name, never by index.

| Area | Bones |
|---|---|
| Body | `hips` (root), `spine`, `chest`, `neck`, `head` |
| Per side (suffix `L` or `R`) | `thighL`, `shinL`, `footL`, `toeL` |
| Per side | `upperArmL`, `foreArmL`, `handL` |
| Per finger, per side | `thumb1L`, `thumb2L`, `thumb3L`, `index1L` ... `index3L`, `middle1L` ... `middle3L`, `ring1L` ... `ring3L`, `pinky1L` ... `pinky3L` |

The `L` and `R` suffixes are the side. The `1`, `2`, `3` numbers are the joint order from the knuckle to the tip. A custom rig can use other names. Then the game should read the names from the file, not assume these.

## 3. What to build

Target: a three.js game that runs in the browser, unless the user names another engine. Ask the user once if unsure.

1. **Loader.** Load a `.glb` with `GLTFLoader`. Find the `SkinnedMesh`, the `Rig`, and the clip named `Take`. Keep the clip; if there are several files, merge them into one `AnimationClip` set keyed by name (`idle`, `walk`, ...).
2. **Animation.** Use `AnimationMixer` on the loaded scene. Play one clip at a time. Crossfade between clips over about 0.2 s with `action.crossFadeTo`. Do not loop a clip that is meant to play once.
3. **Controller.** A small state machine: `idle`, `walk`, `run`, `jump`, `attack`. Map keyboard keys (WASD and arrows) to movement. Rotate the character to face the move direction. Keep the camera behind the character.
4. **Finger control (optional).** Finger bones can be animated separately: add a layer that rotates `index1L`... with simple curl values, on top of the body clip.
5. **Mirror.** For a left-only animation, reuse it for the right side by flipping: `position.x` negated, and for quaternions `(x, -y, -z, w)`. Use this only when the user asks.
6. **Performance (low-RAM target).** Keep character meshes under 50,000 vertices. Share one geometry and material per character type. Render only when something changes, or use a fixed 30 fps cap. Dispose of unused assets.

## 4. Rules

- Do not edit the Rigger tool (`rigger/`). Put the game in its own folder (for example `game/`). To run Rigger, see `rigger/RUN_ME.md`.
- Keep the bone names listed above as the contract. If a name changes in the rig, update the game in the same change.
- Test with a local server, not with `file://`: `python -m http.server 8000` in the game folder, then open http://localhost:8000.
- Keep the code in plain modules (ES modules with an import map to three.js CDN, same as Rigger). Do not add a build step unless the user asks.
- Do not put API keys or tokens in the repo.

## 5. Acceptance checklist

- [ ] The game loads a `.glb` exported from Rigger without errors.
- [ ] The `Take` clip plays and loops on the character.
- [ ] Walk and idle switch with a crossfade, with no snapping.
- [ ] All 49 bones resolve by name (log a warning for any missing name).
- [ ] Runs at a steady frame rate on a basic laptop (test with Chrome's Performance panel).
- [ ] The README in `game/` says how to start the game with the terminal command above.
