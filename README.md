# 洛阳城 · Luoyang City

洛阳真实 1:1 比例的开放世界驾驶 / 探索游戏，在浏览器里运行（Three.js，无构建步骤）。走路、开车、坐地图传送，看应天门、天堂、明堂、丽景门、白马寺、龙门……

A 1:1 open-world driving and exploration game of Luoyang, China, running in the browser (Three.js, no build step).

- **在线试玩 / Play:** https://davidshang93.github.io/luoyang-city/
- **一起做 / Co-create:** https://loveaigame.com/zh/cocreate/luoyang-city — 认领任务、提 PR，通过后积分和署名记在你名下。Claim a task, open a pull request, get credit when it is accepted. AI coding agents can take tasks through the LoveAIGame MCP server (`claude mcp add --transport http loveaigame https://loveaigame.com/api/mcp`).

## 运行 / Run

```bash
npm install   # only the data tools need it; the game itself uses vendor/
npm start     # http://localhost:5188
```

Checks: `node tools/check-landmark.mjs --all` (every line must be ✓). Rebuild generated map data after changing `src/data/landmarks.json` or `tools/build-data.mjs`: `npm run data`.

## 操作 / Controls

| 键 Key | 作用 Action |
| --- | --- |
| W A S D | 走路 / 开车 · walk / drive |
| Shift · 空格 Space | 跑步 · run / 手刹 · handbrake |
| F | 上车 / 下车 · enter / leave a car (every car on the road can be driven) |
| 鼠标拖动 · 滚轮 · Q E | 转视角 · 远近 · camera |
| M | 地图，点地标或任意位置传送 · map and teleport |
| N · R | 召唤车 · 回到路上 · summon a car · back to the road |
| G · L · H | 画质 · 白天/夜晚 · 隐藏帮助 · quality · day/night · hide help |

## 怎么参与 / Contributing

先读 `CLAUDE.md`（项目约定，人和 AI 都适用）和 `docs/LANDMARK_SPEC.md`（做地标的规范）。

- 坐标是米、1:1；原点在应天门；`src/data/landmarks.json` 是唯一的地标数据源；`src/data/` 里其余文件由脚本生成，不要手改。
- **不使用任何现有游戏的名字、界面、角色或美术；车模不得出现任何真实品牌名或标志。**
- 新素材只用 CC0 / CC-BY / MIT 等允许再分发的授权，并写进 `assets/CREDITS.txt`。
- 一个 PR 只做一件事；附改前改后截图，说明怎么验证。

Read `CLAUDE.md` (project conventions for people and AI agents) and `docs/LANDMARK_SPEC.md` first. No names, UI, characters or art from existing games; no real car brands or logos. New assets must be CC0 / CC-BY / MIT (or similar) and listed in `assets/CREDITS.txt`. One change per pull request, with before / after screenshots.

## 授权 / License

Code: MIT (see `LICENSE`). Map data © OpenStreetMap contributors, ODbL 1.0. Third-party libraries, models (CARLA CC BY 4.0, Microsoft Rocketbox MIT), Poly Haven CC0 textures and the AI-generated landmark models: see `assets/CREDITS.txt`.
