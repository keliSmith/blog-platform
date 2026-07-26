FROM mcr.microsoft.com/devcontainers/python:3.13

# System dependencies for Pillow (image processing) and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libjpeg-dev \
    zlib1g-dev \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22 LTS from China mirror (npmmirror) — bypasses Dev Container
# feature mechanism which can fail on slow/unstable networks.
RUN curl -fsSL "https://registry.npmmirror.com/-/binary/node/v22.23.1/node-v22.23.1-linux-x64.tar.xz" \
    -o /tmp/node.tar.xz && \
    tar -xJ -C /usr/local --strip-components=1 -f /tmp/node.tar.xz && \
    rm /tmp/node.tar.xz

# Verify all required tools are available
RUN python --version && node --version && npm --version && git --version
