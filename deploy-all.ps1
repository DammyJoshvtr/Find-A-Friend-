param(
    [string]$message = "OTA update"
)

Write-Host "Deploying to Android (EAS) and PWA (Vercel) sequentially to avoid locks..." -ForegroundColor Cyan

Set-Location $PSScriptRoot

# 1. Export the Web build (PWA)
Write-Host "`n--- Exporting Web build ---" -ForegroundColor Yellow
npx expo export --platform web

# Rename node_modules to vendor to bypass Vercel deployment rules
node rename-node-modules.js

# 2. Copy Vercel project configuration to dist/
Write-Host "`n--- Preparing Vercel project configuration ---" -ForegroundColor Yellow
Remove-Item -Path "dist\.vercel" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path ".vercel" -Destination "dist\" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path "vercel.json" -Destination "dist\" -Force

# 3. Deploy to Vercel (PWA)
Write-Host "`n--- Deploying PWA to Vercel ---" -ForegroundColor Yellow
npx vercel deploy dist --prod

# 4. Deploy EAS Update (Android & iOS)
Write-Host "`n--- Deploying EAS update ---" -ForegroundColor Yellow
npx eas update --branch production --message $message

Write-Host "`nAll deployments complete!" -ForegroundColor Cyan
