# GitHub 调研：用代码生成、而且确实好看的 3D 城市方案

调研日期：2026-11-14。只做了调研，没有改任何代码、没有安装或下载任何东西。
核对方式：仓库是否存在、星标数、许可证、最近更新时间，都是当天用 GitHub 接口查的；实现细节是直接读仓库里的 README、`package.json`、许可证文件和部分源码。没查到的统一写在第四节"未核实"。

读法：第一节是给 David 看的结论；第二节起是给接手工程师的线索。

---

## 一、结论先行

### 先说一个不讨喜的事实

**没有哪个开源项目是"装上就变 GTA4"的。** 这次把最有名的几个都看了：

- 最常被提到的 streets.gl，楼房其实也是"贴窗户贴图的盒子"，它好看主要靠三样：**屋顶有形状**、**贴图质量高**、**整套光影后期很讲究**（大气、阴影、反射、抗锯齿）。而且它是自己从零写的渲染引擎，不是 Three.js，整套搬不过来。
- 真正好看的那几个（东京、纽约、旧金山联合广场，见下）共同点是：**① 用一小套"立面零件"（窗、阳台、檐口、店面、空调）按规律拼楼，而不是每栋楼现算；② 重点街区单独写"立面说明书"，其余自动生成；③ 车、人、树直接用现成的开源模型或开源生成器；④ 光影后期用的是同一套成熟的开源组合；⑤ 每做一步都截图和真实照片对比。**
- David 说的"GitHub 上很多建模都是代码建的，很漂亮"，这次找到了对应的东西：`PhiloLabs/fable51-worlds`（整条街用代码生成）、`img2threejs`（照着图片用代码建模，2.1 万星）、`scottstts` 的 Three.js 画面技能包。它们漂亮的范围都是**一个物体或几百米见方的一片街区**，而且背后有一套"建模 → 截图 → 对比 → 返工"的流程。我们是 27 公里见方的整座城，所以现实的路线是：**全城用"零件拼装"提升下限，重点街区和地标用这套流程提升上限。**

### 最推荐做的 5 件事（按"画面提升 ÷ 工作量"排序）

| 顺序 | 做什么 | 能带来什么变化 | 工作量 | 风险 |
|---|---|---|---|---|
| 1 | **光影后期换成"东京/纽约项目同款组合"**：`postprocessing` + `N8AO`（环境光遮蔽）+ 级联阴影（Three.js 自带，我们 `vendor` 里已经有）+ 可选 takram 大气 | 远处有空气感、近处远处阴影都清楚、暗角更干净，而且比现在的做法更省性能。**"整体画面感"和"流畅度"两条同时改善** | 中（主要改 `src/core/gfx.js` 一个文件） | 低，都是宽松许可，都支持我们现在的 Three.js 版本 |
| 2 | **树换成 ez-tree**（开源的 Three.js 树木生成器） | 树从"自己拼的枝叶"变成有真实树形、树皮、叶片、自带远近切换的树。东京和纽约两个项目都在用它 | 小（一个文件放进 `vendor/`） | 低（MIT 许可） |
| 3 | **车和行人改用现成的开源模型**（带骨骼动画）：行人用微软 Rocketbox（MIT）或 Quaternius（CC0）；车用 CARLA 自动驾驶模拟器的车（CC BY 4.0，需署名） | 人有衣服褶皱、手指、真实走路动画；车是真正的车模。这是"树人车"里最立竿见影的一项 | 中（要转换格式、压缩、接进现有车流和行人系统） | **需要 David 拍板**：这不是"代码建模"而是用现成模型；CARLA 的车长得像真实品牌车型，见第三节 |
| 4 | **改进"AI 写代码建模"的方法**：装上 scottstts 的 Three.js 画面技能包；学 fable51-worlds 的流程（固定机位截图和真实照片并排对比、让另一个智能体当评审、建模的不给自己打分）；地标可试 img2threejs | 以后每一批地标、楼房、车辆的代码建模质量整体上一个台阶，而不是每次凭印象做 | 小（装技能包 + 改派活说明） | 低；效果要试了才知道 |
| 5 | **普通楼房改成"立面零件 + 立面说明书"的拼装做法**，窗户加"假室内"（看进去有房间），屋顶用 streets-gl 的屋顶算法；先做应天门—丽景门—老城这类重点街区，其余自动套用 | 楼房从"盒子上加细节"变成有檐口、窗套、阳台、店面层次的建筑；夜里窗户里看得到房间。**这是离 GTA4 观感差距最大的一块，上限最高** | 大（要重写 `src/world/buildings.js` 的近景部分，并做一套零件库） | 中；有三个可以直接参考的开源实现，其中一个正好做了"中国式住宅楼"（带底商、封闭阳台、空调外机、晾衣架） |

