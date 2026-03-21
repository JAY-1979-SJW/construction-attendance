# 자동퇴근 Windows 작업 스케줄러 등록 스크립트
# 실행: PowerShell (관리자 권한)
# > .\scripts\register-scheduler-windows.ps1

param(
    [string]$AppUrl  = "http://localhost:3000",
    [string]$LogPath = "C:\logs\attendance-auto-checkout.log"
)

# CRON_SECRET 읽기
$envFile = Join-Path $PSScriptRoot "..\\.env"
$cronSecret = ""
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^CRON_SECRET=`"?(.+?)`"?$") {
            $cronSecret = $Matches[1]
        }
    }
}

if (-not $cronSecret) {
    Write-Error "CRON_SECRET이 .env에 없습니다. 등록을 중단합니다."
    exit 1
}

# 로그 디렉토리 생성
$logDir = Split-Path $LogPath
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    Write-Host "로그 디렉토리 생성: $logDir"
}

# 실행 명령 (curl)
$curlCmd = "curl"
$curlArgs = "-s -X POST `"$AppUrl/api/cron/auto-checkout`" " +
            "-H `"Authorization: Bearer $cronSecret`" " +
            "-o `"$LogPath`" --create-dirs -a 2>&1"

# 작업 스케줄러 등록
$taskName = "AttendanceAutoCheckout"

# 기존 태스크 제거 (중복 방지)
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "기존 태스크 제거: $taskName"
}

$action  = New-ScheduledTaskAction -Execute $curlCmd -Argument $curlArgs
$trigger = New-ScheduledTaskTrigger -Daily -At "04:00"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -RestartCount 1

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "해한 출퇴근 - 매일 04:00 자동퇴근 배치" `
    -RunLevel Highest | Out-Null

Write-Host ""
Write-Host "=== 등록 완료 ===" -ForegroundColor Green
Write-Host "태스크명  : $taskName"
Write-Host "실행 시각 : 매일 04:00 (KST)"
Write-Host "로그 경로 : $LogPath"
Write-Host ""
Write-Host "=== 등록 확인 ===" -ForegroundColor Cyan
Get-ScheduledTask -TaskName $taskName | Format-List TaskName, State, Description

Write-Host ""
Write-Host "=== dryRun 수동 테스트 ===" -ForegroundColor Yellow
Write-Host "아래 명령으로 등록 전 안전 테스트를 실행하세요:"
Write-Host "  curl -s -X POST `"$AppUrl/api/cron/auto-checkout?dryRun=true`" -H `"Authorization: Bearer <CRON_SECRET>`""
