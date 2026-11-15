# 项目存储卷（PVC）页面族 · 交付记录 2026-11-15

按[交付模板](page-migration-template.md)记录本批选定的完整迁移单元：项目作用域的**存储卷**列表、创建、详情、克隆、创建快照、元数据/事件页签与持久卷列。

## 1. 基线

- 分支 `develop`，起始提交 `ff09a29d1`；本批只改存储相关文件与共享 mapper，未触碰并行工作区的其他改动。
- 环境：B200（host 集群），本地 BFF :8092 + 前端 :5178；真实接口、admin 角色。
- 选择依据：能力矩阵 CHECK-04「日常资源完整表单、详情、创建与写闭环」；存储卷是老 console 的日常写任务，新 UI 此前只有列表与详情，创建/克隆/创建快照三个动作缺失。

## 2. 旧能力清单（原子 ID）与归宿

| ID | 旧能力 | 新落点 | AC/TC | 结论 |
| --- | --- | --- | --- | --- |
| PVC-01 | 列表五列 + 名称进详情 | 存储卷列表 | STORAGE-LIST-01 | 保留（已验收） |
| PVC-02 | 持久卷列 + PV 链接 | 列表 `持久卷` 列 | STORAGE-LIST-03 | 本批补齐 |
| PVC-03 | 创建存储卷（新建：类型/模式/容量） | `persistentvolumeclaims:create` → CreateVolumeDialog | STORAGE-CREATE-01 | 本批补齐 |
| PVC-04 | 创建存储卷（从快照恢复） | 同一弹窗的「从快照创建」分支 | STORAGE-CREATE-02 | 本批补齐 |
| PVC-05 | 详情：编辑信息 / 编辑 YAML / 扩容 / 删除 | 详情头部与列表行操作 | STORAGE-DETAIL-01 / EDIT_YAML-01 / DELETE-01 | 保留（已验收） |
| PVC-06 | 详情：克隆（allow-clone 门控） | 详情「克隆」→ CloneVolumeDialog | STORAGE-CLONE-01 | 本批补齐 |
| PVC-07 | 详情：创建快照（allow-snapshot 门控，按驱动过滤快照类） | 详情「创建快照」→ CreateSnapshotDialog | STORAGE-CREATE_SNAPSHOT-01 | 本批补齐 |
| PVC-08 | 详情页签：资源状态/元数据/事件/快照 | 属性/元数据/事件/快照四页签 | STORAGE-DETAIL_TABS-01 | 元数据与事件本批补齐 |
| PVC-09 | 快照列表/快照内容/快照类型 | 存储卷快照页、快照内容页 | SNAPSHOTS-01 / SNAPSHOT_CONTENT-01 | 保留（已验收） |

## 3. 数据语义

- 写入字段：`spec.storageClassName`（留空即省略，由默认类决定）、`spec.accessModes`（**完整拼写**）、`spec.resources.requests.storage`（Gi）、`spec.dataSource`（恢复/克隆）、`spec.source.persistentVolumeClaimName`（快照）。
- 展示字段：状态取 PVC `phase`；容量取 requests；访问模式列显示缩写（RWO/RWX），写入用 `accessModeNames`。
- 能力来源：`storageclass.kubesphere.io/allow-clone`、`…/allow-snapshot`、`storageclass.kubesphere.io/supported-access-modes`、`parameters.minSize/maxSize/stepSize`；默认类识别含 `storageclass.kubernetes.io/is-default-class` 与 KubeSphere 自有拼写。
- 页面读 kapis（`/kapis/resources.kubesphere.io/v1alpha3/...`），它会补充 `kubesphere.io/in-use`、`kubesphere.io/allow-snapshot` 等计算注解；核对元数据必须用同一端点。

## 4. 交互与权限

- 创建/克隆/快照三个动作都在授权范围内创建唯一 `tc-e2e-*` 对象，回读并在 finally 删除；跑完复核无残留。
- 门控：克隆要求类声明 allow-clone 且源卷 Bound；快照要求类声明 allow-snapshot；扩容沿用类 allowVolumeExpansion。
- 失败展示服务端原因（例如地址不可达、驱动不支持克隆），弹窗不关闭。

## 5. 视觉

- 列顺序：名称 / 状态 / 容量 / 访问模式 / 持久卷 / 创建时间 / 挂载状态；1024 与 1600 宽度无横向滚动（scrollWidth 等于视口宽度）。
- 详情：四页签与老 console 顺序一致（属性→元数据→事件→快照），元数据两张表（标签/注解，键值列）。
- 截图：`/tmp/storage-list-1024.png`、`/tmp/storage-list-1280-light.png`、`/tmp/storage-list-1600.png`、`/tmp/storage-detail-1280-light.png`、`/tmp/storage-create-en.png`、`/tmp/create-volume-dialog.png`、`/tmp/clone-dialog.png`、`/tmp/snapshot-dialog.png`、`/tmp/create-from-snapshot.png`、`/tmp/pvc-detail-tabs.png`。
- 限制：本版本新 UI 未提供深浅主题/色调切换入口，本批只核对默认主题；英文文案经 localStorage `kube-frontend-locale=en` 核对（表头与弹窗均英文）。

## 6. 验证

| 范围 | 命令 | 结果 |
| --- | --- | --- |
| API/mapper 单测 | `packages/api-client: vitest run test/claim-manifests.test.ts test/mappers.test.ts` | 55 passed |
| 显式类型检查 | `console-next: tsc --noEmit`；`api-client: tsc --noEmit`（src） | 0 error |
| 构建 | `console-next: vite build` | ✓ built |
| 严格规格门禁 | `python3 prd/tools/check_docs.py --strict` | errors=0 warnings=0 |
| 本批 E2E（串行 -n 0） | storage 全目录 + STORAGE_CLASSES-01/02/03 | 23 passed |
| 共享影响 | CONFIGMAPS-LIST-01、SECRETS-LIST-01、APP_WORKLOADS-LIST-01、PERSISTENT_VOLUMES-01 | 4 passed |

未执行：全站串行 E2E、部署环境（生产前端）复核、member 集群写入。

## 7. 遗留与阻塞

- 快照创建在当前集群**无法端到端**：`VolumeSnapshotClass` 数量为 0，页面按「没有与存储驱动 X 匹配的快照类」说明并禁用提交；用例断言该说明。属于集群侧前置（驱动未提供快照类），不是页面缺口。
- 创建表单未提供 PV 预绑定与跨项目快照恢复（老 console 亦无），已在 PRD「明确不做」。
- 高级设置中的自定义标签/注解（老 console 第三步）未纳入本批表单；可用编辑 YAML 完成，已在 PRD 记录。
