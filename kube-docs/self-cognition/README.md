# Kube AI Hub 微调训练数据说明

本目录包含用于微调 Kube AI Hub 产品助手大模型的 JSONL 格式训练数据，分为**自我认知数据**和**产品知识数据**两大类，共 10 个文件。

---

## 文件结构与分工

### 自我认知数据

| 文件 | 说明 | 当前数量 |
|------|------|---------|
| `self_cognition.jsonl` | 助手身份、能力、开发方等自我认知问答 | zh: 78, en: 70, 共 148 条 |

**字段说明：**
- `query`：用户提问
- `response`：助手回答，必须包含 `{{NAME}}`（助手名称）和 `{{AUTHOR}}`（开发团队/公司）占位符
- `tag`：`zh`（中文）或 `en`（英文）

**使用方式（ms-swift）：**

```bash
swift sft \
  --model_type qwen2-7b-instruct \
  --dataset self_cognition.jsonl#500 \
  --model_name '["KubeAssistant", "Kube Assistant"]' \
  --model_author '["OpenCSG", "OpenCSG"]'
```

### 产品知识数据

| 文件 | 覆盖内容 | 当前数量 |
|------|----------|---------|
| `product_intro.jsonl` | 平台定位、架构、应用场景、核心特性 | zh: 20, en: 20, 共 40 条 |
| `product_install.jsonl` | 安装部署、KubeKey、依赖、容器运行时、K8s 版本 | zh: 15, en: 15, 共 30 条 |
| `product_multicluster.jsonl` | 多集群管理、可插拔组件、KubeEdge | zh: 5, en: 5, 共 10 条 |
| `product_access_control.jsonl` | 多租户架构、权限层级、企业空间、网络隔离、审计、外部认证 | zh: 11, en: 11, 共 22 条 |
| `product_cluster_ops.jsonl` | 集群/项目运维、GPU 管理、虚拟化模式、监控告警、日志、工作负载、存储、工具箱 | zh: 21, en: 21, 共 42 条 |
| `product_model_hub.jsonl` | 模型仓库、数据集、用户空间（Space）、Notebook 开发环境 | zh: 18, en: 18, 共 36 条 |
| `product_inference_finetune.jsonl` | 推理服务（框架、创建、API 调用）、模型微调（框架、流程、导出）、模型评测（框架选择、创建任务） | zh: 21, en: 20, 共 41 条 |
| `product_datatool.jsonl` | DataFlow 数据工具链（采集、转换、处理、标注、模板） | zh: 10, en: 10, 共 20 条 |
| `product_mcp.jsonl` | MCP 协议概念、平台 MCP Hub、部署与应用场景 | zh: 8, en: 8, 共 16 条 |

---

## 数据生成规范

### 自我认知数据规范

- 回答中**必须**使用占位符 `{{NAME}}`（助手名称）和 `{{AUTHOR}}`（开发团队/公司）
- 覆盖问法变体：身份类、名称类、开发方类、能力类、竞品混淆类（ChatGPT/GPT/Qwen/Llama/DeepSeek/Gemini 等）、人格化问法（父母/兄弟姐妹等）、情景化问法（我是运维/研发工程师等）
- 回答需体现助手专为 Kube AI Hub 平台打造，服务研发和运维人员

### 产品知识数据规范

- 答案**严格基于文档内容**，不得编造文档未提及的功能或数据
- 若文档未覆盖，回答：`文档中暂无相关信息 / No relevant information is provided in the documentation.`
- 每个知识点同时提供中文（`tag: zh`）和英文（`tag: en`）两个版本
- **普通段落**：至少 1 对中英问答
- **重点段落**（见下方判定标准）：3～5 种不同提问方式

### 重点段落判定标准

以下内容属于重点段落，需要多种提问变体覆盖：
- 平台核心概念与架构描述（什么是、定位是什么、架构是什么）
- 安装/部署关键步骤与前提条件（如何安装、有什么要求、支持什么）
- GPU 资源调度与异构算力核心机制（虚拟化模式、vGPU、池化）
- 多租户权限体系结构（层级、隔离方式、角色定义）
- 模型推理、微调、评测的完整操作流程（什么是、如何创建、框架对比）
- DataFlow 流水线与 MCP 部署配置（概念、功能模块、应用场景）

---

## 输入源文档

