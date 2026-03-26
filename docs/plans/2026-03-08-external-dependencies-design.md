# 外部依赖支持技术方案

## 问题

当前 wasm-cairo 的多文件编译仅支持纯 Cairo 项目（只依赖内置 `core` 库）。用户导入包含 `Scarb.toml` 外部依赖的项目（如 openzeppelin、alexandria）时编译失败，因为：

1. WASM 环境没有 Scarb 包管理器
2. 无法解析 `[dependencies]` 声明
3. 无法下载 git/registry 依赖
4. 无法将外部 crate 注册到 Cairo 编译器的 salsa DB

## 当前支持范围

| 类型 | 支持 | 说明 |
|------|------|------|
| 纯 Cairo 程序 | ✅ | 只用 `core` 库 |
| 多文件模块拆分 | ✅ | `mod` / `use` 自有模块 |
| `#[starknet::contract]` | ✅ | starknet plugin 已集成 |
| Scarb 外部依赖 | ❌ | openzeppelin, alexandria 等 |
| 版本化 starknet 依赖 | ❌ | `starknet = "x.y.z"` |

## 方案对比

### 方案 A：预打包常用依赖（嵌入 WASM）

**原理**：将 openzeppelin 等常用库的 `.cairo` 源码在编译时嵌入 WASM binary，类似 corelib 的 `include_dir!` 方式。

**实现步骤**：

1. 在 `cairo-lang-compiler/src/wasm_cairo_interface.rs` 中，用 `include_dir!` 嵌入外部库源码
2. 新增 `init_bundled_dependencies()` 函数，为每个预打包库注册虚拟 crate：
   ```rust
   static EMBEDDED_OZ_TOKEN: Dir = include_dir!("$CARGO_MANIFEST_DIR/../../bundled/openzeppelin_token/src");

   fn init_bundled_dependency(db: &mut RootDatabase, name: &str, dir: &Dir) {
       let crate_id = CrateId::plain(db, SmolStrId::from(db, name));
       let virtual_dir = build_corelib_virtual_directory(db, dir);
       set_crate_config!(db, crate_id, Some(CrateConfiguration::default_for_root(virtual_dir)));
   }
   ```
3. 在所有 `wasm_cairo_interface.rs` 的 DB 构建流程中，`init_corelib()` 后调用 `init_bundled_dependencies()`
4. 前端解析 `Scarb.toml`，匹配已打包的依赖名称，不匹配的提示不支持

**优点**：
- 实现简单，复用现有 corelib 嵌入模式
- 编译速度快，无运行时网络请求
- 离线可用

**缺点**：
- WASM 体积显著增大（openzeppelin 全量约 5-10MB 源码）
- 版本固定，无法让用户选择版本
- 每次上游更新需重新构建发布 WASM
- 只能支持预选的有限库

**预估工作量**：2-3 天

### 方案 B：运行时下载依赖源码（浏览器端 Scarb Resolver）

**原理**：解析 `Scarb.toml`，从 GitHub/registry 运行时拉取依赖源码，全部作为虚拟文件传入编译器。

**实现步骤**：

1. **Scarb.toml 解析器**（前端 TypeScript）
   ```typescript
   interface ScarbDependency {
       name: string
       version?: string
       git?: string
       tag?: string
       path?: string
   }

   function parseScarbToml(content: string): {
       package: { name: string, version: string, edition: string }
       dependencies: Record<string, ScarbDependency>
   }
   ```

2. **依赖下载器**
   - Git 依赖：通过 GitHub API 下载指定 tag 的 zip/tarball
   - Registry 依赖：需要 Scarb registry API（目前无公开 registry，starknet 依赖实际内置）
   - 缓存已下载的依赖到 IndexedDB（按 name + version/tag 作 key）

3. **依赖图解析**
   - 递归解析每个依赖的 `Scarb.toml` 获取传递依赖
   - 构建依赖拓扑序
   - 检测版本冲突

4. **编译器集成**
   - 将下载的依赖源码作为额外的虚拟 crate 注册
   - 需要在 `wasm_cairo_interface.rs` 中支持注册多个 crate：
     ```rust
     pub fn register_dependency_crate(
         db: &mut RootDatabase,
         crate_name: &str,
         files: &HashMap<String, String>,
         edition: Option<&str>,
     ) { ... }
     ```
   - 前端传入 JSON 扩展格式：
     ```json
     {
       "project_name": "my_project",
       "files": { ... },
       "dependencies": {
         "openzeppelin_token": { "lib.cairo": "...", "erc20.cairo": "..." },
         "openzeppelin_access": { ... }
       }
     }
     ```

5. **WASM API 扩展**
   - 新增参数或新 API 接受 dependencies map
   - 编译时为每个 dependency 注册独立的 crate

