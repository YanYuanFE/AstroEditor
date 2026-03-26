# AstroEditor 多文件项目支持设计

## 概述
将 AstroEditor 从单文件编辑器改造为支持多文件 Cairo 项目的 IDE。

## 架构布局
SideBar(导航) | ProjectPanel(文件树, 240px, 可收缩) | EditorArea(Tabs + Monaco + Console)

## 数据模型
- Project: { id, name, createdAt, updatedAt }
- FileNode: { id, projectId, name, path, type, content?, parentPath }

## 存储
IndexedDB (通过 idb 库)，两个 store: projects, files。

## 项目创建/导入
1. 新建项目 → 输入名称，生成 lib.cairo 脚手架
2. 导入文件夹 → showDirectoryPicker() API
3. 导入 zip → JSZip 解包
4. 导入 GitHub → 公开仓库，通过 API 拉取 tarball

## 文件树
VS Code 风格，右键菜单（新建/重命名/删除），拖拽移动，文件夹优先排序。

## 编辑器
单编辑器 + Tab 切换，每文件独立 Monaco model，未保存修改圆点标记。

## 编译/运行
统一走 Project WASM API，从 IndexedDB 读取全部 .cairo 文件构造 JSON 传入。

## 状态管理
新增 useProjectStore (zustand)，保留 useSettingStore 和 useContractStore。

## 新增依赖
idb (~1KB), jszip (~45KB), uuid (~1KB)
