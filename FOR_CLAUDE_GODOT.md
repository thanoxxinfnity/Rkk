# Godot game with Rigger characters: everything Claude needs

Give this one file to Claude (or Claude Code). It has three parts:

1. **Part A**: how to build the game in Godot 4 (the task).
2. **Part B**: how to use the exported `.glb` in Godot (tested with Godot 4.3).
3. **Part C**: how to run and check the Rigger tool that makes the characters.

The full project is in the repo (branch `ccr-e681c34b-o3tuyl`): `rigger/` is the tool, `godot/` is a tested demo project with a sample rigged character at `godot/assets/demo_rigged.glb`.

---

# Part A: Game brief

This brief is for the agent (Claude Code) that builds the game. It describes the files the Rigger tool exports, so the game can load them and animate them correctly.

### 1. What the input files are

Rigger (`rigger/index.html`) exports one binary glTF file per character: `rigged-character.glb` (or the name the user chose on download).

Each `.glb` contains:

- A root node named `Character`.
- Under it, a node `Rig` with the bone hierarchy. The top bone is `hips`. Every other bone is a child of another bone.
- Under it, a node `Mesh`: a `SkinnedMesh` with a skin that lists all bones as joints, and per-vertex weights (`JOINTS_0`, `WEIGHTS_0`).
- One animation named `Take`. It has two channels per bone: `position` and `quaternion`. Keys are linear. Times are in seconds. The clip loops.

Units are meters, Y is up (glTF standard). The auto-fit humanoid is about 1.7 to 1.8 units tall. The character faces +Z (assumed; verify with a test render).

Rigger can export only one clip per file, always named `Take`. If the game needs several animations (idle, walk, run, attack), the user exports one GLB per animation. Each export starts from the same rig, so the bone names match. Then the game loads the rig once and takes the `Take` clip from each file. Alternatively, rename the clip in the code after loading.

### 2. Bone naming (auto-fit humanoid)

Use these names. The game code should look bones up by name, never by index.

| Area | Bones |
|---|---|
| Body | `hips` (root), `spine`, `chest`, `neck`, `head` |
| Per side (suffix `L` or `R`) | `thighL`, `shinL`, `footL`, `toeL` |
| Per side | `upperArmL`, `foreArmL`, `handL` |
| Per finger, per side | `thumb1L`, `thumb2L`, `thumb3L`, `index1L` ... `index3L`, `middle1L` ... `middle3L`, `ring1L` ... `ring3L`, `pinky1L` ... `pinky3L` |

The `L` and `R` suffixes are the side. The `1`, `2`, `3` numbers are the joint order from the knuckle to the tip. A custom rig can use other names. Then the game should read the names from the file, not assume these.

### 3. What to build (Godot 4)

The game engine is **Godot 4** (GDScript). A tested example is in `godot/` (read `godot/README.md` first). It shows how to import the `.glb`, play the clip, drive bones from code, and attach items to a hand.

1. **Import.** Copy each Rigger `.glb` into `res://characters/`. Godot makes a `Skeleton3D`, a skinned `MeshInstance3D`, and an `AnimationPlayer` with the clip `Take`. Build a character scene: `CharacterBody3D` with a `CollisionShape3D` and the inherited model.
2. **Animation.** One clip per file, named `Take`. Rename clips (`idle`, `walk`, `run`, `attack`) in Advanced Import Settings and turn looping on for idle, walk and run. Use an `AnimationTree` with a state machine to blend them.
3. **Controller.** A `CharacterBody3D` script: WASD or arrows to move, jump, face the move direction, third-person camera. If the model walks backwards, rotate it 180° around Y (glTF faces +Z, Godot forward is -Z).
4. **Bones from code.** Look bones up by name with `skeleton.find_bone("handR")`. Use `BoneAttachment3D` for weapons and items. Control fingers with `set_bone_pose_rotation`, with the animation paused or on other bones.
5. **Mirror (optional).** To reuse a left-side animation on the right, mirror the pose: negate `position.x`, and for quaternions use `(x, -y, -z, w)`.
6. **Performance (low-end PC).** Keep character meshes under 50,000 vertices. Use the Compatibility renderer if the GPU is old (`godot/project.godot` already does).

### 4. Rules

- Do not edit the Rigger tool (`rigger/`). Put the game in its own folder (for example `game/`). To run Rigger, see `rigger/RUN_ME.md`.
- Keep the bone names listed above as the contract. If a name changes in the rig, update the game in the same change.
- Test in the Godot editor (F5) or headless: `godot --headless --path <game folder> --quit-after 60`.
- Write GDScript with static types. Keep scripts small and one per scene.
- Do not put API keys or tokens in the repo.

