param(
    [string]$message = "OTA update"
)

Write-Host "Deploying to Android (EAS) and PWA (Vercel) simultaneously..." -ForegroundColor Cyan

$easJob = Start-Job -ScriptBlock {
    param($msg)
    Set-Location "c:\Users\Ayomide Enoch\Desktop\FAF\faf"
    npx eas update --branch production --message $msg 2>&1
} -ArgumentList $message

$vercelJob = Start-Job -ScriptBlock {
    Set-Location "c:\Users\Ayomide Enoch\Desktop\FAF\faf"
    npx expo export --platform web 2>&1
    npx vercel deploy dist --prod 2>&1
}

Write-Host "Both deployments running in parallel..." -ForegroundColor Yellow

Wait-Job $easJob, $vercelJob | Out-Null

Write-Host "`n--- EAS (Android) Result ---" -ForegroundColor Green
Receive-Job $easJob

Write-Host "`n--- Vercel (PWA) Result ---" -ForegroundColor Green
Receive-Job $vercelJob

Remove-Job $easJob, $vercelJob
Write-Host "`nAll deployments complete!" -ForegroundColor Cyan
