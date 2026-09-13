# 研究生课表与作业管理系统

面向研究生的一体化课表 / 作业 / 选课工具。桌面端为单文件 HTML 原型，移动端为 WebView 壳打包的 Android APK，两者共用同一份数据与业务逻辑。

- **学期课表**：按周、按天展示，每天固定三时段（上午 08:30–11:30、下午 14:00–17:00、晚上 18:00–21:00），支持单双周与周次区间。
- **逐格选课**：课程表每个格子（星期 × 时段）是一个下拉框，选一门课或选「无课」，21 个格子填完即得最终课表。冲突的课自动排除，周次不重叠的可以同时选。
- **作业管理**：每条作业记录提交方式、提交地点、内容、教材 / PPT 章节、截止时间；支持拆成**待办子清单**并跟踪 `已完成/总数`。
- **每日学习计划**：按「星期 × 时段」格子安排本周学什么，自动感知单双周（本周不上的课灰显）。没课的格子直接安排；有课却要学别的会标黄并汇总到「上课时学别的」。支持复制上周计划、统计空闲时段。
- **考勤方式**：每门课可填（也可不填）点名 / 扫码 / 随堂小测等，填了才在课表卡片上显示。
- **Excel 导入**：App 内直接选 `.xlsx` 解析，先预览勾选再写入课表。

## 目录结构

```
.
├── docs/                       需求规格说明书（v1.3，含字段定义、冲突算法、实测附录）
├── prototype/
│   └── index.html              桌面端可交互原型（单文件，无依赖，浏览器直接打开）
├── android/
│   ├── app/src/main/           Android 工程（WebView 壳 + assets）
│   │   ├── assets/index.html   移动端页面（由 build_app.js 从桌面原型生成）
│   │   ├── assets/xlsx.full.min.js   SheetJS，用于 App 内解析 Excel
│   │   └── java/.../MainActivity.java 原生壳：文件选择、本地存储兜底、返回键处理
│   ├── out/GradSchedule-v1.2.apk      已签名 APK（0.34MB）
│   └── 安装说明.md
└── tools/
    ├── gen_plan_data.py        解析教务 Excel → 生成选课清单数据（Python）
    ├── dump_xlsx.py            探查 Excel 结构（Python）
    ├── patch_data.js           应用教务调课通知 + 公开仓库数据脱敏
    ├── build_app.js            桌面原型 → 移动端页面（JS）
    ├── build_apk.js            手工构建链：aapt2 → javac → d8 → zipalign → apksigner
    ├── dl.js                   下载 Android SDK 平台 / build-tools / SheetJS
    └── smoke.js                jsdom 渲染冒烟测试（含真实 Excel 解析校验）
```

## 快速开始

**桌面原型**：直接用浏览器打开 `prototype/index.html`。

**打包 APK**：

```bash
node tools/dl.js        # 首次执行，下载 Android SDK 平台与 build-tools（约 350MB）
node tools/build_app.js # 生成移动端页面
node tools/build_apk.js # 输出 android/out/GradSchedule-v1.2.apk
```

**冒烟测试**（需 `npm i jsdom`）：

```bash
node tools/smoke.js

# 想连真实教务 Excel 一起验证：
XLSX_FILE="/path/to/课表.xlsx" node tools/smoke.js
```

> 所有脚本均基于自身位置推导项目根目录，可任意克隆到任何路径运行，无硬编码绝对路径。

> 本机构建环境为 JDK 8，无 Gradle / Android Studio。`build_apk.js` 直接调用
> `aapt2 → javac → d8 → zipalign → apksigner` 完成打包，无需 Gradle 守护进程。
> 注意：新版 apksigner 要求 Java 9+，脚本固定使用 build-tools r28 的 apksigner。

## 关键设计

**冲突判定 = 时间区间相交 ∧ 周次有交集。** 只按时间判会把「同为周一上午但一个 1–8 周、一个 9–16 周」的课误判为冲突；用区间相交（而非"是否同一时段"）则能捕捉 `09:00–11:00` 与 `10:00–12:00` 这类部分重叠。分组采用并查集，保证 A×B、B×C 能传递成 A/B/C 同组。

**三处入口，一份数据。** Excel、截图、手工录入只是三个 Parser，归一化后统一落到「课程 / 排课 / 作业 / 教材 / 变更」五类实体；课表、作业看板、DDL 日历是同一数据的不同视图。

**教务表交叉核对。** 用个人课表与教务排课表逐门比对教室，输出差异清单供人工确认。

**数据来源有优先级。** 同一门课的教室在 Excel 排课表和后续教务通知里可能不一致，实测确认应以**教务通知**为准（详见需求文档 E.4）。已应用的通知写在 `tools/patch_data.js` 的 `NOTICE` 表中，可随时增补重跑。

## 隐私

仓库为公开可见，**不含任何个人课表数据**：学期课表初始为空（显示引导卡片，由选课结果导出生成），选课清单 55 门课程全部为「候选」状态。课表数据只存在于你本机浏览器 / 手机上，不上传。

## 已知限制

- **截图识别（OCR）未实现**：离线环境无法做中文 OCR，变更目前为手动录入。提供教务截图样本后可校准关键词词典并接入 OCR 服务。
- **签名证书不入库**（见 `.gitignore`）。重新克隆后首次打包会自动生成新证书，与既有 APK 签名不一致，需先卸载旧版再安装。

## 数据来源

课表数据来自北京大学 26–27 学年度排课表（电子信息方向），解析结果已写入原型。教务表结构与解析发现记录在需求文档附录 E。
