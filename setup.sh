#!/usr/bin/env bash
#
# rozetxd - VDS kurulum scripti
#
#   chmod +x setup.sh && ./setup.sh
#
# Tekrar tekrar çalıştırılabilir: var olan .env dosyasının üzerine yazmaz.

set -euo pipefail

cd "$(dirname "$0")"

RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BLUE=$'\033[36m'; RESET=$'\033[0m'
info()  { echo "${BLUE}==>${RESET} $*"; }
ok()    { echo "${GREEN} ✔${RESET} $*"; }
warn()  { echo "${YELLOW} !${RESET} $*"; }
fail()  { echo "${RED} ✘${RESET} $*" >&2; exit 1; }

echo
echo "  rozetxd kurulumu"
echo "  ----------------"
echo

# --- 1) Node.js kontrolü -----------------------------------------------------
info "Node.js sürümü kontrol ediliyor..."

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js kurulu değil. Kurmak için:
     curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
     sudo apt-get install -y nodejs"
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"

if [ "$NODE_MAJOR" -lt 16 ] || { [ "$NODE_MAJOR" -eq 16 ] && [ "$NODE_MINOR" -lt 9 ]; }; then
  fail "Node.js $(node -v) çok eski. En az v16.9 lazım, v20+ önerilir."
fi
ok "Node.js $(node -v)"

command -v npm >/dev/null 2>&1 || fail "npm bulunamadı."

# --- 2) Bağımlılıklar --------------------------------------------------------
info "Bağımlılıklar kuruluyor..."
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi
ok "Bağımlılıklar hazır"

# --- 3) .env -----------------------------------------------------------------
if [ -f .env ]; then
  ok ".env zaten var, dokunulmadı"
else
  info ".env oluşturuluyor..."
  cp .env.example .env
  chmod 600 .env

  # Terminal varsa token'ı sorarak dolduralım
  if [ -t 0 ]; then
    echo
    echo "  Token'ın ekranda görünmeyecek."
    printf "  Discord user token: "
    read -rs USER_TOKEN
    echo
    printf "  Webhook URL (yoksa boş geç): "
    read -r HOOK_URL
    echo

    if [ -n "$USER_TOKEN" ]; then
      # sed yerine node ile yaz: token içindeki özel karakterler bozulmasın
      TOKEN_VALUE="$USER_TOKEN" HOOK_VALUE="$HOOK_URL" node -e '
        const fs = require("fs");
        let text = fs.readFileSync(".env", "utf8");
        text = text.replace(/^TOKEN=.*$/m, "TOKEN=" + process.env.TOKEN_VALUE);
        if (process.env.HOOK_VALUE) {
          text = text.replace(/^WEBHOOK_URL=.*$/m, "WEBHOOK_URL=" + process.env.HOOK_VALUE);
        }
        fs.writeFileSync(".env", text);
      '
      ok ".env dolduruldu (izin: 600)"
    else
      warn "Token girilmedi. .env dosyasını elle düzenle: nano .env"
    fi
  else
    warn ".env örnekten oluşturuldu. Doldurmayı unutma: nano .env"
  fi
fi

chmod 600 .env 2>/dev/null || true
mkdir -p logs

# --- 4) Yapılandırma doğrulama ----------------------------------------------
info "Yapılandırma doğrulanıyor..."
if node -e 'require("./src/config").validate(); console.log("ok")' >/dev/null 2>&1; then
  ok "Yapılandırma geçerli"
else
  warn "Yapılandırma eksik. .env içindeki TOKEN dolu mu kontrol et."
fi

# --- 5) Çalıştırma seçenekleri ----------------------------------------------
echo
echo "  Kurulum bitti. Çalıştırmak için:"
echo
if command -v pm2 >/dev/null 2>&1; then
  echo "    ${GREEN}pm2 start ecosystem.config.js${RESET}   # 7/24 çalıştır"
  echo "    ${GREEN}pm2 logs rozetxd${RESET}                # logları izle"
  echo "    ${GREEN}pm2 save && pm2 startup${RESET}         # sunucu açılışında başlat"
else
  echo "    ${GREEN}npm start${RESET}                       # şimdilik dene (SSH kapanınca durur)"
  echo
  echo "  7/24 çalışması için pm2 öneririm:"
  echo "    ${GREEN}sudo npm install -g pm2${RESET}"
  echo "    ${GREEN}pm2 start ecosystem.config.js${RESET}"
fi
echo
