$ErrorActionPreference = 'Stop'
$previousProxy = $env:https_proxy
Push-Location (Join-Path $PSScriptRoot '..')
try {
    # EAS does not automatically use the Windows Internet Settings proxy.
    if (-not $env:https_proxy) {
        $settings = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
        if ($settings.ProxyEnable -eq 1 -and $settings.ProxyServer) {
            $proxy = $settings.ProxyServer
            if ($proxy -match '(?:^|;)https=([^;]+)') { $proxy = $matches[1] }
            elseif ($proxy.Contains('=')) { throw 'Set https_proxy to your HTTPS proxy before building.' }
            if ($proxy -notmatch '^https?://') { $proxy = 'http://' + $proxy }
            $env:https_proxy = $proxy
        }
    }
    & npx.cmd --registry=https://registry.npmjs.org eas-cli@latest build --platform android --profile preview
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed. See the EAS error above.' }
} finally {
    $env:https_proxy = $previousProxy
    Pop-Location
}