| 产品知识文件 | 主要来源文档 |
|-------------|-------------|
| `product_intro.jsonl` | `content/zh/docs/v3.4/introduction/features.md`, `architecture.md`, `scenarios.md` |
| `product_install.jsonl` | `content/zh/docs/v3.4/quick-start/all-in-one-on-linux.md`, `installing-on-linux/` |
| `product_multicluster.jsonl` | `content/zh/docs/v3.4/multicluster-management/`, `pluggable-components/` |
| `product_access_control.jsonl` | `content/zh/docs/v3.4/access-control-and-account-management/multi-tenancy-in-kubesphere.md` |
| `product_cluster_ops.jsonl` | `content/zh/docs/v3.4/cluster-administration/gpu-management.md`, `gpu-virt-mode.md`, `nodes.md`, `cluster-status-monitoring.md` 等 |
| `product_model_hub.jsonl` | `content/zh/platform-model/docs/v1.x/model/`, `dataset/`, `space/`, `inferencefinetune/notebook/` |
| `product_inference_finetune.jsonl` | `content/zh/platform-model/docs/v1.x/inferencefinetune/inference/`, `finetune/`, `evaluation/` |
| `product_datatool.jsonl` | `content/zh/platform-model/docs/v1.x/datatool/` |
| `product_mcp.jsonl` | `content/zh/platform-model/docs/v1.x/mcp/` |

自我认知数据：`self-cognition/introduction.md`

---

## 再生成流程

问答对的生成与更新通过大语言模型完成，以下提供各场景的完整 Prompt 模板，可直接粘贴至支持长文本输入的 LLM 工具（如 Cursor、ChatGPT、Claude 等）中使用。

---

### 场景一：新增/修改了某个功能模块的文档

**操作：** 将更新后的文档内容粘贴到下方 Prompt 的 `<doc>` 标签中，将目标 JSONL 文件现有内容粘贴到 `<existing>` 标签中，发送给 LLM 生成增量问答对。

```
你是一个为 Kube AI Hub 产品助手生成微调数据的专家。

## 任务
根据下方提供的产品文档片段，为已有的 JSONL 文件生成**增量**问答对。
只补充文档中新增或修改的内容所对应的问答，不要重复已有问题。

## 输出要求
- 只输出纯 JSONL 文本，每行一个 JSON 对象
- 字段：query（问题）、response（回答）、tag（"zh" 或 "en"）
- 每个知识点同时提供中文（tag: zh）和英文（tag: en）两个版本
- 普通段落：至少 1 对中英问答
- 重点段落（核心概念、关键操作、典型流程）：3～5 种提问变体，例如：
  - 定义类："X 是什么？"
  - 功能类："X 支持哪些功能/选项？"
  - 操作类："如何配置/创建/启用 X？"
  - 场景类："在什么情况下使用 X？"
  - 对比类："X 和 Y 有什么区别？"
- 答案严格基于文档内容，不得编造；文档未覆盖的内容回答"文档中暂无相关信息 / No relevant information is provided in the documentation."
- 不要输出任何解释、说明或 Markdown 标记，只输出合法的 JSONL 行

## 现有数据（已覆盖的问题，不要重复）
<existing>
{{将目标 JSONL 文件的现有内容粘贴到这里}}
</existing>

## 更新后的文档内容
<doc>
{{将更新后的 Markdown 文档内容粘贴到这里}}
</doc>
```

生成完成后，将输出内容**追加**到对应的 JSONL 文件末尾，并运行下方质量校验脚本。

---

### 场景二：全量重建某个模块的问答文件

**操作：** 将完整文档内容粘贴到 `<doc>` 标签中，LLM 将全量生成该模块的 JSONL 文件内容，**覆盖**原文件。

```
你是一个为 Kube AI Hub 产品助手生成微调数据的专家。

## 任务
根据下方提供的产品文档，生成该模块完整的问答训练数据（JSONL 格式）。

## 输出要求
- 只输出纯 JSONL 文本，每行一个 JSON 对象，不包含任何解释或 Markdown 标记
- 字段：query（问题）、response（回答）、tag（"zh" 或 "en"）
- 每个知识点同时提供中文（tag: zh）和英文（tag: en）两个版本
- 普通段落：至少 1 对中英问答
- 重点段落（核心概念、关键操作、典型流程）：3～5 种提问变体：
  - 定义类："X 是什么？"
  - 功能类："X 支持哪些功能/选项？"
  - 操作类："如何配置/创建/启用 X？"
  - 场景类："在什么情况下使用 X？"
  - 对比类："X 和 Y 有什么区别？"
- 答案严格基于文档内容，不得编造；文档未覆盖的内容回答"文档中暂无相关信息 / No relevant information is provided in the documentation."
- 问题模拟真实研发/运维用户的提问方式，避免直接复制文档原文
- 所有双引号在 JSON 字符串中需正确转义

## 重点段落判定（此类内容须生成多变体）
- 平台核心概念与架构描述
- 安装/部署关键步骤与前提条件
- GPU 资源调度与异构算力核心机制
- 多租户权限体系结构
- 模型推理、微调、评测的完整操作流程
- DataFlow 流水线与 MCP 部署配置

## 文档内容
<doc>
{{将完整的 Markdown 文档内容粘贴到这里}}
</doc>
```

