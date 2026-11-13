# TC-FULL-KUBE-FRONTEND-STORAGE-01 存储 · 两个页签之间切换不刷新

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-STORAGE-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `storage` `page`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/_index.md`

## 产品功能

['存', '储', '卷', '与', '存', '储', '卷', '快', '照', '在', '同', '一', '个', '功', '能', '区', '，', '切', '换', '页', '签', '是', '客', '户', '端', '跳', '转', '。']

### 关联需求

- `prd/kube-frontend/storage/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/_index.md`](../../../../prd/kube-frontend/storage/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-STORAGE-01** — 已知已登录且有项目权限，当从存储卷页签切到存储卷快照，则两次都显示对应列表（或空态），页签高亮跟随，工作区栏项目不变。
- **AC-FULL-KUBE-FRONTEND-STORAGE-02** — 已知在存储卷列表，当点「编辑 YAML」，则先出现加载对话框再出现编辑器；当取消，则对象不变。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/_index.md`](../../../../design/kube-frontend/storage/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/_index.md`](../../../../prd/kube-frontend/storage/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 打开存储区就能看到两张表 (Priority: P1)

作为 **项目运维**，我希望 **在同一个功能区的两个页签之间切换**，以便 **不用回侧栏找入口**。

**Independent Test**：从存储卷切到存储卷快照，核对页签高亮变化且没有整页刷新。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- fixture 提供一个已登录的浏览器上下文

## 测试步骤

1. 打开存储卷页
2. 切到存储卷快照页签
3. 再切回存储卷
4. 统计切换期间的文档请求

## 期望结果

- 两个页面各自出现列表或空态
- 每次切换后对应页签高亮
- 切换期间文档请求为 0
- 工作区栏显示的项目始终是 default

## 失败排查

- 出现文档请求说明页签退化成整页跳转，检查 AreaTabs 的 <a> 是否被 onNavigate 接管

## 产品改版后如何更新自动化

- 页签结构变化时改 pages/storage.py 的选择器
