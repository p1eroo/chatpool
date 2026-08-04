#!/bin/bash
set -e
set -o pipefail

# ============================================================
#  Chatpool - Deploy Script
#  Frontend → /var/www/chatpool/  (nginx root de chat.taximonterrico.com)
#  Backend  → PM2 chatpool-api
# ============================================================

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DEST="${FRONTEND_DEST:-/var/www/chatpool}"
PM2_APP="${PM2_APP:-chatpool-api}"

header() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

ok()   { echo -e "  ${GREEN}✔${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
info() { echo -e "  ${GRAY}→${NC} $1"; }
fail() { echo -e "  ${RED}✖${NC} $1"; }

# ============================================================
header "Validando entorno"

cd "$SCRIPT_DIR"

if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
  fail "No se encontró backend/.env"
  exit 1
fi
ok "backend/.env encontrado"

if [ ! -f "$SCRIPT_DIR/frontend/.env" ]; then
  warn "frontend/.env no encontrado (se usarán defaults de Vite)"
else
  ok "frontend/.env encontrado"
fi

if ! command -v pm2 &>/dev/null; then
  fail "PM2 no instalado. Instálalo con: npm install -g pm2"
  exit 1
fi
ok "PM2 disponible"

# ============================================================
header "Frontend - dependencias y compilación"

cd "$SCRIPT_DIR/frontend"

BUILD_ID="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export VITE_APP_BUILD_ID="$BUILD_ID"
info "Build ID frontend: ${BUILD_ID}"

info "Instalando dependencias..."
npm install 2>&1 | tail -1
ok "Frontend dependencias instaladas"

info "Compilando..."
npm run build 2>&1 | tail -5
ok "Frontend compilado"

info "Copiando a ${FRONTEND_DEST}/..."
mkdir -p "$FRONTEND_DEST"
cp -r dist/* "$FRONTEND_DEST/"
ok "Frontend desplegado en ${FRONTEND_DEST}/"

# ============================================================
header "Backend - dependencias y compilación"

cd "$SCRIPT_DIR/backend"

info "Instalando dependencias..."
npm install 2>&1 | tail -1
ok "Backend dependencias instaladas"

if [ -x "node_modules/ffmpeg-static/ffmpeg" ] || [ -x "node_modules/ffmpeg-static/ffmpeg.exe" ]; then
  ok "ffmpeg-static disponible (audio WhatsApp)"
else
  warn "ffmpeg-static sin binario. Si falla el audio, revisa scripts de npm o instala ffmpeg del sistema"
fi

info "Generando cliente Prisma..."
npx prisma generate 2>&1 | tail -3
ok "Cliente Prisma generado"

info "Aplicando migraciones..."
npx prisma migrate deploy 2>&1 | tail -5
ok "Migraciones aplicadas"

info "Compilando con memoria extendida..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build 2>&1 | tail -5
ok "Backend compilado"

# ============================================================
header "Reiniciando servicio"

if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP"
  ok "${PM2_APP} reiniciado"
else
  warn "${PM2_APP} no existe en PM2; iniciando..."
  pm2 start dist/index.js --name "$PM2_APP" --cwd "$SCRIPT_DIR/backend"
  pm2 save
  ok "${PM2_APP} iniciado"
fi

# ============================================================
header "Verificando"

sleep 2

PORT=$(grep -oP '^PORT=\K\d+' "$SCRIPT_DIR/backend/.env" 2>/dev/null || echo "3001")

if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  ok "Backend respondiendo en puerto $PORT (/health)"
else
  warn "Backend no responde aún"
  info "Logs: pm2 logs ${PM2_APP}"
fi

# ============================================================
header "Listo"
echo ""
echo -e "  ${GREEN}${BOLD}Chatpool actualizado${NC}"
echo -e "  ${GRAY}Frontend: ${FRONTEND_DEST}${NC}"
echo -e "  ${GRAY}Backend:  pm2 ${PM2_APP} (puerto ${PORT})${NC}"
echo ""
