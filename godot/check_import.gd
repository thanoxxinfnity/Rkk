extends SceneTree
## Headless check: godot --headless --path godot --script res://check_import.gd

func _initialize() -> void:
	var scene := load("res://assets/demo_rigged.glb") as PackedScene
	if scene == null:
		print("CHECK FAIL: could not load the glb")
		quit(1)
		return
	var model := scene.instantiate()
	root.add_child(model)
	var skel := _find(model, "Skeleton3D") as Skeleton3D
	var ap := _find(model, "AnimationPlayer") as AnimationPlayer
	print("CHECK skeleton bones: ", skel.get_bone_count() if skel else -1)
	for n in ["hips", "head", "handL", "index1L", "pinky3R", "toeR"]:
		print("CHECK bone '%s' index: %d" % [n, skel.find_bone(n) if skel else -1])
	if ap:
		for a in ap.get_animation_list():
			var anim := ap.get_animation(a)
			print("CHECK animation '%s' length %.2f s, tracks %d" % [a, anim.length, anim.get_track_count()])
	var mesh := _find(model, "MeshInstance3D") as MeshInstance3D
	if skel and ap:
		var idx := skel.find_bone("index1L")
		var rest := skel.get_bone_pose_rotation(idx)
		ap.get_animation("Take").loop_mode = Animation.LOOP_LINEAR
		ap.play("Take")
		ap.seek(0.5, true)
		var mid := skel.get_bone_pose_rotation(idx)
		print("CHECK index1L animated at 0.5s differs from rest: ", not rest.is_equal_approx(mid))
		ap.stop()
		skel.set_bone_pose_rotation(idx, Quaternion(Vector3.BACK, 1.2))
		print("CHECK code-set finger rotation z: %.3f" % skel.get_bone_pose_rotation(idx).z)
	print("CHECK mesh skinned: ", mesh != null and mesh.skin != null and mesh.skeleton != NodePath(""))
	quit(0)

func _find(node: Node, cls: String) -> Node:
	if node.is_class(cls):
		return node
	for c in node.get_children():
		var f := _find(c, cls)
		if f:
			return f
	return null
