# 秦皇岛野生动物园 AI 导览 — 后端镜像（FastAPI）
# 说明：微信小程序前端在微信开发者工具本地编译，不放入此镜像；本镜像用于部署 API 服务。

FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
COPY sql /app/sql

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