**优点**：
- 支持任意 git 依赖，不限于预选库
- 用户可自由选择版本/tag
- WASM 体积不增长
- 依赖缓存后二次编译速度快

**缺点**：
- 实现复杂度高（解析、下载、缓存、依赖图）
- 首次编译需网络请求，有延迟
- 需要处理 CORS（GitHub API 有 rate limit）
- 传递依赖解析可能遇到兼容性问题
- 无法支持 path 依赖和私有 registry

**预估工作量**：1-2 周

### 方案 C：混合方案（推荐）

**将 A 和 B 结合**：预打包最常用的依赖（starknet、openzeppelin），同时支持运行时下载其他依赖。

**实现步骤**：

1. 第一阶段（方案 A 子集）：
   - 预打包 `starknet` 合约接口（非 core 的 starknet 部分）
   - 预打包 openzeppelin v1.0.0
   - 预打包 alexandria 常用模块
   - 前端解析 `Scarb.toml`，识别已打包依赖

2. 第二阶段（方案 B）：
   - 实现 `Scarb.toml` 解析和 GitHub 依赖下载
   - IndexedDB 依赖缓存
   - 扩展 WASM API 支持多 crate

**优点**：
- 第一阶段快速交付，覆盖 80% 用例
- 第二阶段渐进增强

## WASM API 改造设计（方案 B/C 第二阶段需要）

### 新的 JSON 输入格式

```json
{
    "project_name": "starkpay_contracts",
    "edition": "2024_07",
    "files": {
        "lib.cairo": "mod erc20;\nmod factory;",
        "erc20.cairo": "...",
        "factory.cairo": "..."
    },
    "dependencies": {
        "openzeppelin_token": {
            "edition": "2024_07",
            "files": {
                "lib.cairo": "mod erc20;",
                "erc20.cairo": "..."
            }
        },
        "openzeppelin_access": {
            "edition": "2024_07",
            "files": {
                "lib.cairo": "mod ownable;",
                "ownable.cairo": "..."
            }
        }
    }
}
```

### Rust 端改造

```rust
// 新增：注册一个依赖 crate
pub fn register_dependency(
    db: &mut RootDatabase,
    crate_name: &str,
    files: &HashMap<String, String>,
    edition: Edition,
) {
    let root_dir = build_virtual_directory(db, files);
    let crate_id = CrateId::plain(db, SmolStrId::from(db, crate_name));
    set_crate_config!(
        db,
        crate_id,
        Some(CrateConfiguration {
            root: root_dir,
            settings: CrateSettings {
                edition,
                ..Default::default()
            },
            cache_file: None,
        })
    );
}

// 修改：编译函数接受 dependencies
pub fn compile_cairo_project_with_dependencies(
    project_name: &str,
    files: &HashMap<String, String>,
    dependencies: &HashMap<String, DependencyInput>,
    compiler_config: CompilerConfig<'_>,
) -> Result<Program> {
    let mut db = RootDatabase::builder().build()?;
    init_corelib(&mut db);

    // Register each dependency as a separate crate
    for (name, dep) in dependencies {
        register_dependency(&mut db, name, &dep.files, dep.edition);
    }

    // Register main project
    let main_crate_ids = setup_virtual_project(&mut db, project_name, files);
    let crate_ids = CrateInput::into_crate_ids(&db, main_crate_ids.clone());

    check_diagnostics(&db, &main_crate_ids)?;
    compile_prepared_db_program(&db, crate_ids, compiler_config)
}
```

### 前端依赖缓存设计

```typescript
// IndexedDB store: dependency_cache
interface CachedDependency {
    key: string              // "openzeppelin_token@v1.0.0"
    name: string
    version: string          // git tag or version
    files: Record<string, string>
    cachedAt: number
}

// 缓存策略：
// - key = `${name}@${tag || version}`
// - TTL: 7 天（git tag 认为不可变可以更长）
// - 手动清除缓存按钮
```

## 建议实施路径

```
Phase 1 (当前): 纯 Cairo 多文件项目 ✅ 已完成
     │
Phase 2: 预打包 starknet 合约接口
     │   - 嵌入 starknet crate 源码到 WASM
     │   - 让 #[starknet::interface] 等宏在多文件项目中可用
     │   - 预估: 1-2 天
     │
Phase 3: 预打包 openzeppelin
     │   - include_dir 嵌入 oz 源码
     │   - 注册为独立 crate
     │   - 预估: 1-2 天
     │
Phase 4: 运行时依赖下载
     │   - Scarb.toml 解析器
     │   - GitHub 依赖下载 + IndexedDB 缓存
     │   - WASM API 扩展支持 dependencies 参数
     │   - 预估: 1-2 周
     │
Phase 5: 完善
         - 传递依赖解析
         - 版本冲突检测
         - 依赖缓存管理 UI
```