### 5. Acceptance checklist

- [ ] The game loads a `.glb` exported from Rigger without errors.
- [ ] The `Take` clip plays and loops on the character.
- [ ] Walk and idle switch with a crossfade, with no snapping.
- [ ] All 49 bones resolve by name (log a warning for any missing name).
- [ ] Runs at a steady frame rate on a basic laptop (check the Godot Profiler / Monitors).
- [ ] The game's README says how to open it in Godot and which keys to press.

---

# Part B: Using Rigger characters in Godot 4

Tested with **Godot 4.3** (headless import and script checks). Rigger exports a `.glb` that Godot imports as a real skeleton, a skinned mesh, and an animation. No plugin is needed.

### 1. Try the demo project

1. Install Godot 4.3 or newer from godotengine.org (no installer: unzip and run).
2. Open this `godot/` folder in the Godot project manager and press **F5**.
3. You see the demo character playing the baked animation. Keys: `SPACE` play or pause, `C` curl left-hand fingers from code, `R` reset the pose. A sphere is attached to the right hand to show how to hold items.

Terminal check (no window), from the repo folder:

    godot --headless --path godot --import
    godot --headless --path godot --script res://check_import.gd

It prints the bone count (49), key bone indices, the animation, and tests that animation and code both move a finger bone. Note: a harmless line `ERROR: Parameter "m" is null` appears in headless mode only. It comes from Godot's dummy renderer, not from the model.

### 2. Put your own character in your game

1. In Rigger, rig the character and click **Export .glb**.
2. Copy the `.glb` into your Godot project, for example `res://characters/hero.glb`. Godot imports it on its own.
3. Double-click the file, then choose **New Inherited Scene** to edit it. You get:
   - `Skeleton3D` with all bones, named as in Rigger (`hips`, `spine`, `handL`, `index1L`, ...)
   - a skinned `MeshInstance3D`
   - an `AnimationPlayer` with the clip named `Take`
4. Build your character scene like this and save it:

       CharacterBody3D
       ├─ CollisionShape3D
       └─ hero (the inherited .glb scene, with Skeleton3D and AnimationPlayer)

### 3. Animation

- Rigger exports **one clip per file**, named `Take`. For idle, walk and run, export one `.glb` per animation from the same rig. Bone names match, so Godot can share them. In the **Advanced Import Settings** (double-click the `.glb`, press **Advanced**) rename `Take` to `idle`, `walk`, and so on.
- glTF clips import with **looping off**. For a repeating clip, set it in code or in Advanced Import:

      anim_player.get_animation("Take").loop_mode = Animation.LOOP_LINEAR
      anim_player.play("Take")

- Godot **trims a clip to its last key** and **drops tracks that never change**. Put a key at the time where you want the clip to end (for a 1 s loop, key at 0 and at 1.0 with the same pose at both ends).
- To blend idle, walk and run, add an `AnimationTree` with an `AnimationNodeStateMachine`.

### 4. Use bones from code

    var skeleton: Skeleton3D = $hero/Skeleton3D
    var i := skeleton.find_bone("index1L")
    skeleton.set_bone_pose_rotation(i, Quaternion(Vector3.BACK, 1.2))   # bend a finger
    skeleton.reset_bone_poses()                                          # back to the rest pose

If an `AnimationPlayer` is playing a track for that bone, the animation wins every frame. Pause it, or animate other bones, to control one bone yourself.

Hold an item in the hand (the node follows the bone):

    var attach := BoneAttachment3D.new()
    attach.bone_name = "handR"
    skeleton.add_child(attach)
    attach.add_child(sword_scene.instantiate())

### 5. Humanoid retargeting (optional)

To reuse Godot or Mixamo humanoid animations on a Rigger skeleton, use Advanced Import Settings, select the `Skeleton3D`, set **Bone Map** to a new `BoneMap` with the `SkeletonProfileHumanoid` profile. Map the bones like this. This table follows Godot's profile names. It was **not** tested here, so check the BoneMap editor shows no red entries.

| Rigger | Godot humanoid |
|---|---|
| `hips`, `spine`, `chest`, `neck`, `head` | `Hips`, `Spine`, `Chest`, `Neck`, `Head` |
| `upperArmL`, `foreArmL`, `handL` | `LeftUpperArm`, `LeftLowerArm`, `LeftHand` |
| `thighL`, `shinL`, `footL`, `toeL` | `LeftUpperLeg`, `LeftLowerLeg`, `LeftFoot`, `LeftToes` |
| `thumb1L`, `thumb2L`, `thumb3L` | `LeftThumbMetacarpal`, `LeftThumbProximal`, `LeftThumbDistal` |
| `index1L`, `index2L`, `index3L` | `LeftIndexProximal`, `LeftIndexIntermediate`, `LeftIndexDistal` |
| `middle1L...3L`, `ring1L...3L`, `pinky1L...3L` | `LeftMiddle...`, `LeftRing...`, `LeftLittle...` (Proximal, Intermediate, Distal) |
| the same with `R` | the same with `Right` |

