---
title: "模型评测常见问题"
keywords: "行业大模型平台, 模型评测, 常见问题, FAQ"
description: "模型评测常见问题解答。"
linkTitle: "模型评测常见问题"
weight: 6410
---

## 常见问题

### 评测按钮置灰，提示"评测框架暂未支持"

**原因**：当前评测框架暂时不支持该模型。

**解决方案**：请联系平台管理员，告知需要支持的模型名称和相关信息，管理员将评估后尽快添加支持。

---

### 评测任务长时间处于"等待中"

**原因**：选择了共享资源，当前公共算力队列繁忙。

**解决方案**：
1. 耐心等待队列排空（共享资源评测任务按提交顺序执行）。
2. 如需立即执行，可切换为**专属资源**（按时间计费）。

---

### 评测结果分数异常偏低

**可能原因**：
- 所选评测数据集与模型的训练语言不匹配（如用中文数据集评测英文模型）。
- 模型缺少对应任务的指令跟随能力（基座模型 vs 指令微调模型）。
- 评测框架参数配置不合理。

**解决方案**：
1. 选择与模型语言和任务类型匹配的评测数据集。
2. 对于基座模型，使用适合预训练模型的评测方式（如困惑度评测）。
3. 参考[评测框架介绍](./evaluation_framework_intro)了解各框架适用场景。

---

### 如何使用自定义数据集评测

请参考[自定义评测数据集](./evaluation_with_custom_dataset)文档了解详细操作步骤。

---

### 内网环境没有数据集仓库时，系统推荐为什么是空的？

**原因**：系统推荐原先只列出已入库并打了 `runtime_framework` + `evaluation` 标签的数据集。OpenCompass / lm-evaluation-harness 镜像内已烘焙的评测集默认不会在安装时灌仓，离线或未做多源同步时下拉为空。

**当前行为**：
1. 选择 **OpenCompass** 或 **lm-evaluation-harness** 时，新建评测页会列出镜像内真正可用的内置数据集（无需仓库已存在）。
2. 评测成功后，本次用到且平台缺失的内置集会自动建仓、写入文件，并打上 evaluation 与 runtime_framework 标签，可在数据集详情页查看和下载。
3. **EvalScope** 没有对等内置数据包，仍需同步或使用自定义数据集。

自定义数据集不会在评测后自动导入。

---

### 评测框架参数、vLLM 参数和高级选项分别改什么？

**评测框架参数**和 **vLLM 参数**只影响运行（batch、生成长度、dtype 等），不改评分公式。**高级选项**里的 Prompt 模版改题干协议，打分插件改用哪套框架原生指标。覆盖 Prompt 后分数不可与官方榜单横比。详见[评测自定义参数](./evaluation_custom_params)。

---

### 高级选项里的 Prompt / 打分插件要不要改？

系统推荐集默认保持框架协议，以便和论文/榜单横比。自定义业务集、线上 system prompt、协议消融或 LLM Judge 才需要改。详见[评测自定义参数](./evaluation_custom_params)、[打分插件与 Prompt 模版](./evaluation_scoring_plugins)和[指标配置](./evaluation_metrics_config)。

同名 Accuracy 不能跨 OpenCompass / lm-evaluation-harness / EvalScope 直接比较。

---

### 评测还在运行时能不能看详情？

可以。详情页至少展示配置快照和状态；分数、覆盖率和失败样例在任务成功后写入报告。

## 相关文档

- [评测自定义参数](./evaluation_custom_params)
- [打分插件与 Prompt 模版](./evaluation_scoring_plugins)
- [指标配置](./evaluation_metrics_config)
- [自定义评测数据集](./evaluation_with_custom_dataset)