---

### 场景三：自我认知数据扩充

**操作：** 将现有 `self_cognition.jsonl` 内容和 `introduction.md` 粘贴到对应标签中，LLM 生成**不重复**的增量问答对，**追加**到文件末尾。

```
你是一个为 Kube AI Hub 产品助手生成自我认知微调数据的专家。

## 任务
基于助手介绍文档，生成助手自我认知问答对，追加到现有数据中（不重复已有问题）。

## 输出要求
- 只输出纯 JSONL 文本，每行一个 JSON 对象，不包含任何解释或 Markdown 标记
- 字段：query（问题）、response（回答）、tag（"zh" 或 "en"）
- 每个问法同时提供中文（tag: zh）和英文（tag: en）版本
- 回答中**必须**包含占位符 {{NAME}}（助手名称）和 {{AUTHOR}}（开发团队/公司）
- 回答需体现助手专为 Kube AI Hub 平台打造，服务研发和运维人员

## 需覆盖的问法类型（与现有数据互补，不重复）
- 身份/名称类："你是谁"、"你叫什么"、"介绍一下自己"
- 开发方类："谁开发了你"、"你是谁训练的"、"你的创造者是谁"
- 能力边界类："你能帮我做什么"、"你有什么局限"、"你擅长哪些方面"
- 情景化问法："我是运维工程师，你能帮我吗"、"我是算法研发，你能做什么"
- 竞品混淆类："你是 ChatGPT/GPT-4/Qwen/Llama/DeepSeek/Gemini/Claude/Kimi 吗"
- 人格化问法："你的父母是谁"、"你有兄弟姐妹吗"
- 礼貌/非正式变体："嗨，能介绍一下自己吗"、"hi，你是啥"
- 多语言混搭："你是who"、"please介绍一下你自己"

## 现有数据（不要重复以下问题）
<existing>
{{将 self_cognition.jsonl 的现有内容粘贴到这里}}
</existing>

## 助手介绍文档
<intro>
{{将 introduction.md 的内容粘贴到这里}}
</intro>

## 生成数量
中文（tag: zh）和英文（tag: en）各不少于 20 条。
```

---

### 通用格式校验（生成后必做）

将 LLM 输出写入文件后，运行以下命令验证格式：

```bash
python3 -c "
import json, sys
fname = sys.argv[1]
errors, zh, en = 0, 0, 0
with open(fname) as f:
    for i, line in enumerate(f, 1):
        line = line.strip()
        if not line: continue
        try:
            obj = json.loads(line)
            assert 'query' in obj and 'response' in obj and 'tag' in obj
            if obj['tag'] == 'zh': zh += 1
            elif obj['tag'] == 'en': en += 1
            else: raise ValueError(f'Unknown tag: {obj[\"tag\"]}')
        except Exception as e:
            errors += 1
            print(f'Line {i}: {e}')
print(f'{fname}: errors={errors}, zh={zh}, en={en}')
" <目标文件名>.jsonl
```

生成完成后，更新 `dataset_infos.json` 中对应数据集的 `num_examples` 字段。

---

## 质量校验清单

运行以下脚本对所有文件进行格式验证：

```python
import json, os

files = [
    "self_cognition.jsonl",
    "product_intro.jsonl",
    "product_install.jsonl",
    "product_multicluster.jsonl",
    "product_access_control.jsonl",
    "product_cluster_ops.jsonl",
    "product_model_hub.jsonl",
    "product_inference_finetune.jsonl",
    "product_datatool.jsonl",
    "product_mcp.jsonl",
]

for fname in files:
    errors, zh, en = 0, 0, 0
    with open(fname) as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line: continue
            try:
                obj = json.loads(line)
                assert "query" in obj and "response" in obj and "tag" in obj
                tag = obj["tag"]
                if tag == "zh": zh += 1
                elif tag == "en": en += 1
                else: raise ValueError(f"Unknown tag: {tag}")
            except Exception as e:
                errors += 1
                print(f"  {fname}:{i}: {e}")
    status = "OK" if errors == 0 else f"ERRORS: {errors}"
    print(f"{fname}: {status} | zh={zh} en={en}")
```

**校验项：**
- [ ] JSON 结构合法：每行独立可解析，字段完整（query/response/tag）
- [ ] 语言与 tag 匹配：zh 行以中文为主，en 行以英文为主
- [ ] 事实准确：答案基于文档内容，无编造信息
- [ ] 去重：同文件内问题无重复
- [ ] 占位符：自我认知文件回答包含 `{{NAME}}` 和 `{{AUTHOR}}`