Rigger has no shoulder or upper-chest bones. Leave those empty in the map.

### 6. Common problems

| Problem | Fix |
|---|---|
| The character walks backwards | glTF faces +Z and Godot's forward is -Z. Rotate the model 180° around Y. |
| The animation plays once and stops | Turn looping on (section 3). |
| The animation is shorter than in Rigger | Godot trims to the last key. Key the end time. |
| Fingers or hands look stretched | Re-do Auto-fit in Rigger, or raise Skin weights Sharpness to 2 or 3, then export again. |
| Bone name not found | Names are case sensitive: `index1L`, not `Index1L`. Print all names with `skeleton.get_bone_name(i)`. |
| Import looks wrong after re-export | In the FileSystem dock, right-click the `.glb` and choose **Reimport**. |

---

# Part C: Run and check Rigger

Give this file to Claude (or Claude Code) together with the `rigger/` folder. It says exactly what to run.

### What this is

Rigger is a browser tool to rig and animate 3D characters (bones, fingers, keyframes) and export a `.glb` for a game. It is one self-contained file, `rigger/index.html`. It works offline. It needs no install, no server, and no Python.

### Run it (pick one)

1. **Easiest: open the file.** Double-click `rigger/index.html`, or open it with Chrome or Firefox.

2. **From a terminal** (only if option 1 does not work):

   Windows (PowerShell or CMD):

       cd rigger
       python -m http.server 8000

   Mac or Linux:

       cd rigger
       python3 -m http.server 8000

   Then open http://localhost:8000 in the browser. Stop with Ctrl + C.

### Check that it works (2 minutes)

1. The page shows a welcome box. Click **Try the demo character**.
2. A character with 49 bones appears (the list on the left says `49`).
3. Click **Pose** (top left). In the bone list search, type `index1L`, click it.
4. Set the Z rotation on the right to `50`. Press **K** (keyframe). Move the slider to the middle, set Z to `0`, press **K** again.
5. Press **Space**. The finger should bend and straighten.
6. Click **Export .glb**. A file `rigged-character.glb` downloads.

If these steps work, the tool is fine.

### Use it with your own model

1. Make a 3D character with an AI 3D generator. Ask for a **T-pose** with **separate fingers**. Download it as **.glb**.
2. In Rigger click **Import .glb** (or drag the file onto the window).
3. Click **Auto-fit humanoid**. It builds a 49-bone rig (spine, head, arms, legs, 15 finger bones per hand).
4. In **Rig** mode (key `1`) fix any joint that is off: select a coloured dot, drag the arrows.
5. In **Pose** mode (key `2`) rotate bones and press **K** to keyframe. **Space** plays.
6. **Export .glb**. Use that file in the game (see `rigger/GAME_BRIEF.md`).

Auto-fit expects an upright model in a T-pose. Weights are automatic; there is no hand weight painting. One export holds one animation clip named `Take`.

### If something does not work

| What you see | What to do |
|---|---|
| A message "Rigger could not start" about WebGL | Use Chrome or Firefox. Turn on hardware acceleration in the browser settings. Update the graphics driver. |
| Blank page | Press F12, open Console, and copy the red error. Try option 2 above. |
| `python` not found | Use option 1 (double-click). Or install Python from python.org. |
| Model is tiny or huge | Normal for some files. The camera and dots scale to the model. Scroll to zoom, right-drag to pan. |
| Fingers bleed into each other | Try Pose sharpness `2` or `3` (right panel, Skin weights). Fingers merged in the mesh cannot be fully separated. |
| Slow on an old PC | Keep the model under about 50,000 vertices. Close other tabs. |

### For Claude: rules when changing the tool

- `rigger/index.html` is **built**. Do not edit it by hand. Edit `rigger/src/main.js` and `rigger/src/template.html`, then run:

      cd rigger
      npm install
      npm run build

- Keep the bone names (`hips`, `spine`, `chest`, `neck`, `head`, `thighL`, `index1L`, ...). The game depends on them.
- After a change, repeat the "Check that it works" steps. Test with the page offline.
- Do not add API keys or tokens to the repo.
