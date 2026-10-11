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

## 3. What to build (Godot 4)

The game engine is **Godot 4** (GDScript). A tested example is in `godot/` (read `godot/README.md` first). It shows how to import the `.glb`, play the clip, drive bones from code, and attach items to a hand.

1. **Import.** Copy each Rigger `.glb` into `res://characters/`. Godot makes a `Skeleton3D`, a skinned `MeshInstance3D`, and an `AnimationPlayer` with the clip `Take`. Build a character scene: `CharacterBody3D` with a `CollisionShape3D` and the inherited model.
2. **Animation.** One clip per file, named `Take`. Rename clips (`idle`, `walk`, `run`, `attack`) in Advanced Import Settings and turn looping on for idle, walk and run. Use an `AnimationTree` with a state machine to blend them.
3. **Controller.** A `CharacterBody3D` script: WASD or arrows to move, jump, face the move direction, third-person camera. If the model walks backwards, rotate it 180° around Y (glTF faces +Z, Godot forward is -Z).
4. **Bones from code.** Look bones up by name with `skeleton.find_bone("handR")`. Use `BoneAttachment3D` for weapons and items. Control fingers with `set_bone_pose_rotation`, with the animation paused or on other bones.
5. **Mirror (optional).** To reuse a left-side animation on the right, mirror the pose: negate `position.x`, and for quaternions use `(x, -y, -z, w)`.
6. **Performance (low-end PC).** Keep character meshes under 50,000 vertices. Use the Compatibility renderer if the GPU is old (`godot/project.godot` already does).

## 4. Rules

- Do not edit the Rigger tool (`rigger/`). Put the game in its own folder (for example `game/`). To run Rigger, see `rigger/RUN_ME.md`.
- Keep the bone names listed above as the contract. If a name changes in the rig, update the game in the same change.
- Test in the Godot editor (F5) or headless: `godot --headless --path <game folder> --quit-after 60`.
- Write GDScript with static types. Keep scripts small and one per scene.
- Do not put API keys or tokens in the repo.

## 5. Acceptance checklist

- [ ] The game loads a `.glb` exported from Rigger without errors.
- [ ] The `Take` clip plays and loops on the character.
- [ ] Walk and idle switch with a crossfade, with no snapping.
- [ ] All 49 bones resolve by name (log a warning for any missing name).
- [ ] Runs at a steady frame rate on a basic laptop (check the Godot Profiler / Monitors).
- [ ] The game's README says how to open it in Godot and which keys to press.
