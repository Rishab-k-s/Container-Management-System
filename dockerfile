# OPTIMIZED Debian SSH Container
# This version starts SSH server faster

FROM debian:latest

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    TERM=xterm-256color

# OPTIMIZATION: Install everything in one layer to reduce build time
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    openssh-server \
    bash \
    coreutils \
    util-linux \
    procps \
    net-tools \
    iproute2 \
    iputils-ping \
    curl \
    wget \
    vim \
    nano \
    git \
    sudo \
    man-db \
    less \
    grep \
    sed \
    gawk \
    tar \
    gzip \
    bzip2 \
    unzip \
    tree \
    htop \
    ncurses-bin \
    file \
    findutils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# OPTIMIZATION: Pre-create SSH directories and keys
RUN mkdir -p /var/run/sshd /root/.ssh && \
    chmod 700 /root/.ssh

# OPTIMIZATION: Generate ALL SSH host keys in one command
RUN ssh-keygen -A

# OPTIMIZATION: Set root password
RUN echo 'root:password123' | chpasswd

# OPTIMIZATION: Configure SSH in one go with optimized settings
RUN { \
    echo 'PermitRootLogin yes'; \
    echo 'PasswordAuthentication yes'; \
    echo 'PubkeyAuthentication yes'; \
    echo 'ChallengeResponseAuthentication no'; \
    echo 'UsePAM no'; \
    echo 'AcceptEnv LANG LC_*'; \
    echo 'Subsystem sftp /usr/lib/openssh/sftp-server'; \
    echo 'PermitEmptyPasswords no'; \
    echo 'MaxAuthTries 6'; \
    echo 'MaxSessions 10'; \
    echo 'X11Forwarding no'; \
    echo 'PrintMotd no'; \
    echo 'UseDNS no'; \
    echo 'GSSAPIAuthentication no'; \
    } >> /etc/ssh/sshd_config

# OPTIMIZATION: Set up bash configuration in one layer
RUN { \
    echo 'export PS1="\[\e[32m\]\u@\h\[\e[m\]:\[\e[34m\]\w\[\e[m\]\$ "'; \
    echo 'export TERM=xterm-256color'; \
    echo 'alias ll="ls -lah"'; \
    echo 'alias la="ls -A"'; \
    echo 'alias l="ls -CF"'; \
    } >> /root/.bashrc

# Create working directory
RUN mkdir -p /workspace
WORKDIR /workspace

# OPTIMIZATION: Simplified welcome message
RUN { \
    echo '#!/bin/bash'; \
    echo 'echo "Welcome to your Linux container!"'; \
    echo 'echo ""'; \
    } > /etc/profile.d/welcome.sh && \
    chmod +x /etc/profile.d/welcome.sh

# Expose SSH port
EXPOSE 22

# OPTIMIZATION: Ultra-fast entrypoint - no unnecessary checks
# The SSH keys are already generated, so we just start the server
RUN { \
    echo '#!/bin/bash'; \
    echo 'set -e'; \
    echo '# Start SSH in foreground with minimal logging'; \
    echo 'exec /usr/sbin/sshd -D -e'; \
    } > /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Use the optimized entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# OPTIMIZATION: Add healthcheck for Docker
HEALTHCHECK --interval=1s --timeout=1s --start-period=1s --retries=10 \
  CMD test -f /var/run/sshd.pid || exit 1