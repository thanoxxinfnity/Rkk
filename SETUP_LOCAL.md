# SETUP_LOCAL: download the project and run it on your own computer (localhost)

**Hinglish summary:** Pehle project ko GitHub se apne computer par download karo (ZIP ya git). Phir Rigger tool `index.html` par double-click karke chalao (ya localhost command se). Phir Godot mein `godot/` folder kholo aur F5 dabao. Neeche step by step likha hai.

"Localhost" means **your own computer**. The address `http://localhost:8000` opens a page that is served from a small program running on your PC. Nothing goes on the internet.

## 1. Download the project

The project is on GitHub: `https://github.com/thanoxxinfnity/Rkk`. The work is on the branch **`ccr-e681c34b-o3tuyl`** (not on the default branch).

### Option A: ZIP (no extra software)

1. Open this link in your browser while you are logged in to GitHub:

       https://github.com/thanoxxinfnity/Rkk/archive/refs/heads/ccr-e681c34b-o3tuyl.zip

2. A ZIP file downloads. Right-click it and choose **Extract All** (Windows) or double-click it (Mac).
3. Move the extracted folder somewhere simple, for example `C:\games\Rkk` or `~/games/Rkk`. Avoid very long paths.

### Option B: git (if git is installed)

    git clone -b ccr-e681c34b-o3tuyl https://github.com/thanoxxinfnity/Rkk.git
    cd Rkk

To get new changes later, run `git pull` inside the `Rkk` folder.

### What you get

    Rkk/
    ├─ rigger/          the rigging and animation tool (index.html)
    ├─ godot/           a Godot 4 demo project with a rigged character
    ├─ index.html       (the roleplay chat site, not needed for the game)
    ├─ api/             (server code for that site, not needed for the game)
    ├─ FOR_CLAUDE_GODOT.md   the file to give to Claude
    └─ SETUP_LOCAL.md        this file

## 2. Install what you need

| Tool | Needed for | Where |
|---|---|---|
| A browser (Chrome or Firefox) | Rigger | already on your PC |
| **Godot 4.3 or newer** | the game | https://godotengine.org/download (no installer: unzip and run) |
| Python 3 | only the localhost command (optional) | https://www.python.org/downloads (tick **Add Python to PATH** on Windows) |
| git | only for Option B (optional) | https://git-scm.com/downloads |

## 3. Run Rigger

**Easiest (no localhost):** open the `rigger` folder and double-click `index.html`. It opens in your browser. It works offline.

**Localhost (if double-click does not work):** open a terminal in the `Rkk` folder.

Windows (PowerShell or CMD):

    cd rigger
    python -m http.server 8000

Mac or Linux:

    cd rigger
    python3 -m http.server 8000

Then open **http://localhost:8000** in the browser. Keep the terminal window open while you work. Press **Ctrl + C** in the terminal to stop it.

If port 8000 is busy, use another number, for example `python -m http.server 8080`, and open http://localhost:8080.

Quick check: click **Try the demo character**. The left panel should show `49` bones.

## 4. Make a character and export it

1. In Rigger click **Import .glb** (your 3D model from an AI 3D generator, in T-pose), then **Auto-fit humanoid**.
2. Press **Pose**, rotate bones, press **K** to keyframe, **Space** to play.
3. Click **Export .glb**. The browser downloads `rigged-character.glb` (usually to your Downloads folder).

## 5. Put it in Godot and run it

1. Start Godot. In the project manager click **Import**, choose `Rkk/godot/project.godot`, then **Import & Edit**.
2. Press **F5** to run the demo (SPACE play or pause, C curl fingers, R reset).
3. For your own character: copy your `.glb` into the Godot project (for example `godot/characters/hero.glb`). Godot imports it. Double-click it and choose **New Inherited Scene**.

More detail is in `godot/README.md`.

## 6. If something goes wrong

| Problem | Fix |
|---|---|
| `python` is not recognized | Install Python and tick "Add to PATH", or try `py -m http.server 8000`. Or just double-click `index.html`. |
| The browser shows "This site can't be reached" | The terminal command is not running. Start it again and keep the window open. |
| "Address already in use" | Use another port: `python -m http.server 8080`. |
| ZIP link says 404 | You are not logged in to GitHub, or the repo is private to another account. Log in, or use Option B. |
| Rigger shows a WebGL message | Use Chrome or Firefox. Turn on hardware acceleration. Update the graphics driver. |
| Godot says it cannot open the project | Open `godot/project.godot`, not the `Rkk` folder. Use Godot 4.3 or newer (not Godot 3). |
| Godot takes a long time the first time | Normal. It imports the `.glb` once. |

## 7. Git tip for Claude Code

Open the `Rkk` folder in Claude Code and give it `FOR_CLAUDE_GODOT.md`. Do not put API keys or tokens in the repo.
