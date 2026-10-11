# RUN_ME: how to run and use Rigger

Give this file to Claude (or Claude Code) together with the `rigger/` folder. It says exactly what to run.

## What this is

Rigger is a browser tool to rig and animate 3D characters (bones, fingers, keyframes) and export a `.glb` for a game. It is one self-contained file, `rigger/index.html`. It works offline. It needs no install, no server, and no Python.

## Run it (pick one)

1. **Easiest: open the file.** Double-click `rigger/index.html`, or open it with Chrome or Firefox.

2. **From a terminal** (only if option 1 does not work):

   Windows (PowerShell or CMD):

       cd rigger
       python -m http.server 8000

   Mac or Linux:

       cd rigger
       python3 -m http.server 8000

   Then open http://localhost:8000 in the browser. Stop with Ctrl + C.

## Check that it works (2 minutes)

1. The page shows a welcome box. Click **Try the demo character**.
2. A character with 49 bones appears (the list on the left says `49`).
3. Click **Pose** (top left). In the bone list search, type `index1L`, click it.
4. Set the Z rotation on the right to `50`. Press **K** (keyframe). Move the slider to the middle, set Z to `0`, press **K** again.
5. Press **Space**. The finger should bend and straighten.
6. Click **Export .glb**. A file `rigged-character.glb` downloads.

If these steps work, the tool is fine.

## Use it with your own model

1. Make a 3D character with an AI 3D generator. Ask for a **T-pose** with **separate fingers**. Download it as **.glb**.
2. In Rigger click **Import .glb** (or drag the file onto the window).
3. Click **Auto-fit humanoid**. It builds a 49-bone rig (spine, head, arms, legs, 15 finger bones per hand).
4. In **Rig** mode (key `1`) fix any joint that is off: select a coloured dot, drag the arrows.
5. In **Pose** mode (key `2`) rotate bones and press **K** to keyframe. **Space** plays.
6. **Export .glb**. Use that file in the game (see `rigger/GAME_BRIEF.md`).

Auto-fit expects an upright model in a T-pose. Weights are automatic; there is no hand weight painting. One export holds one animation clip named `Take`.

## If something does not work

| What you see | What to do |
|---|---|
| A message "Rigger could not start" about WebGL | Use Chrome or Firefox. Turn on hardware acceleration in the browser settings. Update the graphics driver. |
| Blank page | Press F12, open Console, and copy the red error. Try option 2 above. |
| `python` not found | Use option 1 (double-click). Or install Python from python.org. |
| Model is tiny or huge | Normal for some files. The camera and dots scale to the model. Scroll to zoom, right-drag to pan. |
| Fingers bleed into each other | Try Pose sharpness `2` or `3` (right panel, Skin weights). Fingers merged in the mesh cannot be fully separated. |
| Slow on an old PC | Keep the model under about 50,000 vertices. Close other tabs. |

## For Claude: rules when changing the tool

- `rigger/index.html` is **built**. Do not edit it by hand. Edit `rigger/src/main.js` and `rigger/src/template.html`, then run:

      cd rigger
      npm install
      npm run build

- Keep the bone names (`hips`, `spine`, `chest`, `neck`, `head`, `thighL`, `index1L`, ...). The game depends on them.
- After a change, repeat the "Check that it works" steps. Test with the page offline.
- Do not add API keys or tokens to the repo.
