# 地标 / 模型模块制作规范

《洛阳城》是一个 Three.js 开放世界 demo，洛阳真实 1:1 比例。每个地标是一个独立的 JS 模块，用代码拼出 3D 模型。
画面是 v2 管线（HDR 天空光、PBR 材质、ACES 色调映射、软阴影、环境光遮蔽，见 `src/core/gfx.js`），所以模型全部走工具库 `src/landmarks/_kit.js`：它负责真实贴图、按米平铺、屋顶/大殿/楼房/树的细节。少数重点地标用 AI 生成的 GLB（由主对话接入），不在本规范内。

## 1. 文件与接口

- 地标：`src/landmarks/<id>.js`，`<id>` 与 `src/data/landmarks.json` 里的一致。该 JSON 里每项的 `brief` 是外观要求，`w` × `d` 是占地（米）。
- 只写你自己批次的文件。**不要改** `_kit.js`、`landmarks.json`、引擎代码或别人的模块。kit 缺功能就在自己模块里用 THREE 直接写；发现 kit 有 bug 写在最终汇报里。

```js
import { THREE, C, mat, box, cyl, plaza, hall, tangRoof, tower, sign, tree, finalize } from './_kit.js';

export const meta = {
  colliders: [ { x: 0, z: -20, w: 30, d: 18 /*, rot: 弧度(可选) */ } ],   // 必填，可为空数组
};

export function build() {
  const g = new THREE.Group();
  // ... g.add(...)
  return finalize(g);       // 必须：按材质合并，减少 draw call
}
```

参考完整示例：`src/landmarks/_example.js`；工具函数全部在 `src/landmarks/_kit.js`（请先通读，注释很短）。

## 2. 坐标约定（重要）

- 单位：米，**真实尺寸**（人高 1.75m，一层楼 3–4m，车道宽 3.5m）。
- 本地原点 = 占地中心的地面点。Y 向上。**正面朝 +Z**。X 轴向右（面对正面时是左手边为 +X……不用纠结：只要保证 brief 里说的“正面/前方”在 +Z、“背后”在 -Z）。
- 引擎会按 `bearing` 把 +Z 转到真实朝向，你不需要管东南西北；brief 中出现“南/北/东/西”时：当 `bearing` = 180 时 +Z=南、-Z=北、+X=东、-X=西；`bearing` = 0 时 +Z=北、-Z=南、+X=西、-X=东；其它角度按 brief 里给的本地坐标描述做。
- kit 里所有带 `(x, y, z)` 的函数，`y` 都是**物体底面**高度（box/cyl/hall/tower… 都“坐”在 y 上）。`sphere` 和 `sign` 例外：是中心点。
- 所有几何必须在占地矩形内：x ∈ [-w/2, w/2]，z ∈ [-d/2, d/2]。
- 地面铺装/水面/草地：用 `plaza()` / `disc()`，高度 y=0.15（城市道路在 y≈0.06，低于它会被路盖住或闪烁）。多层平面叠放时每层至少差 0.05。不要铺满整个占地的不透明大地面，除非它确实是广场——留给城市地面。
- brief 里说“必须留空”的区域（铁轨、河道、门洞通道）不要放实体，也不要放碰撞盒。

## 3. 质量要求

