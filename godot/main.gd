extends Node3D
## Loads a character exported from Rigger and shows how to use its skeleton in Godot 4.
##
## Keys:  SPACE  play / pause the baked animation ("Take")
##        C      curl the fingers of the left hand with code (needs the animation paused)
##        R      reset the pose

const MODEL_PATH := "res://assets/demo_rigged.glb"
const LEFT_FINGERS := ["thumb", "index", "middle", "ring", "pinky"]

var skeleton: Skeleton3D
var anim_player: AnimationPlayer
var anim_name := ""
var info: Label


func _ready() -> void:
	_build_stage()
	var scene := load(MODEL_PATH) as PackedScene
	if scene == null:
		push_error("Could not load %s. Open the project once in the Godot editor so it can import the file." % MODEL_PATH)
		return
	var model := scene.instantiate()
	add_child(model)

	skeleton = _find_first(model, "Skeleton3D") as Skeleton3D
	anim_player = _find_first(model, "AnimationPlayer") as AnimationPlayer
	if skeleton == null:
		push_error("No Skeleton3D found in the model.")
		return

	print("Skeleton3D: %d bones" % skeleton.get_bone_count())
	for i in skeleton.get_bone_count():
		print("  bone %d: %s (parent %d)" % [i, skeleton.get_bone_name(i), skeleton.get_bone_parent(i)])

	if anim_player:
		for n in anim_player.get_animation_list():
			if n == "RESET" or n == "":
				continue
			anim_name = n
		print("Animations: ", anim_player.get_animation_list())
		if anim_name != "":
			# glTF animations import with looping off. Turn it on for a repeating clip.
			anim_player.get_animation(anim_name).loop_mode = Animation.LOOP_LINEAR
			anim_player.play(anim_name)

	_attach_item_to_hand()
	info.text = "SPACE: play/pause   C: curl left fingers   R: reset pose\nBones: %d   Animation: %s" % [skeleton.get_bone_count(), anim_name]


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed or skeleton == null:
		return
	match event.keycode:
		KEY_SPACE:
			if anim_player == null:
				return
			if anim_player.is_playing():
				anim_player.pause()
			else:
				anim_player.play(anim_name)
		KEY_C:
			if anim_player and anim_player.is_playing():
				anim_player.pause()
			_curl_fingers("L", 1.2)
		KEY_R:
			skeleton.reset_bone_poses()


## Rotate every finger joint on one side by `angle` radians (bend around Z).
func _curl_fingers(side: String, angle: float) -> void:
	for finger in LEFT_FINGERS:
		for joint in [1, 2, 3]:
			var idx := skeleton.find_bone("%s%d%s" % [finger, joint, side])
			if idx == -1:
				continue
			skeleton.set_bone_pose_rotation(idx, Quaternion(Vector3.BACK, angle if side == "L" else -angle))


## Hold an object in the right hand: BoneAttachment3D follows a bone every frame.
func _attach_item_to_hand() -> void:
	var idx := skeleton.find_bone("handR")
	if idx == -1:
		return
	var attach := BoneAttachment3D.new()
	attach.bone_name = "handR"
	skeleton.add_child(attach)
	var item := MeshInstance3D.new()
	item.mesh = SphereMesh.new()
	item.scale = Vector3.ONE * 0.08
	attach.add_child(item)


func _find_first(node: Node, cls: String) -> Node:
	if node.is_class(cls):
		return node
	for child in node.get_children():
		var found := _find_first(child, cls)
		if found:
			return found
	return null


func _build_stage() -> void:
	var cam := Camera3D.new()
	add_child(cam)
	cam.position = Vector3(0, 1.1, 3.4)
	cam.look_at_from_position(cam.position, Vector3(0, 0.9, 0))
	var sun := DirectionalLight3D.new()
	add_child(sun)
	sun.rotation_degrees = Vector3(-50, -30, 0)
	var floor_mesh := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(8, 8)
	floor_mesh.mesh = plane
	add_child(floor_mesh)
	var layer := CanvasLayer.new()
	add_child(layer)
	info = Label.new()
	info.position = Vector2(12, 10)
	layer.add_child(info)
