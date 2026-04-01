"""
秦皇岛野生动物园知识库（RAG 检索用文本块）。
实际项目可换向量库；此处用关键词命中 + 片段拼接，体现「知识库增强」。
"""
from typing import Dict, List, Tuple

KNOWLEDGE_CHUNKS: List[Dict[str, str]] = [
    {
        "id": "rule-1",
        "tags": "安全,猛兽,投喂,下车",
        "text": "猛兽区严禁下车、开窗、投喂；请全程乘车或按园区指定路线游览，听从工作人员指挥。",
    },
    {
        "id": "rule-2",
        "tags": "开放时间,入园",
        "text": "园区开放时间以当日公告为准；节假日可能限流，请提前预约并携带有效证件。",
    },
    {
        "id": "fac-1",
        "tags": "厕所,卫生间,东门",
        "text": "东门入口附近设有公共卫生间，并配备无障碍设施；园内主干道沿线分布多处卫生间。",
    },
    {
        "id": "fac-2",
        "tags": "超市,餐饮,补给",
        "text": "中央服务区提供饮用水、简餐与纪念品售卖，适合家庭补给与休息。",
    },
    {
        "id": "spot-1",
        "tags": "猛兽区,东北虎,非洲狮",
        "text": "猛兽区展示东北虎、非洲狮等物种，强调动物福利与科普教育，请勿敲击玻璃或使用闪光灯。",
    },
    {
        "id": "spot-2",
        "tags": "食草区,长颈鹿,斑马",
        "text": "食草动物区以散养展示为主，适合亲子观察动物自然行为，请保持安静与卫生。",
    },
    {
        "id": "spot-3",
        "tags": "鸟类区,表演",
        "text": "鸟类区包含多种水禽与珍禽展示，互动与表演时间以园区广播为准。",
    },
    {
        "id": "tip-1",
        "tags": "天气,防晒,步行",
        "text": "园区面积较大，建议穿着舒适鞋服，夏季注意防晒与补水，冬季注意防风保暖。",
    },
]


def retrieve_chunks(query: str, top_k: int = 4) -> List[Dict[str, str]]:
    """简易检索：按字符重叠与关键词命中打分。"""
    q = query.strip().lower()
    if not q:
        return KNOWLEDGE_CHUNKS[:top_k]

    scored: List[Tuple[float, Dict[str, str]]] = []
    for ch in KNOWLEDGE_CHUNKS:
        text = (ch["text"] + " " + ch.get("tags", "")).lower()
        score = sum(1 for c in q if c in text)
        # 关键词 bonus
        for tok in ["猛兽", "食草", "鸟", "厕所", "超市", "安全", "投喂", "开放"]:
            if tok in q and tok in text:
                score += 3
        scored.append((score, ch))

    scored.sort(key=lambda x: x[0], reverse=True)
    out = [c for s, c in scored if s > 0][:top_k]
    if not out:
        return KNOWLEDGE_CHUNKS[:top_k]
    return out
