# 工作负载「编辑设置」补亲和性（2026-11-18）

## 背景

老 console 的 `workload.template.edit` 有六个页签，其中一个是**亲和性**；我们的弹窗此前只覆盖常改字段，
亲和性只能走「编辑 YAML」。

## 做法：把亲和性做成一段 YAML 字段

node/pod 亲和性（required + preferred，每项还带权重与拓扑键）的表单比这个弹窗里其它字段加起来还大。
所以做成**一个 YAML 文本域**，覆盖整个 `spec.template.spec.affinity`：

| 行为 | 实现 |
| --- | --- |
| 打开时预填 | 现有 affinity 转 YAML（`toYaml`） |
| 编辑时校验 | `parseYaml`；解析失败或不是对象 → 行内报错（`role=alert`） |
| 保存被阻断 | 有错误时保存按钮不可用 |
| 留空 | 从 manifest 里删除该字段 |
| 差异预览 | 作为 `spec.template.spec.affinity` 一行参与「保存前列出将改动的字段」 |

## 验证

| 检查 | 结果 |
| --- | --- |
| 弹窗里出现亲和性区段 | `[data-ai-id$="-edit:affinity"]` 计数 1 |
| 输入非法 YAML | 行内错误出现（`affinity-error` 计数 1） |
| `tsc` | 0 |
| `vite build` | ✓ |
| 契约套件 | 18 文件 / 1570 passed |

## 保存回读往返（已补验）

临时 Deployment `tc-affinity-112dfe`（`spaces` 命名空间，无亲和性）上走完整链路：

1. 详情页 → 编辑设置 → 在亲和性文本域填 `nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution`；
2. 合法 YAML → 行内错误计数 **0**，点确认；
3. 对话框关闭；**API 回读**得到：

```json
{"nodeAffinity": {"requiredDuringSchedulingIgnoredDuringExecution":
  {"nodeSelectorTerms": [{"matchExpressions":
    [{"key": "kubernetes.io/os", "operator": "In", "values": ["linux"]}]}]}}}
```

4. 删除并复核：`DELETE 200` / `GET 404`（无残留）。

## 未覆盖

「清空后删除该字段」这条路径未在真实对象上验（表单里留空 → 保存会 delete 该 key，逻辑与上面同一条链路）。
