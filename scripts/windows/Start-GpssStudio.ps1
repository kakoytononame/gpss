[CmdletBinding()]
param(
    [switch]$Stop,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$composeFile = Join-Path $projectRoot 'docker-compose.yml'
$applicationUrl = 'http://127.0.0.1:8080'
$apiHealthUrl = 'http://127.0.0.1:3001/api/health'
$workspaceUrl = 'http://127.0.0.1:3001/api/alina-gpss/studio/tebs/workspace'
$composeArguments = @(
    'compose',
    '--project-name', 'gpss',
    '--project-directory', $projectRoot,
    '--file', $composeFile
)

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)

    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-DockerCli {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw @'
Docker is not installed or the docker command is unavailable.
Install Docker Desktop: https://www.docker.com/products/docker-desktop/
Restart Windows after installation and run START_GPSS_STUDIO.cmd again.
'@
    }

    & docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose is unavailable. Update Docker Desktop and try again.'
    }
}

function Test-DockerEngine {
    & docker info --format '{{.ServerVersion}}' *> $null
    return $LASTEXITCODE -eq 0
}

function Start-DockerDesktopIfNeeded {
    if (Test-DockerEngine) {
        return
    }

    $dockerDesktopCandidates = @(
        (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
        (Join-Path $env:LOCALAPPDATA 'Docker\Docker Desktop.exe')
    )
    $dockerDesktopPath = $dockerDesktopCandidates |
        Where-Object { $_ -and (Test-Path -LiteralPath $_) } |
        Select-Object -First 1

    if (-not $dockerDesktopPath) {
        throw 'Docker is installed, but Docker Desktop was not found. Start Docker manually and try again.'
    }

    Write-Step 'Starting Docker Desktop'
    Start-Process -FilePath $dockerDesktopPath

    $deadline = (Get-Date).AddMinutes(3)
    $nextProgressMessage = Get-Date

    while ((Get-Date) -lt $deadline) {
        if (Test-DockerEngine) {
            Write-Host 'Docker is ready.' -ForegroundColor Green
            return
        }

        if ((Get-Date) -ge $nextProgressMessage) {
            Write-Host 'Waiting for Docker to start...'
            $nextProgressMessage = (Get-Date).AddSeconds(10)
        }

        Start-Sleep -Seconds 2
    }

    throw 'Docker did not start within 3 minutes. Open Docker Desktop, check its status, and try again.'
}

function Invoke-Compose {
    param([Parameter(Mandatory)][string[]]$Arguments)

    & docker @composeArguments @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose exited with code $LASTEXITCODE."
    }
}

function Wait-HttpEndpoint {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [Parameter(Mandatory)][string]$DisplayName,
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Write-Host "$DisplayName is ready." -ForegroundColor Green
                return
            }
        }
        catch {
            # A container may accept connections before initialization is complete.
        }

        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)

    throw "$DisplayName did not respond within $TimeoutSeconds seconds: $Uri"
}

try {
    if (-not (Test-Path -LiteralPath $composeFile)) {
        throw "docker-compose.yml was not found in the project directory: $projectRoot"
    }

    Assert-DockerCli
    Start-DockerDesktopIfNeeded

    if ($Stop) {
        Write-Step 'Stopping GPSS Studio'
        Invoke-Compose -Arguments @('down')
        Write-Host 'GPSS Studio is stopped. PostgreSQL data is preserved.' -ForegroundColor Green
        exit 0
    }

    Write-Step 'Building and starting GPSS Studio'
    Set-Location -LiteralPath $projectRoot
    Invoke-Compose -Arguments @('up', '--detach', '--build')

    Write-Step 'Checking services'
    Wait-HttpEndpoint -Uri $apiHealthUrl -DisplayName 'Backend API'
    Wait-HttpEndpoint -Uri $workspaceUrl -DisplayName 'API to PostgreSQL connection'
    Wait-HttpEndpoint -Uri $applicationUrl -DisplayName 'Web application'

    Write-Host "`nGPSS Studio is running: $applicationUrl" -ForegroundColor Green
    Write-Host 'Subsequent starts will be faster because Docker reuses its build cache.'

    if (-not $NoBrowser) {
        Start-Process $applicationUrl
    }
}
catch {
    Write-Host "`nStartup error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nRecent container logs:" -ForegroundColor Yellow

    try {
        & docker @composeArguments logs --tail 60
    }
    catch {
        Write-Host 'Container logs are not available yet.'
    }

    exit 1
}