- 目标：**一眼能认出是哪个地标**。先做对整体轮廓和比例、标志性特征（屋顶形式、层数、颜色、匾额/招牌文字），再加细节（柱、窗、台阶、栏杆、树、灯、旗）。
- 传统建筑优先用 kit 的 `hall()`、`tangRoof()`、`roundRoof()`、`pagoda()`、`gableRoof()`：自带瓦垄、瓦当滴水、椽子、垂脊脊兽、正脊鸱吻/宝顶、台基栏杆踏步、柱础、额枋彩画、斗拱、格扇门窗（夜里透光）。不要再自己用方块拼鸱吻、斗拱；歇山等自己接山面时给 `hall({ ornaments: false })`。
- 现代建筑用 `tower(w, h, d, { style })`：立面有真实进深（后退的反光玻璃、窗下墙、墙垛、窗框、逐窗明暗、夜里部分亮灯、女儿墙和屋顶设备）。style：`office` / `grid` / `apartment`（飘窗+空调）/ `mall`（带形窗）/ `glass`（玻璃幕墙）。外轮廓严格等于 w×h×d（只有飘窗/空调外凸 ≤0.7m），顶上再叠东西没问题；不要屋顶构件传 `roof: false`。
- 树用 `tree(x, z, h, kind)`（叶片贴图卡片，约 150 面/棵）：`round` 阔叶、`plane` 法桐、`willow` 柳、`pine` 松、`cypress` 柏、`peonyBush` 牡丹丛。`lamp()` 路灯夜里会亮。
- 招牌、匾额用 `sign(text, w, h, {...})`（支持中文，256px 高清；深色底+金字自动用楷体当匾额；`emissive: true` 夜里发光）。每个 sign 是一次独立 draw call，尽量少用（一般 ≤ 10 个）。
- 预算：单个地标合并后 ≤ 80 个 mesh，三角面一般 1–10 万，上限 30 万；build 时间 < 400ms。圆柱分段数别太高（柱子 8–12 段，大圆体 24–32 段）。大量重复物（树、柱、栏杆）直接 add 多个即可，finalize 会合并；但总数请控制（树 ≤ 150 棵/地标，一个 `hall()` 约 3–6 千面）。
- 材质一律通过 `mat(color, opts)` 获取（有缓存，全部是 PBR），不要自己 `new THREE.MeshXxxMaterial`：
  - `C` 色板的颜色自带质感：`stone/stoneDark/concrete` 石材混凝土、`marble` 汉白玉、`wallWhite/wallCream/wallRed` 灰泥墙、`brickGrey/cityWall` 青砖、`paving/pavingRed` 石铺地、`asphalt` 沥青、`grass` 草地、`tile*` 瓦屋面、`glass*` 反光玻璃、`gold/bronze/steel` 金属、`tangRed/vermilion` 朱漆、`water` 水面（带波纹）。其它任意十六进制颜色 = 该颜色的涂料/抹灰面。
  - `mat(c, { map: patternTex(kind, c) })`：`brick`（偏红=红砖，否则青砖）/ `paving` / `stone` / `tiles` / `roofTile` 会换成染成 c 色的真实贴图；`lattice` 仍是画布格子贴图（配 `tiledBox`）。颜色就是最终颜色，不会再被贴图压暗，不用传"加亮补偿色"。
  - 贴图按真实尺寸平铺由 `finalize()` 统一做（按米投影 UV），自己写的几何体也适用，不需要也不要手调 UV；只有自带 `map` 的画布贴图（`windowTex`、`tex()`、`lattice`）沿用几何体自己的 UV。
  - `opts`：`shiny`（抛光/金属感）、`opacity`、`double`、`emissive`+`emissiveIntensity`（白天微亮，夜景模式才点亮）。过亮的白色会被自动压到不过曝。
- 不要用 `Math.random()`（每次加载结果不同）；需要随机用 `rng(seed)`。
- 不要加灯光、不要加动画循环、不要访问 `window`/`document`（kit 的贴图函数已处理；Node 下会跑检查）。
- 碰撞盒 `colliders`：只包实体建筑主体（墙、楼、塔、山体）。广场、步道、门洞、桥面、水面不要包。玩家会开车/步行穿过。

## 4. 自检（必须）

```bash
node tools/check-landmark.mjs <id1> <id2> ...
```
必须全部 ✓。它检查：能否 build、尺寸是否超占地、面数（≤30 万）、mesh 数（≤80）、colliders。Node 下没有贴图，kit 自动退化成纯色，所以不要依赖 `material.map` 一定存在。

目测（如果你有 `mcp__Claude_Browser__*` 浏览器工具，强烈建议做；没有就跳过）：预览服务器已在运行（端口以任务说明为准，`npm start` 默认 5188；一定要确认它服务的是本项目目录）。预览页和游戏用同一套渲染。
1. `tabs_create` 新建**你自己的标签页**，记住返回的 tabId；之后每次调用都带上这个 tabId。**绝对不要**操作、导航或关闭别的标签页（别的智能体在用）。
2. `navigate` 到 `http://localhost:<端口>/preview.html?id=<id>&view=iso`（view 可选 `front` `back` `left` `right` `top` `iso` `iso2` `low`；`&dist=0.5` 拉近；`&tx= &ty= &tz=` 平移观察点；`&night=1` 夜景；`&q=high|medium|low` 画质；`&colliders=1` 显示碰撞盒）。
3. 等标题变成 `ready`（约 3 秒，贴图要加载）后 `computer` `screenshot`（建议 `scale: 0.5`），看效果、改代码、再看。每个地标至少看 `iso` 和一个拉近的 `low`。左上角文字若以 `ERROR` 开头说明模块报错。重点看：过曝发白、贴图发黑、屋顶和墙穿插、闪烁。
4. 完成后用 `tabs_close` 关掉你自己的标签页。
浏览器调用连续失败 2 次就放弃目测，只靠 check 脚本。

## 5. 载具 / 人物模型（`src/models/*.js`，仅 K 批次）

见各自任务说明。预览：`preview.html?model=cars&fn=buildCar&args=["sedan"]`。

## 6. 最终汇报

列出：完成的 id、check 脚本的输出行、是否做了目测、没做完或不确定的地方。不要粘贴代码。
