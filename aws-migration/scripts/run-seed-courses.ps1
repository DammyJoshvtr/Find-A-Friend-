# File: aws-migration/scripts/run-seed-courses.ps1
#
# 1. Deploys a temporary VPC Lambda to seed course data into public.courses.
# 2. Invokes the Lambda and prints the response.
# 3. Cleans up the Lambda and zip file.

$ErrorActionPreference = "Stop"
$AWS_PATH = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"

Write-Output "============================================================"
Write-Output "   Find-A-Friend: Seed Courses into RDS Database"
Write-Output "============================================================"

Write-Output "[1/6] Retrieving VPC resources from CloudFormation Stack..."

$roleName = & $AWS_PATH cloudformation list-stack-resources `
  --stack-name faf-infra-prod-v2 `
  --query "StackResourceSummaries[?LogicalResourceId=='LambdaExecutionRole'].PhysicalResourceId" `
  --output text --no-verify-ssl
$roleName = $roleName.Trim()
$roleArn = & $AWS_PATH iam get-role --role-name $roleName --query "Role.Arn" --output text --no-verify-ssl
$roleArn = $roleArn.Trim()
Write-Output "  Role ARN: $roleArn"

$subnetsList = & $AWS_PATH cloudformation list-stack-resources `
  --stack-name faf-infra-prod-v2 `
  --query "StackResourceSummaries[?LogicalResourceId=='PrivateSubnet1' || LogicalResourceId=='PrivateSubnet2'].PhysicalResourceId" `
  --output text --no-verify-ssl
$subnetIds = ($subnetsList -split '\s+' | Where-Object {$_}) -join ','
Write-Output "  Subnets: $subnetIds"

$sgId = & $AWS_PATH cloudformation list-stack-resources `
  --stack-name faf-infra-prod-v2 `
  --query "StackResourceSummaries[?LogicalResourceId=='LambdaSecurityGroup'].PhysicalResourceId" `
  --output text --no-verify-ssl
$sgId = $sgId.Trim()
Write-Output "  Security Group: $sgId"

$rdsHost = & $AWS_PATH cloudformation describe-stacks `
  --stack-name faf-infra-prod-v2 `
  --query "Stacks[0].Outputs[?OutputKey=='RDSEndpoint'].OutputValue" `
  --output text --no-verify-ssl
$rdsHost = $rdsHost.Trim()
Write-Output "  RDS Host: $rdsHost"

$rdsPassword = $env:RDS_PASSWORD
if (-Not $rdsPassword) { $rdsPassword = "wG9cTdjIGynxAStS" }

Write-Output "[2/6] Packaging seed-courses Lambda ZIP..."
$tempDir = "aws-migration\temp-seed-courses"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null
Copy-Item "aws-migration\scripts\seed-courses.js" "$tempDir\index.js" -Force
Copy-Item "aws-migration\lambda\node_modules" "$tempDir\node_modules" -Recurse -Force
$zipPath = "aws-migration\vpc_seed_courses_payload.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath
Remove-Item $tempDir -Recurse -Force
Write-Output "  ZIP created: $zipPath"

Write-Output "[3/6] Deploying seed-courses Lambda to VPC..."
$funcName = "faf-temp-seed-courses"
try {
    & $AWS_PATH lambda delete-function --function-name $funcName --no-verify-ssl 2>$null | Out-Null
    Write-Output "  Removed existing function."
} catch {}

& $AWS_PATH lambda create-function `
  --function-name $funcName `
  --runtime nodejs18.x `
  --role $roleArn `
  --handler index.handler `
  --zip-file "fileb://$zipPath" `
  --vpc-config "SubnetIds=$subnetIds,SecurityGroupIds=$sgId,Ipv6AllowedForDualStack=true" `
  --timeout 120 `
  --memory-size 256 `
  --environment "Variables={RDS_HOST=$rdsHost,RDS_PASSWORD=$rdsPassword}" `
  --no-verify-ssl | Out-Null

Write-Output "  Waiting for Lambda to become Active..."
$state = "Pending"
$retries = 0
while ($state -ne "Active" -and $retries -lt 30) {
    Start-Sleep -Seconds 5
    $stateInfo = & $AWS_PATH lambda get-function-configuration --function-name $funcName --query "State" --output text --no-verify-ssl
    $state = $stateInfo.Trim()
    Write-Output "  State: $state"
    $retries++
}
if ($state -ne "Active") { throw "Lambda did not become Active (state: $state)" }

Write-Output "[4/6] Invoking seed-courses Lambda..."
$responseFile = "aws-migration\seed-courses-response.json"
if (Test-Path $responseFile) { Remove-Item $responseFile -Force }
& $AWS_PATH lambda invoke --function-name $funcName --no-verify-ssl $responseFile | Out-Null
$response = Get-Content $responseFile | Out-String
Write-Output "Response: $response"

Write-Output "  Cleaning up seed-courses Lambda..."
& $AWS_PATH lambda delete-function --function-name $funcName --no-verify-ssl | Out-Null
Remove-Item $zipPath -Force
Remove-Item $responseFile -Force

Write-Output "============================================================"
Write-Output "   Seeding Complete!"
Write-Output "============================================================"
