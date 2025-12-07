#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "============================================"
echo "   Starting SSH Server Setup for Container  "
echo "============================================"

# Set environment variables for non-interactive install
export DEBIAN_FRONTEND=noninteractive
export TERM=xterm-256color

# 1. Install dependencies
echo "[1/8] Installing dependencies..."
apt-get update
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
    findutils

# Clean up
apt-get clean
rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# 2. Pre-create SSH directories and keys
echo "[2/8] Configuring SSH directories..."
mkdir -p /var/run/sshd /root/.ssh
chmod 700 /root/.ssh

# 3. Generate SSH host keys
echo "[3/8] Generating SSH keys..."
ssh-keygen -A

# 4. Set root password
echo "[4/8] Setting root password..."
echo 'root:password123' | chpasswd

# 5. Configure SSH
echo "[5/8] Configuring sshd_config..."
# Modify existing config
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/UsePAM no/UsePAM yes/' /etc/ssh/sshd_config

# Append optimized settings
cat >> /etc/ssh/sshd_config <<EOF
PermitRootLogin yes
PasswordAuthentication yes
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
AcceptEnv LANG LC_*
PermitEmptyPasswords no
MaxAuthTries 6
MaxSessions 10
X11Forwarding no
PrintMotd no
UseDNS no
GSSAPIAuthentication no
EOF

# 6. Set up bash configuration
echo "[6/8] Configuring .bashrc..."
cat >> /root/.bashrc <<EOF
export PS1="\[\e[32m\]\u@\h\[\e[m\]:\[\e[34m\]\w\[\e[m\]\$ "
export TERM=xterm-256color
alias ll="ls -lah"
alias la="ls -A"
alias l="ls -CF"
EOF

# 7. Create working directory
echo "[7/8] Creating workspace..."
mkdir -p /workspace

# 8. Create welcome message
echo "[8/8] Creating welcome message..."
cat > /etc/profile.d/welcome.sh <<EOF
#!/bin/bash
echo "Welcome to your Linux container!"
echo ""
EOF
chmod +x /etc/profile.d/welcome.sh

# 9. Create entrypoint script
echo "[9/9] Creating entrypoint script..."
cat > /entrypoint.sh <<EOF
#!/bin/bash
set -e
# Start SSH in foreground with minimal logging
exec /usr/sbin/sshd -D -e
EOF
chmod +x /entrypoint.sh

echo "============================================"
echo "   Setup Complete!                          "
echo "============================================"
echo "You can now start the SSH server by running:"
echo "  /entrypoint.sh"
echo ""
