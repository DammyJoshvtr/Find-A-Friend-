# File: aws-migration/scripts/run-vpc-migration.ps1
#
# Programmatic VPC Database Migration Runner (AWS Cloud Native)
#
# This script packages the node database migrator, deploys it as a temporary
# Lambda function inside the private VPC, invokes it to complete the schema
# and data transfer, and deletes the function afterwards.

$ErrorActionPreference = "Stop"

# Set default AWS region for CLI calls
$env:AWS_DEFAULT_REGION = "us-east-1"
$env:AWS_REGION = "us-east-1"

# Define executable path
$AWS_PATH = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"

Write-Output "=========================================================="
Write-Output "   Find-A-Friend: Cloud-Native VPC DB Migration"
Write-Output "=========================================================="

# 1. Retrieve resource details from AWS
Write-Output "[1/5] Retrieving network and IAM security credentials..."

# Fetch the Lambda execution role ARN created by CloudFormation
$roleName = & $AWS_PATH cloudformation list-stack-resources --stack-name faf-infra-prod-v2 --query "StackResourceSummaries[?LogicalResourceId=='LambdaExecutionRole'].PhysicalResourceId" --output text --no-verify-ssl
$roleName = $roleName.Trim()
$roleArn = & $AWS_PATH iam get-role --role-name $roleName --query "Role.Arn" --output text --no-verify-ssl
$roleArn = $roleArn.Trim()
Write-Output "VPC Lambda Execution Role: $roleArn"

# Fetch the Subnets and Security Groups created by CloudFormation
$subnetsList = & $AWS_PATH cloudformation list-stack-resources --stack-name faf-infra-prod-v2 --query "StackResourceSummaries[?LogicalResourceId=='PrivateSubnet1' || LogicalResourceId=='PrivateSubnet2'].PhysicalResourceId" --output text --no-verify-ssl
$subnetIds = ($subnetsList -split '\s+' | Where-Object {$_}) -join ','
Write-Output "VPC Private Subnets: $subnetIds"

$sgId = & $AWS_PATH cloudformation list-stack-resources --stack-name faf-infra-prod-v2 --query "StackResourceSummaries[?LogicalResourceId=='LambdaSecurityGroup'].PhysicalResourceId" --output text --no-verify-ssl
$sgId = $sgId.Trim()
Write-Output "VPC Security Group: $sgId"

$rdsHost = & $AWS_PATH cloudformation describe-stacks --stack-name faf-infra-prod-v2 --query "Stacks[0].Outputs[?OutputKey=='RDSEndpoint'].OutputValue" --output text --no-verify-ssl
$rdsHost = $rdsHost.Trim()
Write-Output "RDS Postgres Endpoint: $rdsHost"

# 2. Package the Migrator Zip
Write-Output "[2/5] Creating temporary Lambda ZIP package..."
$tempDir = "aws-migration\temp-migrator"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null
New-Item -ItemType Directory -Path "$tempDir\supabase" | Out-Null

# Copy scripts and migrations
Copy-Item "aws-migration\scripts\migrate-db.js" "$tempDir\index.js" -Force
Copy-Item "supabase\migrations" "$tempDir\supabase\migrations" -Recurse -Force
Copy-Item "aws-migration\lambda\node_modules" "$tempDir\node_modules" -Recurse -Force

# Create ZIP
$zipPath = "aws-migration\vpc_migrator_payload.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath

# Clean up temp folder
Remove-Item $tempDir -Recurse -Force

# 3. Create the temporary Lambda Function
Write-Output "[3/5] Deploying temporary migration Lambda function to your VPC..."
$funcName = "faf-temp-db-migrator"

# Get password variables from environment
$supabasePassword = $env:SUPABASE_PASSWORD
$rdsPassword = $env:RDS_PASSWORD

if (-Not $supabasePassword) {
    throw "SUPABASE_PASSWORD environment variable is not set."
}
if (-Not $rdsPassword) {
    $rdsPassword = "wG9cTdjIGynxAStS" # Default generated password
}

& $AWS_PATH lambda create-function `
  --function-name $funcName `
  --runtime nodejs18.x `
  --role $roleArn `
  --handler index.handler `
  --zip-file "fileb://$zipPath" `
  --vpc-config "SubnetIds=$subnetIds,SecurityGroupIds=$sgId,Ipv6AllowedForDualStack=true" `
  --timeout 300 `
  --memory-size 256 `
  --environment "Variables={SUPABASE_PASSWORD=$supabasePassword,RDS_PASSWORD=$rdsPassword}" `
  --no-verify-ssl | Out-Null

# Wait for the Lambda to become active (VPC ENI attachment is async)
Write-Output "Waiting for Lambda function to become Active (VPC attachment)..."
$state = "Pending"
$retries = 0
while ($state -eq "Pending" -and $retries -lt 30) {
    Start-Sleep -Seconds 5
    $stateInfo = & $AWS_PATH lambda get-function-configuration --function-name $funcName --query "State" --output text --no-verify-ssl
    $state = $stateInfo.Trim()
    Write-Output "Current Lambda state: $state"
    $retries++
}
if ($state -ne "Active") {
    throw "Lambda function failed to reach Active state (current: $state)"
}

# 4. Invoke the Lambda function
Write-Output "[4/5] Running migration inside AWS (connecting Supabase to RDS)..."
$responseFile = "aws-migration\migration-response.json"
if (Test-Path $responseFile) {
    Remove-Item $responseFile -Force
}

& $AWS_PATH lambda invoke `
  --function-name $funcName `
  --no-verify-ssl `
  $responseFile | Out-Null

# Read response
$response = Get-Content $responseFile | Out-String
Write-Output "Migration Response: $response"

# 5. Clean up AWS Lambda and Local ZIP
Write-Output "[5/5] Tearing down temporary AWS resources..."
& $AWS_PATH lambda delete-function --function-name $funcName --no-verify-ssl | Out-Null
Remove-Item $zipPath -Force
Remove-Item $responseFile -Force

Write-Output "=========================================================="
Write-Output "   Cloud-Native Database Migration Completed Successfully!"
Write-Output "=========================================================="
