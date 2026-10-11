# Using Rigger characters in Godot 4

Tested with **Godot 4.3** (headless import and script checks). Rigger exports a `.glb` that Godot imports as a real skeleton, a skinned mesh, and an animation. No plugin is needed.

## 1. Try the demo project

1. Install Godot 4.3 or newer from godotengine.org (no installer: unzip and run).
2. Open this `godot/` folder in the Godot project manager and press **F5**.
3. You see the demo character playing the baked animation. Keys: `SPACE` play or pause, `C` curl left-hand fingers from code, `R` reset the pose. A sphere is attached to the right hand to show how to hold items.

Terminal check (no window), from the repo folder:

    godot --headless --path godot --import
    godot --headless --path godot --script res://check_import.gd

It prints the bone count (49), key bone indices, the animation, and tests that animation and code both move a finger bone. Note: a harmless line `ERROR: Parameter "m" is null` appears in headless mode only. It comes from Godot's dummy renderer, not from the model.

## 2. Put your own character in your game

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

## 3. Animation

- Rigger exports **one clip per file**, named `Take`. For idle, walk and run, export one `.glb` per animation from the same rig. Bone names match, so Godot can share them. In the **Advanced Import Settings** (double-click the `.glb`, press **Advanced**) rename `Take` to `idle`, `walk`, and so on.
- glTF clips import with **looping off**. For a repeating clip, set it in code or in Advanced Import:

      anim_player.get_animation("Take").loop_mode = Animation.LOOP_LINEAR
      anim_player.play("Take")

- Godot **trims a clip to its last key** and **drops tracks that never change**. Put a key at the time where you want the clip to end (for a 1 s loop, key at 0 and at 1.0 with the same pose at both ends).
- To blend idle, walk and run, add an `AnimationTree` with an `AnimationNodeStateMachine`.

## 4. Use bones from code

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

## 5. Humanoid retargeting (optional)

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

## 6. Common problems

| Problem | Fix |
|---|---|
| The character walks backwards | glTF faces +Z and Godot's forward is -Z. Rotate the model 180° around Y. |
| The animation plays once and stops | Turn looping on (section 3). |
| The animation is shorter than in Rigger | Godot trims to the last key. Key the end time. |
| Fingers or hands look stretched | Re-do Auto-fit in Rigger, or raise Skin weights Sharpness to 2 or 3, then export again. |
| Bone name not found | Names are case sensitive: `index1L`, not `Index1L`. Print all names with `skeleton.get_bone_name(i)`. |
| Import looks wrong after re-export | In the FileSystem dock, right-click the `.glb` and choose **Reimport**. |
