# File: aws-migration/scripts/run-check-user.ps1

$ErrorActionPreference = "Stop"
$AWS_PATH = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"

$roleName = & $AWS_PATH cloudformation list-stack-resources `
  --stack-name faf-infra-prod-v2 `
  --query "StackResourceSummaries[?LogicalResourceId=='LambdaExecutionRole'].PhysicalResourceId" `
  --output text --no-verify-ssl
$roleName = $roleName.Trim()
$roleArn = & $AWS_PATH iam get-role --role-name $roleName --query "Role.Arn" --output text --no-verify-ssl
$roleArn = $roleArn.Trim()

$subnetsList = & $AWS_PATH cloudformation list-stack-resources `
  --stack-name faf-infra-prod-v2 `
  --query "StackResourceSummaries[?LogicalResourceId=='PrivateSubnet1' || LogicalResourceId=='PrivateSubnet2'].PhysicalResourceId" `
  --output text --no-verify-ssl
$subnetIds = ($subnetsList -split '\s+' | Where-Object {$_}) -join ','

$sgId = & $AWS_PATH cloudformation list-stack-resources `
  --stack-name faf-infra-prod-v2 `
  --query "StackResourceSummaries[?LogicalResourceId=='LambdaSecurityGroup'].PhysicalResourceId" `
  --output text --no-verify-ssl
$sgId = $sgId.Trim()

$rdsHost = & $AWS_PATH cloudformation describe-stacks `
  --stack-name faf-infra-prod-v2 `
  --query "Stacks[0].Outputs[?OutputKey=='RDSEndpoint'].OutputValue" `
  --output text --no-verify-ssl
$rdsHost = $rdsHost.Trim()

$rdsPassword = $env:RDS_PASSWORD
if (-Not $rdsPassword) {
    $rdsPassword = "wG9cTdjIGynxAStS"
}

$tempDir = "aws-migration\temp-check-user"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null
Copy-Item "aws-migration\scripts\check-user-role.js" "$tempDir\index.js" -Force
Copy-Item "aws-migration\lambda\node_modules" "$tempDir\node_modules" -Recurse -Force

$zipPath = "aws-migration\vpc_check_user_payload.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath
Remove-Item $tempDir -Recurse -Force

$funcName = "faf-temp-check-user"
try {
    & $AWS_PATH lambda delete-function --function-name $funcName --no-verify-ssl 2>$null | Out-Null
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

$state = "Pending"
while ($state -ne "Active") {
    Start-Sleep -Seconds 3
    $stateInfo = & $AWS_PATH lambda get-function-configuration `
      --function-name $funcName `
      --query "State" --output text --no-verify-ssl
    $state = $stateInfo.Trim()
}

$responseFile = "aws-migration\check-user-response.json"
if (Test-Path $responseFile) { Remove-Item $responseFile -Force }

& $AWS_PATH lambda invoke --function-name $funcName --no-verify-ssl $responseFile | Out-Null
$response = Get-Content $responseFile | Out-String
Write-Output "Lambda Response:"
Write-Output $response

& $AWS_PATH lambda delete-function --function-name $funcName --no-verify-ssl | Out-Null
Remove-Item $zipPath -Force
Remove-Item $responseFile -Force
