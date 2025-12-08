# OPTIMIZED Python Development Container

FROM debian:latest

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    TERM=xterm-256color

# Install Python and system tools in one layer
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    bash \
    curl \
    wget \
    git \
    vim \
    nano \
    tree \
    htop \
    less \
    sudo \
    ca-certificates \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Upgrade pip once (build-time)
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel

# Bash configuration
RUN { \
    echo 'export PS1="\[\e[32m\]\u@\h\[\e[m\]:\[\e[34m\]\w\[\e[m\]\$ "'; \
    echo 'alias ll="ls -lah"'; \
    echo 'alias python="python3"'; \
    echo 'alias pip="pip3"'; \
    } >> /root/.bashrc

# Workspace
RUN mkdir -p /workspace
WORKDIR /workspace

# Simple entrypoint
RUN { \
    echo '#!/bin/bash'; \
    echo 'set -e'; \
    echo 'exec "$@"'; \
    } > /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["python3"]

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python3 --version || exit 1
