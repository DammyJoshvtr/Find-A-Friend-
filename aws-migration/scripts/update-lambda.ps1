# File: aws-migration/scripts/update-lambda.ps1
# Zips and updates the Cognito user migration Lambda function directly on AWS.

$ErrorActionPreference = "Stop"

# Define executable path
$AWS_PATH = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
$zipPath = "aws-migration/terraform/migration_lambda_payload.zip"
$tempDir = "aws-migration/temp-lambda"

Write-Output "=========================================================="
Write-Output "   Find-A-Friend: Package & Update Migration Lambda"
Write-Output "=========================================================="

# 1. Package the ZIP
Write-Output "[1/3] Packaging Lambda source code..."
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy files (cognito-lazy-migration.js and node_modules)
Copy-Item "aws-migration/lambda/cognito-lazy-migration.js" "$tempDir\" -Force
Copy-Item "aws-migration/lambda/node_modules" "$tempDir\" -Recurse -Force

# Create ZIP
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath

# Clean up temp folder
Remove-Item $tempDir -Recurse -Force
Write-Output "ZIP packaged successfully at $zipPath"

# 2. Deploy to AWS Lambda
Write-Output "[2/3] Deploying updated code to AWS Lambda (faf-cognito-lazy-migration-production)..."
& $AWS_PATH lambda update-function-code `
  --function-name faf-cognito-lazy-migration-production `
  --zip-file "fileb://$zipPath" `
  --no-verify-ssl | Out-Null

# 3. Clean up local ZIP
Write-Output "[3/3] Cleaning up local ZIP..."
Remove-Item $zipPath -Force

Write-Output "=========================================================="
Write-Output "   Lambda Function Code Updated Successfully!"
Write-Output "=========================================================="
