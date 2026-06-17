# File: aws-migration/scripts/run-add-last-seen-at.ps1
#
# Deploys a temporary Lambda function inside the private VPC to execute the database
# updates on AWS RDS, then forces a redeployment of the ECS PostgREST service
# to clear its schema cache. Cleans up the Lambda after execution.

$ErrorActionPreference = "Stop"
$AWS_PATH = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"

Write-Output "============================================================"
Write-Output "   Find-A-Friend: Run RDS Database Presence Schema Update"
Write-Output "============================================================"

# 1. Retrieve VPC resources from CloudFormation
Write-Output "[1/5] Retrieving network and IAM credentials from CloudFormation..."

$roleName = & $AWS_PATH cloudformation list-stack-resources `
  --stack-name faf-infra-prod-v2 `
  --query "StackResourceSummaries[?LogicalResourceId=='LambdaExecutionRole'].PhysicalResourceId" `
  --output text --no-verify-ssl
$roleName = $roleName.Trim()
$roleArn = & $AWS_PATH iam get-role --role-name $roleName --query "Role.Arn" --output text --no-verify-ssl
$roleArn = $roleArn.Trim()
Write-Output "Lambda Execution Role ARN: $roleArn"

$subnetsList = & $AWS_PATH cloudformation list-stack-resources `
  --stack-name faf-infra-prod-v2 `
  --query "StackResourceSummaries[?LogicalResourceId=='PrivateSubnet1' || LogicalResourceId=='PrivateSubnet2'].PhysicalResourceId" `
  --output text --no-verify-ssl
$subnetIds = ($subnetsList -split '\s+' | Where-Object {$_}) -join ','
Write-Output "VPC Private Subnets: $subnetIds"

$sgId = & $AWS_PATH cloudformation list-stack-resources `
  --stack-name faf-infra-prod-v2 `
  --query "StackResourceSummaries[?LogicalResourceId=='LambdaSecurityGroup'].PhysicalResourceId" `
  --output text --no-verify-ssl
$sgId = $sgId.Trim()
Write-Output "Security Group: $sgId"

$rdsHost = & $AWS_PATH cloudformation describe-stacks `
  --stack-name faf-infra-prod-v2 `
  --query "Stacks[0].Outputs[?OutputKey=='RDSEndpoint'].OutputValue" `
  --output text --no-verify-ssl
$rdsHost = $rdsHost.Trim()
Write-Output "RDS Endpoint: $rdsHost"

$rdsPassword = $env:RDS_PASSWORD
if (-Not $rdsPassword) {
    $rdsPassword = "wG9cTdjIGynxAStS"
}

# 2. Package the add-last-seen-at Lambda
Write-Output "[2/5] Packaging Lambda ZIP..."
$tempDir = "aws-migration\temp-add-last-seen-at"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

Copy-Item "aws-migration\scripts\add_last_seen_at.js" "$tempDir\index.js" -Force
Copy-Item "aws-migration\lambda\node_modules" "$tempDir\node_modules" -Recurse -Force

$zipPath = "aws-migration\vpc_add_last_seen_at_payload.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath
Remove-Item $tempDir -Recurse -Force
Write-Output "ZIP created: $zipPath"

# 3. Deploy the Lambda inside the VPC
Write-Output "[3/5] Deploying add-last-seen-at Lambda to VPC..."
$funcName = "faf-temp-add-last-seen-at"

# Delete stale function if it exists
try {
    & $AWS_PATH lambda delete-function --function-name $funcName --no-verify-ssl 2>$null | Out-Null
    Write-Output "Removed existing function $funcName"
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

# 4. Wait for Lambda to become Active
Write-Output "Waiting for Lambda to become Active (VPC ENI attachment)..."
$state = "Pending"
$retries = 0
while ($state -ne "Active" -and $retries -lt 30) {
    Start-Sleep -Seconds 5
    $stateInfo = & $AWS_PATH lambda get-function-configuration `
      --function-name $funcName `
      --query "State" --output text --no-verify-ssl
    $state = $stateInfo.Trim()
    Write-Output "  Lambda state: $state"
    $retries++
}
if ($state -ne "Active") {
    throw "Lambda did not become Active (final state: $state)"
}

# 5. Invoke the Lambda
Write-Output "[4/5] Invoking add-last-seen-at Lambda..."
$responseFile = "aws-migration\add-last-seen-at-response.json"
if (Test-Path $responseFile) { Remove-Item $responseFile -Force }

& $AWS_PATH lambda invoke `
  --function-name $funcName `
  --no-verify-ssl `
  $responseFile | Out-Null

$response = Get-Content $responseFile | Out-String
Write-Output "Lambda Response:"
Write-Output $response

# 6. Clean up Lambda
Write-Output "[5/5] Cleaning up temporary Lambda and files..."
& $AWS_PATH lambda delete-function --function-name $funcName --no-verify-ssl | Out-Null
Remove-Item $zipPath -Force
Remove-Item $responseFile -Force

# 7. Force PostgREST Redeployment to Refresh Schema Cache
Write-Output "------------------------------------------------------------"
Write-Output "   Forcing PostgREST ECS service redeployment..."
Write-Output "------------------------------------------------------------"

$ecsCluster = & $AWS_PATH cloudformation describe-stacks `
  --stack-name faf-infra-prod-v2 `
  --query "Stacks[0].Outputs[?OutputKey=='ECSCluster'].OutputValue" `
  --output text --no-verify-ssl
$ecsCluster = $ecsCluster.Trim()
Write-Output "ECS Cluster: $ecsCluster"

$ecsServicesList = & $AWS_PATH ecs list-services --cluster $ecsCluster --output text --no-verify-ssl
$ecsServiceArn = ($ecsServicesList -split '\s+' | Where-Object { $_ -match 'ecs' } | Select-Object -First 1).Trim()
Write-Output "ECS Service: $ecsServiceArn"

& $AWS_PATH ecs update-service `
  --cluster $ecsCluster `
  --service $ecsServiceArn `
  --force-new-deployment `
  --no-verify-ssl | Out-Null

Write-Output "ECS service redeployment forced. PostgREST will reload schema in 1-2 minutes."
Write-Output "============================================================"
Write-Output "   RDS Schema Updated and Cache Refreshed Successfully!"
Write-Output "============================================================"