### 明确不建议做的

- **整套换成 streets-gl / Cesium / 谷歌实景三维**：前者是另一套引擎；后两者需要账号和联网，条款不允许离线保存，谷歌实景三维在中国大陆的覆盖也没核实到。
- **`realism-effects`（全局光照特效库）**：2024 年 2 月后没更新，要求的 Three.js 版本比我们旧很多，大概率跑不起来。
- **现在就迁到 Three.js 的新渲染器（WebGPU）**：Three.js 官方 2026 年 6 月加了一个很漂亮的"程序化城市生成器"，但只能在新渲染器上跑；迁过去等于把现有材质和后期全部重写。建议只借鉴它的做法，先不迁。

---

## 二、分方向明细

说明："能否直接用"指能不能在**不加构建步骤、Three.js r170** 的前提下放进 `vendor/` 用 importmap 引用。星标为 2026-11-14 当天数字。

### 方向 1：基于 OSM 的实时 3D 城市

| 仓库 | 许可证 | 好在哪 | 能否直接用 | 坑 |
|---|---|---|---|---|
| [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl)（约 1100 星，最近更新 2025-08） | 代码 MIT | 屋顶形状最全（平顶、双坡、四坡、孟莎、穹顶、洋葱顶等十几种，见 `src/lib/tile-processing/tile3d/builders/roofs/`）；延迟渲染 + TAA + SSAO + 屏幕空间反射 + 景深 + 大气 | **不能整套用**（自研 WebGL2 引擎，TypeScript + webpack，不是 Three.js）。屋顶算法、墙面 UV 算法（`WallsBuilder.ts`）是纯数学，可以移植 | 墙面就是"每层一排窗户贴图"的平面，没有立体进深。**素材不能拿**：模型的署名文件指向 Steam 创意工坊条目，没有许可证；立面/屋顶贴图没有任何来源说明。README 自己写"需要独立显卡才流畅" |
| [jeantimex/tokyo](https://github.com/jeantimex/tokyo)（158 星，2026-10 更新） | 代码 MIT | **和我们最像的项目**：真实轮廓 + 代码补细节（按用途贴立面、每面墙配窗、假室内、女儿墙、屋顶设备、阳台、招牌带、车道线、斑马线、红绿灯、车流、昼夜、水面倒影、玻璃反射）。技术栈就是结论第 1、2 条那一套 | 代码要 Vite 构建，不能整套搬；**做法和单个文件可以抄**（`src/world/` 下 `meshing.js`、`materials.js`、`lamplight.js`、`reflections.js`、`mirror.js`） | 它的楼好看有一半靠日本官方三维城市数据（带屋顶形状和航拍贴图），洛阳没有这种数据。用的是 Three.js r186 |
| [mkturkcan/valdrada](https://github.com/mkturkcan/valdrada)（270 星，2026-11 更新，原名 boundless-nyc） | 代码 MIT；模型 CC BY 4.0 / MIT；贴图 CC0 | 纽约全城 108 万栋楼，Three.js 渲染。立面分类型套细节、重点街区单独建、高楼用"塔楼零件库"、512m 近景瓦片 + 2048m 远景瓦片流式加载、车流和行人模拟。**是"整城规模 + 近景精细"最完整的开源参考** | 整套不能搬（Vite，r185）；做法可抄：`client/src/world/towerKit.js`、`heroFacades.js`、`streamer.js`，`client/src/city/roofEngine.js`、`instancer.js`，`client/src/lod/` | 代码量非常大，很多是纽约专用。它的车和人模型见方向 5 |
| [tordanik/OSM2World](https://github.com/tordanik/OSM2World)（约 800 星，2026-11 更新） | 代码 MIT；配套素材库 [OSM2World-default-style](https://github.com/tordanik/OSM2World-default-style) 为 CC0 | 老牌的"OSM 转三维模型"工具，可离线把一片 OSM 数据直接导出成 glTF/GLB 或 3D Tiles，带 PBR 贴图，细节分 0–4 级 | 是 Java 命令行工具，**可以当离线工具试一次**：把洛阳一小片导出成 GLB，和我们自己生成的楼并排比一比。它也有浏览器版 JS 模块，但官方说还是试验性质、只适合小数据量 | 观感没实测；它的 CC0 贴图库（来自 ambientCG 和 OSM 社区）可以直接拿来用 |
| [Beakerboy/OSMBuilding](https://github.com/Beakerboy/OSMBuilding)（约 100 星，2026-01 更新） | MIT | 用 Three.js 渲染单栋 OSM 建筑（含屋顶形状）的小项目，移植屋顶时比 streets-gl 更贴近我们的技术栈 | 可参考 | 没细读 |
| [OSMBuildings/OSMBuildings](https://github.com/OSMBuildings/OSMBuildings)（约 1000 星，2021 年后没更新） | BSD 风格（GitHub 没识别出类型，原文是 BSD 式条款） | 历史上最早的 OSM 3D 楼房查看器 | 不值得用 | 纯色体块，观感不如我们现状 |
| [CesiumGS/cesium](https://github.com/CesiumGS/cesium)（1.6 万星）+ Cesium OSM Buildings | 引擎 Apache-2.0；数据要 Cesium ion 账号，数据本身 ODbL | 全球楼房体块 | 不适用 | 另一套引擎；楼是素体块；离线使用要付费的自托管版 |
| [NASA-AMMOS/3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS)（约 2500 星，2026-11 更新） | Apache-2.0 | 在 Three.js 里加载 3D Tiles（含谷歌实景三维）；要求 three ≥ r167 | 库本身可用，但我们没有合适的数据源 | 谷歌实景三维需要 API 密钥，条款不允许离线缓存，中国大陆覆盖未核实 |
| [visgl/deck.gl](https://github.com/visgl/deck.gl)（1.5 万星） | MIT | 数据可视化用的楼房拉伸 | 不适用 | 不是给游戏画面用的 |
| F4map | 闭源 | 观感不错的 OSM 3D 地图网站 | 不能用 | GitHub 上没找到开源仓库 |

### 方向 2：程序化建筑 / 立面生成

| 仓库 | 许可证 | 好在哪 | 能否直接用 | 坑 |
|---|---|---|---|---|
| [mrdoob/three.js](https://github.com/mrdoob/three.js) 官方 `examples/jsm/generators/`（2026-06 加入，属于 r185 及以后） | MIT | 官方出的程序化城市：砖墙、风化、窗间柱、窗框、檐口、空调外机、店面、雨棚、**窗户里有假房间**；还附带路灯、红绿灯、长椅、树、车、人的生成器。**每栋楼烘成一个几何体、一次绘制**（顶点上带"零件编号"，一个材质按编号分别上色） | **不能直接用**：材质全是新渲染器（WebGPU / TSL）写法，r170 的老渲染器跑不了 | 几何生成部分（`city/SkyscraperGenerator.js`）是普通 Three.js 代码，可以移植；"一栋楼一次绘制 + 顶点零件编号"这个做法值得照抄，对流畅度帮助大 |
| [achrefelouafi/ProceduralBuildingsThreeJS](https://github.com/achrefelouafi/ProceduralBuildingsThreeJS)（133 星，2026-09 更新） | MIT；贴图来自 ambientCG / Poly Haven（CC0） | 把 Blender 几何节点做的楼"翻译"到浏览器里，有三种：巴黎奥斯曼式、纽约战前转角楼、**中国式转角住宅楼（底商、封闭阳台、空调外机、晾晒衣物、楼顶招牌）**。窗后有亮灯房间和窗帘。零件导出成一个实例化的 GLB 零件包 | 代码要 Vite + TypeScript、three r185，不能直接放；**零件库思路和 .blend 源文件可以用**（我们已有 Blender 工具链） | .blend 文件用 Git LFS 存，约 380MB；`blender/textures/misc/` 里少数图片（纽约室内图集等）来源没写明 |
| [PhiloLabs/fable51-worlds](https://github.com/PhiloLabs/fable51-worlds)（531 星，2026-09 更新） | MIT | 整片街区全用代码生成，不下载任何模型。旧金山联合广场：453 栋楼、75 栋手写立面说明书、其余自动推导；用 Blender 脚本离线生成 206 个零件（窗、檐口、店面、路灯、车、行人身体部件），总共才 5.1MB。**流程最值得学**：先调研、离线出零件、按 JSON 说明书拼立面、固定 34 个机位和真实照片对比、9 个独立评审智能体打分 | 是 Vite + TypeScript 项目，不能直接放；`src/world/facade/`（说明书 → 几何体）和 `tools/bpl/`（Blender 出零件）可以照着写 | 范围只有 800×720 米；每个世界的渲染是专门写的 |
| [codedgar/three-fenestra](https://github.com/codedgar/three-fenestra)（82 星，2026-06 更新，v0.3.0） | MIT | "假室内"材质：一块平面窗户看进去有立体房间，带窗帘、百叶、脏玻璃层，支持昼夜亮灯；整面墙实例化只要一次绘制 | **大概率能直接用**：要求 three ≥ r150，是标准材质的子类 | 还没到 1.0 版；需要一张房间图集贴图；没实测 |
| [StrandedKitty/straight-skeleton](https://github.com/StrandedKitty/straight-skeleton)（90 星） | 仓库标 MIT，但见右 | 给任意多边形轮廓生成四坡屋顶所需的"直骨架"，streets-gl 的屋顶就靠它 | 有风险 | 当前版本是把 CGAL 库编译成 WebAssembly 包了一层，而 CGAL 的直骨架模块本身是 GPL（未逐字核实）。它的 `v1` 分支是纯 TypeScript 重写，更安全 |
| [scottstts/Threejs-Awesome-Graphics-Agent-Skills](https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills)（约 1000 星，2026-10 更新） | MIT | 给 AI 编程助手用的 Three.js 画面技能包（支持 Claude Code）：程序化建筑（体量与立面语法、零件、材质槽）、程序化植被、阴影系统、环境光遮蔽、泛光、曝光调色、大气、体积云、画面验证等二十多项，附带示例库 | 是技能包，不是运行库，装到开发环境里用 | 不少示例是新渲染器写法，要挑着用 |
| [img2threejs/img2threejs](https://github.com/img2threejs/img2threejs)（2.1 万星，2026-11 更新） | Apache-2.0 | 照着一张参考图，用纯代码重建成 Three.js 模型，带质量关卡；在线画廊里每个模型都能看源码 | 是工作流/工具，产出的是普通 Three.js 代码 | 擅长单个物体和角色，不是整城；适合地标、雕像、车辆这类单体 |
| [instruktlabs/kiln](https://github.com/instruktlabs/kiln)（328 星，2026-11 更新） | MIT | 让 AI 写 JS 建模，工具负责渲染多角度预览、做结构检查、导出 GLB | 开发期工具 | 和我们现有的 `_kit.js` + 预览页思路重叠，可借鉴它的"结构检查" |
| Blosm（[vvoovv/blosm](https://github.com/vvoovv/blosm)，约 2200 星） | **【红线·GPL】** 源码 GPL；带贴图的 Pro 版要付费 | Blender 里一键导入 OSM 城市 | **不能把代码或它带的素材放进项目** | 只能当离线看效果的工具 |
| Buildify（Gumroad 上的 Blender 几何节点建筑库） | 免费下载，**许可证条款没查到** | 用零件库沿轮廓自动拼楼 | 未核实前不要用它的素材 | 2022 年发布，针对 Blender 3.2 |
| [ProbableTrain/MapGenerator](https://github.com/ProbableTrain/MapGenerator)（约 1500 星） | **【注意·LGPL-3.0】** | 生成虚构的美式城市路网 | 不需要（我们用真实路网） | — |

### 方向 3：树和植被

| 仓库 | 许可证 | 好在哪 | 能否直接用 | 坑 |
|---|---|---|---|---|
| [dgreenheck/ez-tree](https://github.com/dgreenheck/ez-tree)（约 1800 星，v1.1.0） | MIT | 几十个参数的程序化树，带树种预设、树皮和叶片贴图、**自带远近多级细节**（`generateLODs()`），也能导出 GLB。tokyo 和 valdrada 都在用 | **能**：要求 three ≥ r167；发布包里 `build/ez-tree.es.js` 是单个文件（约 4MB，贴图已内嵌） | 每棵树单独生成会慢；应当每个树种生成几个变体，再用实例化铺满全城（我们有 20 万棵树） |
| Three.js 官方 `TreeGenerator.js` / `ForestGenerator.js`（r185 以后） | MIT | 枝干生成算法讲究（黄金角分枝、重力下垂、根部外扩） | 不能直接用（新渲染器写法），算法可借鉴 | 只生成枝干，叶片要另做 |
| Valdrada 数据集里的树（`trees36`、`bxtrees`） | CC BY 4.0（叶和树皮贴图 CC0） | 现成的 GLB 行道树 | 可用，需署名 | 是纽约树种 |
| Poly Haven 的植物模型 | CC0 | 照片扫描级的树、灌木 | 可用 | 面数高，要先简化；具体有哪些树种没逐个看 |
| 草地：[simondevyoutube/Quick_Grass](https://github.com/simondevyoutube/Quick_Grass)（233 星，MIT）、[thebenezer/FluffyGrass](https://github.com/thebenezer/FluffyGrass)（208 星，MIT） | MIT | 实例化草叶 + 风动 | 可参考 | 开车游戏里草地优先级低，建议只在公园近景考虑 |
| [supereggbert/proctree.js](https://github.com/supereggbert/proctree.js) | **无许可证** | 老牌树生成器 | **不能用** | 没有许可证等于保留所有权利 |

### 方向 4：渲染质量与性能

我们现在的做法（`src/core/gfx.js`）：Three.js 自带的后期合成器 + GTAOPass + UnrealBloomPass + SMAA，单张阴影贴图，指数雾，静态 HDR 天空。

| 仓库 | 许可证 | 好在哪 | 能否直接用（无构建 + r170） | 坑 |
|---|---|---|---|---|
| [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)（约 3000 星，v6.39.6，2026-11 更新） | Zlib（宽松） | 把多个特效合并成一遍绘制，比 Three.js 自带的合成器省；泛光、抗锯齿、色调映射、景深都有 | **能**：要求 three r168–r187；`build/index.js` 是单文件 ES 模块 | 要把现有的后期链整体换过去，不能和自带合成器混用 |
| [N8python/n8ao](https://github.com/N8python/n8ao)（约 500 星，v2.0.2，2026-11 更新） | GitHub 显示 CC0，npm 包标 ISC（都是宽松许可） | 目前 Three.js 圈公认又快又稳的环境光遮蔽；有半分辨率模式（快 2–4 倍）和多档画质预设 | **能**：要求 three ≥ r137，下载 `dist/N8AO.js` 即可 | README 说明环境里必须同时有 `three` 和 `postprocessing` 两个包名，importmap 里两个都要配；还不支持新渲染器 |
| Three.js 自带 CSM（级联阴影，`three/addons/csm/CSM.js`） | MIT | 近处阴影清晰、远处也有阴影，开放世界必备 | **已经在我们的 `vendor/three/addons/csm/` 里**，只是还没用 | 要给所有受光材质调用它的 `setupMaterial`；每多一级级联就多画一遍阴影，需配合"远景不投影" |
| [takram-design-engineering/three-geospatial](https://github.com/takram-design-engineering/three-geospatial)（约 1800 星） | MIT | 物理正确的天空、**大气透视**（远处发蓝发灰）、体积云（能投影到地面）；tokyo 项目在用 | 要求 three ≥ r170、postprocessing ≥ 6.36.7，版本对得上；但它依赖好几个子包，**需要一次性打包成单文件**后放进 `vendor/` | 包声明里列了 React 相关依赖；tokyo 项目不用 React 也在用它，说明纯 Three.js 可行，但我们没实测。体积云比较吃性能，建议只在"高"画质开 |
| [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)（约 3600 星，2026-11 更新） | MIT | 加速射线检测和空间查询（车辆/人物碰撞、点选） | 能（three ≥ r159）；源码是多文件，放整个 `src/` 目录或打包一次 | 只在碰撞检测是瓶颈时才需要 |
| [agargaro/instanced-mesh](https://github.com/agargaro/instanced-mesh)（487 星）、[agargaro/batched-mesh-extensions](https://github.com/agargaro/batched-mesh-extensions)（144 星） | MIT | 给实例化网格加上逐个视锥剔除、远近细节切换、排序；适合 20 万棵树、几万个街道设施 | **最新版要求 three ≥ r186**，r170 要找旧版本（哪个旧版本支持没核实） | 也可以不用它，自己按 400m 地块剔除（我们已经是这么做的） |
| Three.js 自带 `BatchedMesh` | MIT | 不同形状的楼合成一次绘制，还能逐个隐藏 | r170 核心里就有 | 我们是否已经在用没查 |
| [0beqz/realism-effects](https://github.com/0beqz/realism-effects)（约 1750 星） | MIT | 屏幕空间全局光照、运动模糊、时间抗锯齿 | **不建议**：2024-02 后没更新，要求 three r151 | 与 r170 大概率不兼容 |
| Three.js 自带 `Sky.js` / `Water.js` | MIT | 程序化天空、带反射的水面 | 已在 `vendor/` | Water 会把场景多画一遍，注意性能 |

性能方面值得照抄的做法（来自 tokyo / valdrada / Three.js 官方城市生成器）：

- 瓦片在 Web Worker 里生成几何体，主线程不卡（tokyo：256m 瓦片）。
- 一栋楼（或一个地块）烘成一个几何体，用顶点属性区分墙、窗框、玻璃、空调等，一个材质一次绘制。
- 几千盏路灯不用真灯：把路灯和车灯画成俯视的"光斑图"，地面材质去读这张图（tokyo 的 `lamplight.js`）。
- 近景瓦片 + 更粗的远景瓦片两套（valdrada：512m / 2048m）。

### 方向 5：车辆和人物

| 来源 | 许可证 | 内容 | 怎么拿 | 坑 |
|---|---|---|---|---|
| [microsoft/Microsoft-Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox)（655 星，仓库已归档） | **MIT** | 115 个带骨骼的写实人物（多种职业、年龄、体型），每个有高/中/低/超低四档面数，另有 417 段动画 | GitHub 直接下载 | 原始格式是 FBX / 3ds Max，要用 Blender 转成 GLB（我们有 Blender 工具链）；都是欧美面孔和着装为主，没有汉服 |
| CARLA 自动驾驶模拟器的车辆和行人（[carla-simulator/carla](https://github.com/carla-simulator/carla)，1.5 万星） | 代码 MIT，**素材 CC BY（需署名）** | 轿车、SUV、面包车、出租车、警车、公交、消防车、救护车、卡车等 | 原始是虚幻引擎格式；**Valdrada 的公开数据集里有转好的 GLB**（Hugging Face `mehmetkeremturkcan/valdrada` 的 `Content/models/fleet24/`，33 个文件，每个 0.4–17MB） | 文件偏大，要先简化压缩；不少车是照着真实品牌车型做的（文件名就叫 mustang、mini、model3、mercedes 等），**涉及商标观感，要不要用请 David 定**；出租车和警车是纽约涂装，要重新上色。它的"照片级行人"含 Epic MetaHuman 成分，有额外限制，**不要用那一组** |
| Quaternius（quaternius.com） | **CC0** | Universal Base Characters（基础人体）+ Universal Animation Library（120 多段动画，第二辑 130 多段），有 glTF 格式，共用一套骨骼 | 官网 / itch.io 免费下载，不用账号 | 风格偏简洁，不算写实；它有没有单独的车辆包没核实到 |
| Kenney Car Kit（kenney.nl） | **CC0** | 45 个文件的车辆包 | 官网免费下载 | 玩具车风格，离 GTA4 观感远，只适合当远景或占位 |
| Poly Haven（polyhaven.com） | **CC0** | 贴图、HDR 天空、照片扫描模型（我们已在用它的贴图） | 免费下载，不用账号 | 车辆和人物很少 |
| Sketchfab | **每个模型单独看**：CC BY 可用但要署名；**【红线·NC】CC BY-NC 不能用于将来可能商用的项目** | 数量最多，写实车辆和人物都有 | 需要账号才能下载 | 必须逐个模型确认许可证并记录署名；这次没有筛出具体可用的模型清单 |
| Mixamo（Adobe） | Adobe 自己的条款，**不是开源许可** | 大量人物和动作，可以给自己的人物自动绑骨骼 | 需要 Adobe 账号，在网站上逐个下载 | 按 Adobe 论坛引用的官方问答：可以用在游戏里（含商用），但**不能把原始文件单独再分发**。如果项目代码公开放在 GitHub，模型文件跟着公开就踩线了。条款原文没直接核实到 |
| [pmndrs/market](https://github.com/pmndrs/market)（286 星） | 索引代码 MIT，素材标注为 CC0 | 一个 CC0 模型/材质/HDRI 的集合站 | 网站下载 | 没逐个看里面有什么 |

### 方向 6：现成的"可开车的 Three.js 城市"开源 demo

| 仓库 | 许可证 | 画面与技术栈 | 对我们的价值 |
|---|---|---|---|
| [mkturkcan/valdrada](https://github.com/mkturkcan/valdrada) | MIT | 见方向 1。有车道级车流（跟车模型、红绿灯相位、转弯规划）、沿人行道走的行人、公交和地铁 | 最接近"GTA 式城市"的开源技术参考，车流和行人逻辑可借鉴 |
| [skirep/Cabrils-OpenWorld](https://github.com/skirep/Cabrils-OpenWorld)（0 星，2026-10 更新） | MIT | 西班牙小镇 3.5×3.1 公里，真实楼房体量 + OSM 道路 + 真实地形；步行、开车、车流、行人、警车追逐、小地图、送货任务；CC0 照片贴图 | 和我们玩法几乎一样的小项目，可以看它怎么处理地形起伏上的道路和手机触屏操作 |
| [brunosimon/folio-2025](https://github.com/brunosimon/folio-2025)（约 2000 星，2026-11 更新）、[folio-2019](https://github.com/brunosimon/folio-2019)（约 4700 星） | MIT | 知名的"开小车逛作品集"，卡通风格；2025 版用 Rapier 物理引擎 | 车辆手感和物理做法可参考，画面风格不是我们要的 |
| [pmndrs/racing-game](https://github.com/pmndrs/racing-game)（约 2200 星，2023 年后没更新） | MIT | React Three Fiber + cannon 物理的赛车小游戏 | 车辆物理参考 |
| [swift502/Sketchbook](https://github.com/swift502/Sketchbook)（约 1750 星，已归档） | MIT | 第三人称角色 + 上下车 + 多种载具的控制器，cannon 物理 | 上下车、镜头、角色状态机的经典参考 |
| [RRG314/WorldExplorer3D](https://github.com/RRG314/WorldExplorer3D)（31 星） | **【红线】自定义"源码可见"许可，保留所有权利** | 在真实地点开车、飞行、航海 | **只能看，不能拿任何代码或素材** |
| [Vogadero/ThreeD](https://github.com/Vogadero/ThreeD)（0 星） | **无许可证** | 上海全境三维沙盘，24 万栋楼、379 个手工地标，零构建 | 和我们架构最像（零构建 + 地标逐个代码建模），**只能看思路** |
| [mauriciopoppe/Three.js-City](https://github.com/mauriciopoppe/Three.js-City)（238 星，2017） | 未识别 | 很早的可开车小城市 | 过时，不用看 |
| 物理引擎：[isaac-mason/crashcat](https://github.com/isaac-mason/crashcat)（473 星，MIT）、Rapier（Apache-2.0）、[pmndrs/cannon-es](https://github.com/pmndrs/cannon-es)（约 2100 星，MIT） | 见左 | 如果以后想要更真实的车辆物理（悬挂、碰撞翻滚） | 目前我们是自写的简化物理，不急 |

---

## 三、只能借鉴做法、不能拿代码或素材的

| 对象 | 原因 | 能做什么 |
|---|---|---|
| **Blosm / blender-osm** | **【红线·GPL】** 代码 GPL；Pro 版素材付费 | 只能在本机 Blender 里当工具看效果，产物和代码都不要进项目 |
| **streets-gl 的模型和贴图** | 模型署名指向 Steam 创意工坊，没有许可证；贴图没有来源说明 | 代码是 MIT 可以移植；素材一律不拿，用 Poly Haven / ambientCG / OSM2World 的 CC0 贴图代替 |
| **straight-skeleton 当前版本** | 内部包了 CGAL 的直骨架模块（该模块为 GPL，未逐字核实） | 用它的 `v1` 纯 TypeScript 分支，或自己实现 |
| **RRG314/WorldExplorer3D** | **【红线】** 自定义"源码可见"许可，保留所有权利 | 只能玩它的在线版找灵感 |
| **Vogadero/ThreeD、obecerra3/OpenWorldJS、proctree.js** | 没有许可证文件，等于保留所有权利 | 只能看思路 |
| **Sketchfab 上标 CC BY-NC 的模型** | **【红线·NC】** 禁止商用 | 不用；只用 CC0 或 CC BY 的，并把署名记到 `assets/CREDITS.txt` |
| **Mixamo 的人物和动作** | Adobe 条款不允许把原始文件再分发 | 可以用在不公开源文件的成品里；如果仓库要公开，模型文件不能跟着公开 |
| **CARLA 的"照片级行人"** | 含 Epic MetaHuman 成分，有额外限制 | 不用这一组；用 Rocketbox（MIT）或 Quaternius（CC0） |
| **谷歌实景三维 / Cesium ion 数据** | 要账号和密钥，条款不允许离线保存 | 不用 |
| **Buildify** | 许可证条款没查到 | 核实前只看做法 |
| **F4map** | 闭源 | 只能看效果 |

需要署名才能用的（不是红线，但发布时必须写进署名）：CARLA 车辆和 Valdrada 自制模型（CC BY 4.0）、OpenStreetMap（ODbL，已有）、Sketchfab 上的 CC BY 模型。

---

## 四、没核实的地方

1. 所有库都**只核对了版本要求和文件结构，没有在我们的项目里实际跑过**。尤其是：N8AO、postprocessing、ez-tree 用 importmap 直接引单文件是否一次就通；takram 大气不带 React 的用法；three-fenestra 在 r170 上的表现。
2. 各项目的**实际帧率**都没测。streets-gl 明说要独立显卡；Three.js 官方城市示例在 M2 Pro 上单栋楼约 44–60 帧（来自它的合并请求讨论）。
3. **CGAL 直骨架模块是 GPL** 这一点是凭已有了解写的，没有打开 CGAL 的许可证页逐字核对。
4. **Mixamo 条款**只看到 Adobe 论坛里对官方问答的转述，没读到条款原文。
5. **谷歌实景三维是否覆盖中国大陆**、缓存条款原文：没查到。
6. **Buildify 的许可证**：Gumroad 页面摘要里没有；SceneCity（Blender 商业插件）这次没查。
7. **Quaternius 有没有车辆包**：只确认了人物和动画包是 CC0，车辆包没找到官方页面。
8. **Poly Haven 具体有哪些树、车、人模型**：只确认了全站 CC0。
9. **OSM2World 导出的楼房实际观感**（有没有立体窗户、道路标线细到什么程度）：没实测，官方文档页没写。
10. **Valdrada 数据集里 Rocketbox 行人（`peds24/rb27`）的具体文件格式和数量**：只看到目录存在和 MIT 标注。
11. **streets-gl 模型署名里的 Steam 创意工坊条目属于哪款游戏**：没点开看。
12. **@three.ez/instanced-mesh 哪个旧版本支持 r170**：没查。
13. `achrefelouafi/ProceduralBuildingsThreeJS` 的 `blender/textures/misc/` 里图片的来源、`sloemo01/diorama`（506 星，MIT）和 `Beakerboy/OSMBuilding` 的内容：没细读。
14. Sketchfab 上**具体哪些写实车辆/行人模型**是 CC0 或 CC BY：这次没有筛出清单，需要有账号后逐个看。
15. 洛阳有没有类似日本 PLATEAU、纽约市政数据那样带屋顶和层数的公开建筑数据：没查（tokyo 和 valdrada 好看有一部分靠这种数据）。

---

## 五、给接手工程师的落地线索

**关于"无构建"**：下面这些库的发布包本身就是单个 ES 模块文件，只 `import 'three'`（N8AO 还会 `import 'postprocessing'`），所以把文件放进 `vendor/`，在 `index.html`、`preview.html` 等页面的 importmap 里各加一行即可，运行时仍然没有构建步骤：

- `postprocessing` → `build/index.js`
- `n8ao` → `dist/N8AO.js`
- `@dgreenheck/ez-tree` → `build/ez-tree.es.js`
- `three-fenestra` → `dist/index.js`（没确认是不是单文件）

takram 的三个包和 `three-mesh-bvh` 是多文件或带子依赖的，需要在开发机上用打包工具**一次性**打成单文件再放进 `vendor/`（这是准备素材，不是给项目加构建步骤）。

**关于 Three.js 版本**：我们是 r170，官方最新是 r187（2026-10-30）。上面推荐的库都兼容 r170。`postprocessing` 当前版本要求 three < r188，以后升级 Three.js 时两者要一起看。官方城市生成器、Meshlet、SSGI、TRAA 都只在新渲染器（`three/webgpu`）里，建议作为以后单独评估的事项。

**建议的验证顺序**（每步都能单独看到效果、单独回退）：

1. `src/core/gfx.js`：先只把 GTAOPass 换成 N8AO（半分辨率），对比同一机位的截图和 `renderer.info`。
2. 接着把合成器换成 pmndrs `postprocessing`，把泛光、抗锯齿、色调映射合成一遍。
3. 加 CSM（3 级），远处地块的楼不投影。
4. `src/world/props.js`：用 ez-tree 每个树种预生成 3–4 个变体 × 3 级细节，沿用现有的实例化和远景贴图片。
5. 楼房：先在 `proc-demo.html` 里做一栋"零件拼装 + three-fenestra 假室内"的样板楼，David 看过满意再铺开。
6. 车和人：等 David 对第三节里的许可和品牌问题拍板后再动。

**可以直接读的参考文件**：

- 立面说明书 → 几何体：`PhiloLabs/fable51-worlds` 的 `union-square-sf/src/world/facade/`、`union-square-sf/src/data/facades/`
- Blender 离线出零件：同仓库 `union-square-sf/tools/bpl/`
- 照片对比验收：同仓库 `union-square-sf/tools/qa/capture.mjs`、`compare.mjs`
- 屋顶：`StrandedKitty/streets-gl` 的 `src/lib/tile-processing/tile3d/builders/roofs/`
- 一栋楼一次绘制：`mrdoob/three.js` 的 `examples/jsm/generators/city/SkyscraperGenerator.js`（看 `PartId` 和 `bakeGroups`）
- 中国式住宅楼零件：`achrefelouafi/ProceduralBuildingsThreeJS` 的 `blender/CN_ApartmentBuilding.blend`、`src/cn/`、`public/assets/cn/`
- 夜景路灯光斑图、水面倒影、玻璃反射：`jeantimex/tokyo` 的 `src/world/lamplight.js`、`mirror.js`、`reflections.js`
- 整城流式加载与远景：`mkturkcan/valdrada` 的 `client/src/world/streamer.js`、`client/src/lod/`
