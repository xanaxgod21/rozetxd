#Requires -Version 5.1
<#
  rozetxd - Windows / PowerShell kurulum scripti

  Calistirma (PowerShell'i yonetici olarak ac):
    powershell -ExecutionPolicy Bypass -File .\setup.ps1

  Tekrar tekrar calistirilabilir: var olan .env dosyasinin uzerine yazmaz.
#>

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Info($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host " OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host " !   $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host " X   $m" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  rozetxd kurulumu (Windows)"
Write-Host "  --------------------------"
Write-Host ""

# --- 1) Node.js kontrolu -----------------------------------------------------
Info "Node.js kontrol ediliyor..."
try {
    $nodeV = (node -v)
} catch {
    Fail "Node.js kurulu degil. Kurmak icin: winget install OpenJS.NodeJS.LTS  (sonra PowerShell'i yeniden ac)"
}
$major = [int]($nodeV.TrimStart('v').Split('.')[0])
if ($major -lt 16) { Fail "Node.js $nodeV cok eski. En az v16, v20+ onerilir." }
Ok "Node.js $nodeV"

# --- 2) Bagimliliklar --------------------------------------------------------
Info "Bagimliliklar kuruluyor..."
if (Test-Path package-lock.json) { npm ci --omit=dev } else { npm install --omit=dev }
if ($LASTEXITCODE -ne 0) { Fail "npm kurulum hatasi." }
Ok "Bagimliliklar hazir"

# --- 3) .env -----------------------------------------------------------------
if (Test-Path .env) {
    Ok ".env zaten var, dokunulmadi"
} else {
    Info ".env olusturuluyor..."
    Copy-Item .env.example .env

    $secure = Read-Host "Discord user token (ekranda gorunmez)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    $hook = Read-Host "Webhook URL (yoksa bos birak)"

    if ($token) {
        # .env'i node ile yaz: token icindeki ozel karakterler bozulmasin
        $env:ROZET_TOKEN = $token
        $env:ROZET_HOOK = $hook
        node -e "const fs=require('fs');let t=fs.readFileSync('.env','utf8');t=t.replace(/^TOKEN=.*$/m,'TOKEN='+process.env.ROZET_TOKEN);if(process.env.ROZET_HOOK){t=t.replace(/^WEBHOOK_URL=.*$/m,'WEBHOOK_URL='+process.env.ROZET_HOOK);}fs.writeFileSync('.env',t);"
        Remove-Item Env:\ROZET_TOKEN, Env:\ROZET_HOOK -ErrorAction SilentlyContinue
        Ok ".env dolduruldu"
    } else {
        Warn "Token girilmedi. Elle duzenle: notepad .env"
    }
}

if (-not (Test-Path logs)) { New-Item -ItemType Directory -Path logs | Out-Null }

# --- 4) Yapilandirma dogrulama ----------------------------------------------
Info "Yapilandirma dogrulaniyor..."
node -e "require('./src/config').validate(); console.log('ok')" > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Ok "Yapilandirma gecerli"
} else {
    Warn "Yapilandirma eksik. notepad .env ile TOKEN'i doldur."
}

# --- 5) Calistirma secenekleri ----------------------------------------------
Write-Host ""
Write-Host "  Kurulum bitti. Calistirmak icin:"
Write-Host ""
Write-Host "    npm start" -ForegroundColor Green
Write-Host "    (SSH/PowerShell kapaninca durur - sadece test icin)"
Write-Host ""
Write-Host "  7/24 calismasi ve sunucu acilisinda otomatik baslamasi icin pm2:"
Write-Host "    npm install -g pm2 pm2-windows-startup" -ForegroundColor Green
Write-Host "    pm2-startup install" -ForegroundColor Green
Write-Host "    pm2 start ecosystem.config.js" -ForegroundColor Green
Write-Host "    pm2 save" -ForegroundColor Green
Write-Host ""
Write-Host "    pm2 logs rozetxd     # loglari izle"
Write-Host "    pm2 restart rozetxd  # yeniden baslat"
Write-Host ""
