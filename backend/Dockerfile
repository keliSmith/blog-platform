FROM python:3.10-slim

WORKDIR /app

# System deps for Pillow (image processing) + build tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libjpeg-dev zlib1g-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# 使用国内 PyPI 镜像, 避免官方源在服务器上超时卡死
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

COPY . .

# Ensure upload directory exists at startup (backend only mounts /uploads
# as static if the directory is present).
RUN mkdir -p /app/uploads

EXPOSE 8000

# Production: multiple workers for concurrency (gunicorn not required).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
