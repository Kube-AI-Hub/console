# 创建配置字典（L3）

## 概述

创建入口在列表工具栏的主按钮上。表单分两步：基本信息、数据设置；右上角可切换到 YAML 模式一次性粘贴整个对象。

旧 console 的创建弹窗同样是两步加 YAML 开关（`console/src/configs/steps/configmaps.js`），这里保持一致，因为「逐条录入」和「整段粘贴」是两种真实工作方式。

## 用户故事

### US1 - 作为项目成员，从表单创建一个只含少量键值的配置字典

**Independent Test**：打开创建弹窗，填写名称后进入数据设置，添加两个键值对，提交后列表出现该对象。

### US2 - 作为项目成员，把一份现成的 YAML 粘贴进来直接创建

**Independent Test**：打开创建弹窗，切到 YAML 模式，粘贴一段合法 YAML 并提交，对象按 YAML 内容创建。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01** — Given 创建弹窗打开，When 名称留空、含大写、以连字符开头或超过 63 字符，Then 提示对应错误且不进入下一步；When 名称已存在，Then 提示「名称已存在，请输入其他名称。」
- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02** — Given 基本信息已填，When 进入数据设置并添加键值对，Then 在子表单未保存时「创建」保持禁用；保存后提交，列表刷新并出现该对象。
- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-04** — Given 创建弹窗打开，When 选择另一个项目再提交，Then 对象创建到所选项目而非打开弹窗时的项目；未选择项目时下一步被阻止并提示「请选择项目」；名称查重针对所选项目进行。
- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03** — Given 弹窗打开，When 切到 YAML 模式并粘贴合法对象，Then 可直接提交；When YAML 无法解析，Then 提示「YAML 格式有误，请修正后再提交。」且提交按钮禁用。

## 设计目标

- 输入的每一处错误都在提交前暴露：名称规则、名称重复、YAML 语法。
- 两种模式互不丢失：表单里已填的内容在切到 YAML 时作为初始文档出现。

## 约束与边界

- 项目在创建时可改：初始值取列表的项目筛选（「全部项目」时为空，需要显式选择），完成后对象落在所选项目。名称唯一性按项目判定，因此查重也必须用所选项目。
- 名称规则与 kube-apiserver 一致：小写字母、数字、连字符，首尾为字母或数字，最长 63。
- 别名规则：允许中文、字母、数字与中间连字符，不能以连字符开头或结尾。
- 描述最长 256 字符。
- 创建提交 `POST /kapis/resources.kubesphere.io/v1alpha3[/clusters/{c}]/namespaces/{ns}/configmaps`，与旧 console 同一端点。
- 数据键：必填、非空、同组唯一；不得包含斜杠。允许点号与连字符（键常常是文件名 `app.yaml`）。

## UI 交互设计

- 弹窗宽 `xl`（对应旧 console 的 960px），容纳两步表单与 YAML 编辑器。
- 步骤指示用序号圆点，当前步高亮、已完成的步显示为完成态。
- 「上一步」只在第二步出现；「下一步」只在第一步出现。
- 数据设置沿用列表+内联子表单的形态：添加与编辑都在原地展开，子表单打开时主提交按钮禁用。
- YAML 编辑器右下角提供上传与下载 `.yaml` 的图标按钮。

## 文案与校验

- 标题：创建 ConfigMap。
- 步骤：基本信息、数据设置。
- 按钮：下一步、上一步、创建、取消。
- 校验：请设置一个名称。／名称无效…／名称已存在，请输入其他名称。／别名无效…／描述最长 256 个字符。／请设置键名。／键名 {key} 重复…／键名不能包含斜杠（/）。

## 边界情况

- 名称重复检查失败（网络问题）：不阻塞进入下一步，交由提交时的上游错误呈现。
- 数据为空：允许创建（空 ConfigMap 合法）。
- YAML 里 `kind` 不是 ConfigMap：仍按对象提交，由上游决定是否接受。
- 提交过程中重复点击：按钮在请求期间禁用。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01** — 名称、别名、描述在进入下一步前完成校验。
- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02** — 别名写入 `kubesphere.io/alias-name`，描述写入 `kubesphere.io/description`，与旧 console 读写同一组注解。
- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03** — YAML 模式与表单模式提交到同一端点，成功后关闭弹窗并刷新列表。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01** — 创建后 `kubectl get configmap <name> -o json` 的 `data` 与表单一致，注解包含别名与描述。

## 明确不做

- 不做标签（labels）输入——旧 console 的创建表单没有，需要时走 YAML。
- 不做多文档 YAML（`---` 分隔）。
- 不做从文件批量导入多个键值。

## 假设

- 目标项目默认为当前路由的项目；「全部项目」视图下取路由项目。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03`
