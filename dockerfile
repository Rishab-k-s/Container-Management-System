# Use the latest Debian image
FROM debian:latest

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV TERM=xterm-256color

# Install OpenSSH server and essential Linux tools
RUN apt-get update && \
    apt-get install -y \
    openssh-server \
    bash \
    coreutils \
    util-linux \
    procps \
    net-tools \
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
    awk \
    tar \
    gzip \
    bzip2 \
    unzip \
    tree \
    htop \
    ncurses-bin \
    file \
    findutils \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create the directory for the SSH daemon to run
RUN mkdir -p /var/run/sshd

# Generate SSH host keys
RUN ssh-keygen -A

# Set a root password
RUN echo 'root:password123' | chpasswd

# Configure SSH for better compatibility and security
RUN sed -i 's/^#*PermitRootLogin .*/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/^#*PasswordAuthentication .*/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/^#*PubkeyAuthentication .*/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/^#*ChallengeResponseAuthentication .*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/UsePAM yes/UsePAM no/' /etc/ssh/sshd_config && \
    echo "AcceptEnv LANG LC_*" >> /etc/ssh/sshd_config && \
    echo "Subsystem sftp /usr/lib/openssh/sftp-server" >> /etc/ssh/sshd_config && \
    echo "PermitEmptyPasswords no" >> /etc/ssh/sshd_config && \
    echo "MaxAuthTries 6" >> /etc/ssh/sshd_config && \
    echo "MaxSessions 10" >> /etc/ssh/sshd_config

# Verify SSH host keys exist
RUN ls -la /etc/ssh/ssh_host_* || echo "Warning: SSH host keys missing!"

# Set up bash as default shell
RUN chsh -s /bin/bash root

# Create a nice bash prompt
RUN echo 'export PS1="\[\e[32m\]\u@\h\[\e[m\]:\[\e[34m\]\w\[\e[m\]\$ "' >> /root/.bashrc && \
    echo 'export TERM=xterm-256color' >> /root/.bashrc && \
    echo 'alias ll="ls -lah"' >> /root/.bashrc && \
    echo 'alias la="ls -A"' >> /root/.bashrc && \
    echo 'alias l="ls -CF"' >> /root/.bashrc

# Create a working directory
RUN mkdir -p /workspace
WORKDIR /workspace

# Create a welcome message
RUN echo '#!/bin/bash' > /etc/profile.d/welcome.sh && \
    echo 'echo "Welcome to your Linux container!"' >> /etc/profile.d/welcome.sh && \
    echo 'echo "Type '\''help'\'' for common commands or '\''man <command>'\'' for documentation."' >> /etc/profile.d/welcome.sh && \
    echo 'echo ""' >> /etc/profile.d/welcome.sh && \
    chmod +x /etc/profile.d/welcome.sh

# Expose SSH port
EXPOSE 22

# Create an entrypoint script to ensure SSH starts properly
RUN echo '#!/bin/bash' > /entrypoint.sh && \
    echo 'echo "Starting SSH server..."' >> /entrypoint.sh && \
    echo 'ls -la /etc/ssh/ssh_host_* || ssh-keygen -A' >> /entrypoint.sh && \
    echo 'exec /usr/sbin/sshd -D -e' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Use the entrypoint script
ENTRYPOINT ["/entrypoint.sh"]