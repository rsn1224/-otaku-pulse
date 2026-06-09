<#
  OtakuPulse autostart 登録（提案・手動実行用 / 自動実行されない）

  ログオン時に Node サーバ(5180)をバックグラウンド起動し、常駐収集を有効化する。
  サーバが生きている限りブラウザ非依存で 45分毎 + 起動時に収集する。

  実行:   pwsh -File launch/register-autostart.ps1
  解除:   pwsh -File launch/register-autostart.ps1 -Unregister
  閲覧:   http://localhost:5180

  注: Scheduled Task の登録はシステム変更のため、本スクリプトは「提案」であり
      ユーザーが明示的に実行したときのみ反映される。
#>
param([switch]$Unregister)

$ErrorActionPreference = 'Stop'
$TaskName = 'OtakuPulse Server'
$Root = Split-Path -Parent $PSScriptRoot              # project root
$ServerDir = Join-Path $Root 'server'
$ServerEntry = Join-Path $ServerDir 'src\server.ts'
$NodeExe = (Get-Command node).Source

if ($Unregister) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Unregistered scheduled task '$TaskName'."
  return
}

$Action = New-ScheduledTaskAction -Execute $NodeExe -Argument "`"$ServerEntry`"" -WorkingDirectory $ServerDir
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force | Out-Null
Write-Host "Registered '$TaskName' — Node server starts at logon. Open http://localhost:5180."
