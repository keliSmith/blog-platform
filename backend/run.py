"""Development server entry point."""

import os

import uvicorn

if __name__ == "__main__":
    # reload 默认关闭，避免 uvicorn reloader 产生"孤儿 worker"：
    # 父进程被杀后，子 worker 仍监听端口并跑着旧代码，形成"陈旧后端"
    # （表现为改了代码却不生效、误以为是代码 bug）。
    # 开发需要热重载时，显式设置环境变量 APP_RELOAD=1。
    reload_enabled = os.getenv("APP_RELOAD", "0") == "1"
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=reload_enabled,
    )
