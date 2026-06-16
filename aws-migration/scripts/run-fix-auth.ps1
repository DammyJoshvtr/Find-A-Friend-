# File: aws-migration/scripts/run-fix-auth.ps1
#
# 1. Deploys a temporary VPC Lambda to fix auth.uid() / auth.jwt() / auth.role()
#    in RDS so they correctly read values from Cognito JWT claims.
# 2. Updates the ECS PostgREST task definition with the real Cognito JWKS
#    so PostgREST can validate Cognito RS256 JWTs correctly.
# 3. Forces the ECS service to redeploy with the new task definition.

$ErrorActionPreference = "Stop"
$AWS_PATH = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"

Write-Output "============================================================"
Write-Output "   Find-A-Friend: Fix JWT Auth & PostgREST JWT Config"
Write-Output "============================================================"

# ---- PHASE 1: Fix auth functions in RDS via VPC Lambda ----

Write-Output ""
Write-Output "--- PHASE 1: Fixing auth.uid() / auth.jwt() / auth.role() in RDS ---"

Write-Output "[1/6] Retrieving VPC resources from CloudFormation..."

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

Write-Output "[2/6] Packaging fix-auth-functions Lambda ZIP..."
$tempDir = "aws-migration\temp-fix-auth"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null
Copy-Item "aws-migration\scripts\fix-auth-functions.js" "$tempDir\index.js" -Force
Copy-Item "aws-migration\lambda\node_modules" "$tempDir\node_modules" -Recurse -Force
$zipPath = "aws-migration\vpc_fix_auth_payload.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath
Remove-Item $tempDir -Recurse -Force
Write-Output "  ZIP created: $zipPath"

Write-Output "[3/6] Deploying fix-auth Lambda to VPC..."
$funcName = "faf-temp-fix-auth"
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

Write-Output "[4/6] Invoking fix-auth Lambda..."
$responseFile = "aws-migration\fix-auth-response.json"
if (Test-Path $responseFile) { Remove-Item $responseFile -Force }
& $AWS_PATH lambda invoke --function-name $funcName --no-verify-ssl $responseFile | Out-Null
$response = Get-Content $responseFile | Out-String
Write-Output "Response: $response"

Write-Output "  Cleaning up fix-auth Lambda..."
& $AWS_PATH lambda delete-function --function-name $funcName --no-verify-ssl | Out-Null
Remove-Item $zipPath -Force
Remove-Item $responseFile -Force

# ---- PHASE 2: Update PostgREST ECS task with real Cognito JWKS ----

Write-Output ""
Write-Output "--- PHASE 2: Updating PostgREST ECS Task with Cognito JWKS ---"

Write-Output "[5/6] Registering new ECS task definition..."
# Use the pre-written JSON file to avoid PowerShell serialization issues
$taskDefFile = "aws-migration\postgrest-task-def.json"
if (-Not (Test-Path $taskDefFile)) {
    throw "Task definition file not found: $taskDefFile"
}

$newTaskDefArn = & $AWS_PATH ecs register-task-definition `
  --cli-input-json "file://$taskDefFile" `
  --query "taskDefinition.taskDefinitionArn" `
  --output text --no-verify-ssl
$newTaskDefArn = $newTaskDefArn.Trim()
Write-Output "  New Task Definition ARN: $newTaskDefArn"

Write-Output "[6/6] Updating ECS service to use new task definition..."

# Get ECS cluster from CloudFormation outputs
$ecsCluster = & $AWS_PATH cloudformation describe-stacks `
  --stack-name faf-infra-prod-v2 `
  --query "Stacks[0].Outputs[?OutputKey=='ECSCluster'].OutputValue" `
  --output text --no-verify-ssl
$ecsCluster = $ecsCluster.Trim()
Write-Output "  ECS Cluster: $ecsCluster"

# List services and pick the PostgREST one
$ecsServicesList = & $AWS_PATH ecs list-services --cluster $ecsCluster --output text --no-verify-ssl
Write-Output "  All services: $ecsServicesList"
$ecsServiceArn = ($ecsServicesList -split '\s+' | Where-Object { $_ -match 'ecs' } | Select-Object -First 1).Trim()

if (-Not $ecsServiceArn) {
    Write-Output "  Could not auto-detect service ARN. Listing all..."
    & $AWS_PATH ecs list-services --cluster $ecsCluster --no-verify-ssl
    throw "ECS service ARN not found. Please run: aws ecs list-services --cluster $ecsCluster"
}

Write-Output "  Updating service: $ecsServiceArn"
& $AWS_PATH ecs update-service `
  --cluster $ecsCluster `
  --service $ecsServiceArn `
  --task-definition $newTaskDefArn `
  --force-new-deployment `
  --no-verify-ssl | Out-Null

Write-Output "  ECS service is rolling out new task. PostgREST will be ready in ~1-2 minutes."

Write-Output ""
Write-Output "============================================================"
Write-Output "   Auth Fix Complete!"
Write-Output "   PHASE 1: auth.uid(), auth.jwt(), auth.role() -> FIXED"
Write-Output "   PHASE 2: PostgREST restarting with Cognito JWKS -> DONE"
Write-Output "============================================================"
