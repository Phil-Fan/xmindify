# 论文阅读分析

## 适用场景

学术论文结构化阅读、研究文献分析、技术报告理解

## XMindMark 模板

```
论文标题

- Abstract [B]
    * Task
        - 具体任务描述
    * Technical Challenge
        - 核心技术挑战
    * Key Insight/Motivation [1]
        - 一句话介绍insight/motivation
        - 一句话介绍insight的好处
    * Technical Contribution [^1](leads to)
        - Contribution1
            - 一句话介绍
            - 一句话介绍好处
        - Contribution2
            - 一句话介绍
            - 一句话介绍好处
    * Experiment [^2](validated by)
        - 主要发现

- Introduction [B]
    * Task And Application
        - 应用场景
        - 任务定义
    * Technical Challenge [2]
        - Challenge 1
            - Previous Method
            - Failure Cases
            - Technical Reason
        - Challenge 2
            - Previous Method
            - Failure Cases
            - Technical Reason
    * Our Pipeline
        - Key Innovation/Insight/Contribution
        - Contribution1 [^2](addresses)
            - Specific Method
            - Advantages/Insight
        - Contribution2
            - 为了解决什么问题
            - 具体做法
            - 讨论Advantage/Insight
    * Cool Demos/Applications

- Method [B]
    * Overview
        - 具体任务：输入输出
        - 方法：第一步第二步第三步
    * Pipeline Module1
        - Motivation
        - 做法
        - Why Work
        - Technical Advantage
    * Pipeline Module2
        - Motivation
        - 做法
        - Why Work
        - Technical Advantage

- Experiments [B]
    * Comparison Experiments
        - 数据集
        - 基线方法
        - 评估指标
        - 主要结果
    * Ablation Studies
        - Core Contributions
            - Core components对performance的影响
        - Design Choices
            - 每个pipeline module中设计选择的影响

- Limitation [S]
    * 合理解释：为什么方法有limitation
    [S]: 方法局限性总结
```

## 关联说明（最多2个连接）

- `[1]` Insight → `[^1]` Contribution（洞察引出贡献）
- `[2]` Challenge → `[^2]` Contribution（挑战被贡献解决）

## 结构说明

- 使用 `[B]` 将相关章节逻辑分组
- 使用 `[S]` 创建局限性总结节点
- 每个分支保持清晰层级，不超过4层深度
