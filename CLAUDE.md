# 洛阳城（luoyang-city）

洛阳真实 1:1 比例的开放世界驾驶/探索 demo，浏览器里运行（Three.js，无构建步骤）。
玩法类型参考开放世界驾驶游戏，但**不使用任何现有游戏的名称、界面、角色或美术**。

## 和 David 协作
- David 不写代码。说明、提问、汇报一律中文，少用术语；结尾的话要完整、能单独看懂。
- 改完自己验证（跑检查脚本 + 浏览器截图），不要让 David 替你测。
- 产品决定（玩法、范围、名字）先问；技术细节自己定。
- 开工先读 `docs/STATUS.md`，收尾时更新它。

## 运行与验证
- 启动：`npm start`（= `node tools/server.mjs`，端口 5188）→ http://localhost:5188
- 地标检查：`node tools/check-landmark.mjs --all`（必须全部 ✓）
- 单个模型预览：`http://localhost:5188/preview.html?id=<地标id>&view=iso`
- 游戏内调试：控制台 `__game`（`__game.teleport('longmen')`、`__game.debugCam=[x,y,z,tx,ty,tz]` 自由镜头，设回 null 取消）
- 改了 `src/data/landmarks.json` 或 `tools/build-data.mjs` 后必须重跑 `npm run data`

## 结构
- `index.html` + `src/main.js`：入口和主循环
- `src/core/gfx.js`：渲染（后期、级联阴影、雾、画质档位）；第三方库在 `vendor/`（three、postprocessing、n8ao、ez-tree），用 importmap 引用
- `src/world/`：roads（路网+路网图）、areas（地面/水/绿地/机场道面）、buildings（3.8 万栋普通楼，400m 分块流式加载；窗户假室内；重点楼的手写立面说明在 `src/data/facade-specs.json`）、landmarks（地标懒加载+碰撞）、transit（铁轨、列车、飞机）、props（街道设施和树的摆放）、trees（ez-tree 生成树种）
- `src/game/`：actors（玩家、车辆物理、镜头）、traffic（车流、停放车辆、行人）
- `src/ui/hud.js`：小地图、大地图传送、速度表
- `src/landmarks/<id>.js`：每个地标一个模块；`_kit.js` 是共用建模工具库；规范见 `docs/LANDMARK_SPEC.md`
- `src/models/`：车、列车、飞机、人物模型。车和路人优先用现成模型（`assets/models/cars/`、`assets/models/people/`，由 `cars_glb.js`、`people_glb.js` 加载，转换工具在 `tools/models/`），缺文件自动退回代码版；网址加 `?codemodels` 强制用代码版。**车模不得出现任何真实品牌名或标志**
- `src/data/landmarks.json`：地标清单（经纬度、占地、朝向 bearing、外观 brief）——**唯一的地标数据源**
- `src/data/facade-specs.json`：手写的重点楼立面说明
- `src/data/*.json` 其余文件：由 `tools/build-data.mjs` 从 `data-src/luoyang-raw.json` 生成，不要手改
- `tools/extract-osm.mjs`：从 Geofabrik 河南省 OSM 数据裁出洛阳（原始数据已在 `data-src/`）

## 约定
- 坐标：米，1:1；原点=应天门（112.4545E, 34.6776N）；+X 东，+Z 南，Y 上。朝向角 h：0=朝南(+Z)，π/2=朝东。
- 地标模块本地坐标正面朝 +Z，引擎按 `bearing`（正面的罗盘方位，180=朝南）旋转。
- 地面贴花（路、水、绿地、铁轨）都在 y=0，靠 `renderOrder` + 关闭深度测试分层，不要给它们加高度。地标自己的铺地放 y≥0.15。
- 新增地标：在 `landmarks.json` 加条目 → 写 `src/landmarks/<id>.js` → `npm run data` → 跑检查。
- 地图数据 © OpenStreetMap 贡献者（ODbL），发布时需要署名。

## 派活（多智能体）
- 独立、互不改同一文件的活（做地标模型、做车辆模型）适合并行派给子智能体：复杂的古建/车站用 Opus，商场/普通现代建筑用 Sonnet。引擎核心代码由主对话自己写。
- 给子智能体的任务说明要包含：项目绝对路径、必读的 `docs/LANDMARK_SPEC.md`、只许改哪些文件、自检命令。
