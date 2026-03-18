#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/jobPortal"
APP_USER="${SUDO_USER:-ubuntu}"
REPO_URL="https://github.com/jeffgithae/jobPortal.git"
BRANCH="main"
NODE_MAJOR="22"
API_PORT="3001"
DOMAIN=""
PUBLIC_ORIGIN=""
CORS_ORIGIN=""
MONGODB_URI=""
LETSENCRYPT_EMAIL=""
ENABLE_TLS="0"

usage() {
  cat <<'EOF'
Usage:
  sudo bash deploy/oracle/bootstrap-oracle-vm.sh \
    --domain jobs.example.com \
    --mongo-uri 'mongodb+srv://user:pass@cluster.mongodb.net/job-portal?retryWrites=true&w=majority' \
    --cors-origin 'https://jobs.example.com' \
    --letsencrypt-email you@example.com

Required:
  --mongo-uri            MongoDB connection string

Recommended:
  --domain               Public domain for Nginx and frontend runtime config

Optional:
  --public-origin        Override frontend/API public origin (defaults to https://<domain> or http://<domain>)
  --cors-origin          Override CORS_ORIGIN (defaults to PUBLIC_ORIGIN)
  --letsencrypt-email    Enable Let's Encrypt and HTTPS redirect
  --app-dir              Install location (default: /opt/jobPortal)
  --app-user             Linux user that will own and run the app (default: ubuntu or SUDO_USER)
  --repo-url             Git repository URL
  --branch               Git branch to deploy (default: main)
  --node-major           Node major version to install (default: 22)
  --api-port             Internal NestJS port (default: 3001)
EOF
}

run_repo_npm_install() {
  local target_dir="$1"
  if [[ -f "$target_dir/package-lock.json" ]]; then
    npm ci
  else
    npm install
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --public-origin)
      PUBLIC_ORIGIN="$2"
      shift 2
      ;;
    --cors-origin)
      CORS_ORIGIN="$2"
      shift 2
      ;;
    --mongo-uri)
      MONGODB_URI="$2"
      shift 2
      ;;
    --letsencrypt-email)
      LETSENCRYPT_EMAIL="$2"
      ENABLE_TLS="1"
      shift 2
      ;;
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --app-user)
      APP_USER="$2"
      shift 2
      ;;
    --repo-url)
      REPO_URL="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --node-major)
      NODE_MAJOR="$2"
      shift 2
      ;;
    --api-port)
      API_PORT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$MONGODB_URI" ]]; then
  echo "Error: --mongo-uri is required." >&2
  usage
  exit 1
fi

if [[ -z "$DOMAIN" && -z "$PUBLIC_ORIGIN" ]]; then
  echo "Error: provide --domain or --public-origin so the frontend knows its public URL." >&2
  usage
  exit 1
fi

if [[ -z "$PUBLIC_ORIGIN" ]]; then
  if [[ "$ENABLE_TLS" == "1" ]]; then
    PUBLIC_ORIGIN="https://$DOMAIN"
  else
    PUBLIC_ORIGIN="http://$DOMAIN"
  fi
fi

if [[ -z "$CORS_ORIGIN" ]]; then
  CORS_ORIGIN="$PUBLIC_ORIGIN"
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "Run this script with sudo or as root." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y curl git nginx ca-certificates build-essential gnupg

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" != "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$APP_USER"
fi

mkdir -p "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin
  sudo -u "$APP_USER" git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  rm -rf "$APP_DIR"
  sudo -u "$APP_USER" git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cat > "$APP_DIR/api/.env" <<EOF
PORT=$API_PORT
MONGODB_URI=$MONGODB_URI
CORS_ORIGIN=$CORS_ORIGIN
EOF
chown "$APP_USER":"$APP_USER" "$APP_DIR/api/.env"
chmod 600 "$APP_DIR/api/.env"

sudo -u "$APP_USER" bash -lc "$(declare -f run_repo_npm_install); cd '$APP_DIR/api' && run_repo_npm_install '$APP_DIR/api' && npm run build"
sudo -u "$APP_USER" bash -lc "$(declare -f run_repo_npm_install); cd '$APP_DIR/frontend' && run_repo_npm_install '$APP_DIR/frontend' && JOB_PORTAL_API_BASE_URL='$PUBLIC_ORIGIN/api' npm run build:cloudflare"

cat > /etc/systemd/system/jobportal-api.service <<EOF
[Unit]
Description=JobPortal NestJS API
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR/api
Environment=NODE_ENV=production
EnvironmentFile=$APP_DIR/api/.env
ExecStart=$(command -v node) dist/main
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/nginx/sites-available/jobportal.conf <<EOF
server {
    listen 80;
    server_name ${DOMAIN:-_};

    root $APP_DIR/frontend/dist/frontend/browser;
    index index.html;

    client_max_body_size 25m;

    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/jobportal.conf /etc/nginx/sites-enabled/jobportal.conf

systemctl daemon-reload
systemctl enable jobportal-api
systemctl restart jobportal-api
nginx -t
systemctl restart nginx
systemctl enable nginx

if [[ "$ENABLE_TLS" == "1" ]]; then
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$LETSENCRYPT_EMAIL" --redirect
fi

echo
echo "Deployment complete."
echo "Public app URL: $PUBLIC_ORIGIN"
echo "API health: $PUBLIC_ORIGIN/api/health"
echo "Systemd service: jobportal-api"
echo "Nginx config: /etc/nginx/sites-available/jobportal.conf"
