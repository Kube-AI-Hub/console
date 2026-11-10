# 配置字典详情（L3）

## 概述

详情页回答「这个配置字典里到底是什么」。列表只给出键名，值必须到详情才能看到；四个操作入口也在这里。

旧 console 的详情页同样只有一个 `数据` 分区，属性区只列集群、项目、创建时间、创建者。

## 用户故事

### US1 - 作为项目成员，查看某个配置字典的全部键值

**Independent Test**：从列表点击名称进入详情，逐个核对键名与值与 `kubectl get configmap <name> -o yaml` 一致。

### US2 - 作为项目成员，从详情直接发起编辑或删除

**Independent Test**：在详情页依次点击四个操作，每个都打开对应弹窗，且弹窗预填的正是当前对象。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01** — Given 对象存在，When 打开详情，Then 头部显示名称、别名与描述，属性区显示集群、项目、创建时间（`YYYY-MM-DD HH:mm:ss`）、创建者，`数据` 分区逐条列出键值；键值中的换行按原样保留。
- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02** — Given 详情已打开，When 点击「编辑信息」「编辑设置」「编辑 YAML」「删除」，Then 分别打开对应弹窗并预填当前对象；在详情页完成删除后跳回列表。

## 设计目标

- 值原样展示：配置值常常是多行文件（`nginx.conf`、`app.yaml`），折叠或截断会让详情页失去意义。
- 操作与列表一致：详情页的四个入口与行操作菜单是同一组能力，不额外增减。

## 约束与边界

- 只读展示 `data`；`binaryData` 不展示（旧 console 也不展示）。
- 不展示 `labels`、`annotations` 与更新时间——旧 console 的详情页没有这些，需要看原始对象走「编辑 YAML」。
- 属性区四项固定，不随权限增减。

## UI 交互设计

- 顶部返回链接指向列表，文案为「配置字典」。
- 头部右侧四个操作：编辑信息、编辑设置、编辑 YAML 为次要样式，删除为危险样式。
- 属性区用定义列表两列排布，窄屏堆叠。
- `数据` 分区每条：键名为浅底小标签，值为等宽字体、保留换行、可横向滚动。
- 空数据时显示「暂无数据」，而不是留一片空白。

## 文案与校验

- 分区标题：属性、数据。
- 空态：暂无数据。
- 错误态：取上游 `message`，无可用信息时回落到「未知错误」。

## 边界情况

- 对象已被他人删除：详情请求返回 404，页面显示「资源不存在」，返回链接仍可用。
- 值超长：横向滚动，不截断。
- 值为空字符串：照常显示空值块，不显示 `-`（旧 console 同样如此）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01** — 详情读取 `GET /kapis/resources.kubesphere.io/v1alpha3[/clusters/{c}]/namespaces/{ns}/configmaps/{name}`，与旧 console 同一端点。
- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02** — 详情页四个操作必须打开与列表行操作相同的弹窗组件。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01** — 详情页展示的键值数量与内容与 `kubectl get -o json` 完全一致。

## 明确不做

- 不做键值的内联编辑（编辑走「编辑设置」弹窗）。
- 不做「查看 YAML」只读弹窗（编辑 YAML 已可查看）。
- 不做关联工作负载的反向引用。

## 假设

- 创建者取自 `kubesphere.io/creator` 注解；缺失时显示 `-`。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02`
