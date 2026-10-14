# ============================================================
# Museo_Smart - Script de inicio del backend (desarrollo local)
# ------------------------------------------------------------
# Uso:  .\iniciar-museo.ps1
#
# NO contiene secretos. Las contrasenas se leen de variables de
# entorno persistentes o se solicitan de forma segura (SecureString).
# Solo modifica el entorno del PROCESO actual; nunca las variables
# persistentes de Windows.
# Compatible con Windows PowerShell 5.1 y PowerShell 7+.
# ============================================================

$ErrorActionPreference = 'Stop'

# ---------------- Utilidades ----------------

function Write-Step  { param([string]$m) Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok    { param([string]$m) Write-Host "    [OK] $m" -ForegroundColor Green }
function Write-Warn2 { param([string]$m) Write-Host "    [!]  $m" -ForegroundColor Yellow }
function Write-Err   { param([string]$m) Write-Host "    [X]  $m" -ForegroundColor Red }

function ConvertFrom-SecureStringToPlain {
    param([Parameter(Mandatory)][System.Security.SecureString]$Secure)
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

# Ejecuta un comando nativo capturando stdout+stderr sin que el stderr dispare
# errores terminantes (java -version y maven escriben en stderr).
function Invoke-NativeCapture {
    param([Parameter(Mandatory)][string]$FilePath, [Parameter(Mandatory)][string[]]$Arguments)
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $FilePath @Arguments 2>&1 | Out-String
        $code = $LASTEXITCODE
        return @{ Output = $output; ExitCode = $code }
    } finally {
        $ErrorActionPreference = $old
    }
}

# Devuelve el valor de una variable: primero del proceso, luego persistente (User/Machine).
function Get-EffectiveVar {
    param([Parameter(Mandatory)][string]$Name)
    $proc = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if (-not [string]::IsNullOrEmpty($proc)) { return @{ Value = $proc; Origin = 'proceso' } }
    $usr = [Environment]::GetEnvironmentVariable($Name, 'User')
    if (-not [string]::IsNullOrEmpty($usr)) { return @{ Value = $usr; Origin = 'usuario' } }
    $mac = [Environment]::GetEnvironmentVariable($Name, 'Machine')
    if (-not [string]::IsNullOrEmpty($mac)) { return @{ Value = $mac; Origin = 'maquina' } }
    return @{ Value = $null; Origin = $null }
}

function Test-TcpPort {
    param([Parameter(Mandatory)][string]$HostName, [Parameter(Mandatory)][int]$Port, [int]$TimeoutMs = 1500)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne($TimeoutMs)) { return $false }
        $client.EndConnect($iar)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

# ---------------- 1. Ubicacion del proyecto ----------------

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
Set-Location -LiteralPath $scriptRoot

Write-Step "Verificando ubicacion del proyecto"
if (-not (Test-Path -LiteralPath (Join-Path $scriptRoot 'pom.xml'))) {
    Write-Err "No se encontro pom.xml en '$scriptRoot'. Ejecuta el script desde la carpeta del backend."
    exit 1
}
if (-not (Test-Path -LiteralPath (Join-Path $scriptRoot 'mvnw.cmd'))) {
    Write-Err "No se encontro mvnw.cmd en '$scriptRoot'."
    exit 1
}
Write-Ok "Proyecto y Maven Wrapper encontrados."

# ---------------- 2. Java 21 / JAVA_HOME ----------------

Write-Step "Configurando Java 21"
$jdkDefault = 'C:\Users\Gaby\AppData\Local\Programs\jdk-21.0.12.1+1'

$javaHomeOk = $false
if ($env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
    $r = Invoke-NativeCapture -FilePath (Join-Path $env:JAVA_HOME 'bin\java.exe') -Arguments @('-version')
    if ($r.Output -match '"21\.') { $javaHomeOk = $true }
}

if (-not $javaHomeOk) {
    if (Test-Path -LiteralPath (Join-Path $jdkDefault 'bin\java.exe')) {
        $env:JAVA_HOME = $jdkDefault
        Write-Warn2 "JAVA_HOME no apuntaba a un JDK 21 valido; se usa: $jdkDefault"
    } else {
        Write-Err "No se encontro un JDK 21 valido. Configure JAVA_HOME manualmente."
        Write-Err "Ruta esperada: $jdkDefault"
        exit 1
    }
} else {
    Write-Ok "JAVA_HOME valido (JDK 21): $env:JAVA_HOME"
}

# Asegurar que PATH incluye $JAVA_HOME\bin sin duplicar.
$javaBin = Join-Path $env:JAVA_HOME 'bin'
$pathParts = $env:PATH -split ';'
if (-not ($pathParts | Where-Object { $_.TrimEnd('\') -ieq $javaBin.TrimEnd('\') })) {
    $env:PATH = "$javaBin;$env:PATH"
    Write-Ok "Se agrego $javaBin al PATH del proceso."
} else {
    Write-Ok "PATH ya incluye el bin de Java."
}

$javaVersionResult = Invoke-NativeCapture -FilePath (Join-Path $env:JAVA_HOME 'bin\java.exe') -Arguments @('-version')
$javaFirstLine = (($javaVersionResult.Output -split "`n") | Where-Object { $_ -match 'version' } | Select-Object -First 1)
Write-Ok ("java -version -> " + ($javaFirstLine -replace '^\s+|\s+$',''))

# Verificar que Maven usara Java 21 (mvnw -version tambien escribe en stderr).
$mvnVersion = Invoke-NativeCapture -FilePath 'cmd.exe' -Arguments @('/c', 'mvnw.cmd -version')
if ($mvnVersion.Output -match 'Java version:\s*21') {
    Write-Ok "Maven usa Java 21."
} else {
    Write-Warn2 "No se pudo confirmar que Maven use Java 21 (revisa la salida de mvnw -version)."
}

# ---------------- 3. PostgreSQL ----------------

Write-Step "Configurando conexion a PostgreSQL"

# La app lee DB_URL (no DB_HOST/DB_PORT/DB_NAME por separado).
# Estos defaults coinciden con application.properties.
$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { 'localhost' }
$dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { '5432' }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { 'Museo_Smart' }

$env:DB_HOST = $dbHost
$env:DB_PORT = $dbPort
$env:DB_NAME = $dbName
$env:DB_URL  = "jdbc:postgresql://${dbHost}:${dbPort}/${dbName}"

$dbUser = Get-EffectiveVar -Name 'DB_USERNAME'
if ($dbUser.Value) { $env:DB_USERNAME = $dbUser.Value; Write-Ok "DB_USERNAME desde $($dbUser.Origin)." }
else { $env:DB_USERNAME = 'postgres'; Write-Warn2 "DB_USERNAME no definido; se usa el default 'postgres'." }

$dbUrlEnv = Get-EffectiveVar -Name 'DB_URL'
if ($dbUrlEnv.Value) {
    $env:DB_URL = $dbUrlEnv.Value
    Write-Ok "DB_URL definido explicitamente en el entorno ($($dbUrlEnv.Origin))."
} else {
    Write-Ok "DB_URL construido: jdbc:postgresql://${dbHost}:${dbPort}/${dbName}"
}

$dbPass = Get-EffectiveVar -Name 'DB_PASSWORD'
if ($dbPass.Value) {
    $env:DB_PASSWORD = $dbPass.Value
    Write-Ok "DB_PASSWORD cargada desde el entorno ($($dbPass.Origin))."
} else {
    Write-Warn2 "DB_PASSWORD no encontrada. Introduce la contrasena de PostgreSQL (no se mostrara):"
    $sec = Read-Host -Prompt "    DB_PASSWORD" -AsSecureString
    $env:DB_PASSWORD = ConvertFrom-SecureStringToPlain -Secure $sec
    Write-Ok "DB_PASSWORD establecida solo para esta sesion."
}

# ---------------- 4. JWT ----------------

Write-Step "Configurando seguridad JWT"

$jwt = Get-EffectiveVar -Name 'JWT_SECRET'
if ($jwt.Value -and $jwt.Value.Length -ge 32) {
    $env:JWT_SECRET = $jwt.Value
    Write-Ok "JWT_SECRET cargado desde el entorno ($($jwt.Origin)), longitud=$($jwt.Value.Length)."
} else {
    if ($jwt.Value) { Write-Warn2 "JWT_SECRET existe pero es demasiado corto (<32 caracteres)." }
    else { Write-Warn2 "JWT_SECRET no definido." }
    Write-Warn2 "La app exige al menos 32 caracteres. NO se genera automaticamente para no invalidar tokens."
    Write-Host "    Introduce un JWT_SECRET (>=32 caracteres) o pulsa Enter para continuar sin definir:" -ForegroundColor Yellow
    $jsec = Read-Host -Prompt "    JWT_SECRET" -AsSecureString
    $jplain = ConvertFrom-SecureStringToPlain -Secure $jsec
    if (-not [string]::IsNullOrEmpty($jplain)) {
        if ($jplain.Length -lt 32) {
            Write-Err "El JWT_SECRET introducido tiene menos de 32 caracteres. Abortando para evitar configuracion insegura."
            exit 1
        }
        $env:JWT_SECRET = $jplain
        Write-Ok "JWT_SECRET establecido para esta sesion (longitud=$($jplain.Length))."
    } else {
        Write-Warn2 "Sin JWT_SECRET: la app usara una clave aleatoria en memoria (tokens no sobreviven al reinicio)."
        Remove-Item Env:JWT_SECRET -ErrorAction SilentlyContinue
    }
}

$jwtExp = Get-EffectiveVar -Name 'JWT_EXPIRACION_MINUTOS'
if ($jwtExp.Value) { $env:JWT_EXPIRACION_MINUTOS = $jwtExp.Value } else { $env:JWT_EXPIRACION_MINUTOS = '60' }
Write-Ok "JWT_EXPIRACION_MINUTOS=$($env:JWT_EXPIRACION_MINUTOS)"

$resetExp = Get-EffectiveVar -Name 'RESET_EXPIRACION_MINUTOS'
if ($resetExp.Value) { $env:RESET_EXPIRACION_MINUTOS = $resetExp.Value } else { $env:RESET_EXPIRACION_MINUTOS = '15' }
Write-Ok "RESET_EXPIRACION_MINUTOS=$($env:RESET_EXPIRACION_MINUTOS)"

# ---------------- 5. SuperAdmin inicial (opcional) ----------------

Write-Step "SuperAdmin inicial (opcional)"

$saEmail = Get-EffectiveVar -Name 'MUSEO_SUPERADMIN_EMAIL'
$saPass  = Get-EffectiveVar -Name 'MUSEO_SUPERADMIN_PASSWORD'

if ($saEmail.Value) {
    $env:MUSEO_SUPERADMIN_EMAIL = $saEmail.Value
    $env:MUSEO_SUPERADMIN_NOMBRE = if ((Get-EffectiveVar -Name 'MUSEO_SUPERADMIN_NOMBRE').Value) {
        (Get-EffectiveVar -Name 'MUSEO_SUPERADMIN_NOMBRE').Value
    } else { 'SuperAdministrador' }

    if ($saPass.Value) {
        $env:MUSEO_SUPERADMIN_PASSWORD = $saPass.Value
        Write-Ok "Bootstrap de SuperAdmin configurado (solo crea la cuenta si la tabla esta vacia)."
    } else {
        Write-Warn2 "MUSEO_SUPERADMIN_EMAIL definido pero sin contrasena."
        Write-Warn2 "Solo se solicita si vas a crear el primer SuperAdmin (tabla vacia). Pulsa Enter para omitir."
        $ssec = Read-Host -Prompt "    MUSEO_SUPERADMIN_PASSWORD (opcional)" -AsSecureString
        $splain = ConvertFrom-SecureStringToPlain -Secure $ssec
        if (-not [string]::IsNullOrEmpty($splain)) {
            $env:MUSEO_SUPERADMIN_PASSWORD = $splain
            Write-Ok "Contrasena de SuperAdmin establecida para esta sesion."
        } else {
            Write-Warn2 "Sin contrasena: el bootstrap se omitira (no se creara ningun administrador)."
        }
    }
} else {
    Write-Warn2 "MUSEO_SUPERADMIN_EMAIL no definido: el bootstrap del primer SuperAdmin se omitira."
    Write-Warn2 "Si la tabla usuario_admin esta vacia, no podras iniciar sesion hasta configurarlo."
}

# ---------------- 6. Gmail SMTP ----------------

Write-Step "Configurando correo SMTP (Gmail)"

# Valores no secretos (pueden ajustarse por variables existentes).
$env:APP_MAIL_HABILITADO = if ($env:APP_MAIL_HABILITADO) { $env:APP_MAIL_HABILITADO } else { 'true' }
$env:APP_MAIL_FROM       = if ($env:APP_MAIL_FROM)       { $env:APP_MAIL_FROM }       else { 'smartmuseo@gmail.com' }
$env:MAIL_HOST           = if ($env:MAIL_HOST)           { $env:MAIL_HOST }           else { 'smtp.gmail.com' }
$env:MAIL_PORT           = if ($env:MAIL_PORT)           { $env:MAIL_PORT }           else { '587' }
$env:MAIL_USERNAME       = if ($env:MAIL_USERNAME)       { $env:MAIL_USERNAME }       else { 'smartmuseo@gmail.com' }

if ($env:APP_MAIL_HABILITADO -eq 'true') {
    $mailPass = Get-EffectiveVar -Name 'MAIL_PASSWORD'
    if ($mailPass.Value) {
        $env:MAIL_PASSWORD = $mailPass.Value
        Write-Ok "MAIL_PASSWORD cargada desde el entorno ($($mailPass.Origin)), longitud=$($mailPass.Value.Length)."
        if ($mailPass.Value.Length -eq 19 -or $mailPass.Value -match '\s') {
            Write-Warn2 "La contrasena parece tener espacios (formato 'xxxx xxxx xxxx xxxx'). Gmail espera 16 caracteres sin espacios."
        }
    } else {
        Write-Warn2 "MAIL_PASSWORD no encontrada. Introduce la contrasena de aplicacion de Gmail (16 chars, sin espacios):"
        $msec = Read-Host -Prompt "    MAIL_PASSWORD" -AsSecureString
        $env:MAIL_PASSWORD = ConvertFrom-SecureStringToPlain -Secure $msec
        Write-Ok "MAIL_PASSWORD establecida solo para esta sesion (longitud=$($env:MAIL_PASSWORD.Length))."
    }
} else {
    Write-Warn2 "APP_MAIL_HABILITADO != true: se usara LoggingMailService (sin envio real de correos)."
}

# ---------------- 7. Validaciones previas ----------------

Write-Step "Validaciones previas"

$errores = @()

# Puerto 8080 libre
if (Test-TcpPort -HostName '127.0.0.1' -Port 8080) {
    $errores += "El puerto 8080 ya esta en uso. Deten la otra instancia antes de iniciar."
} else {
    Write-Ok "Puerto 8080 libre."
}

# PostgreSQL accesible (best-effort, no bloquea)
if (Test-TcpPort -HostName $dbHost -Port ([int]$dbPort)) {
    Write-Ok "PostgreSQL accesible en ${dbHost}:${dbPort}."
} else {
    Write-Warn2 "No se pudo conectar a PostgreSQL en ${dbHost}:${dbPort}. Verifica que el servicio este iniciado."
}

# SMTP: solo comprobar que la config esta completa si esta habilitado.
if ($env:APP_MAIL_HABILITADO -eq 'true') {
    if ([string]::IsNullOrEmpty($env:MAIL_HOST) -or [string]::IsNullOrEmpty($env:MAIL_USERNAME) -or [string]::IsNullOrEmpty($env:MAIL_PASSWORD)) {
        $errores += "SMTP habilitado pero falta MAIL_HOST/MAIL_USERNAME/MAIL_PASSWORD."
    } else {
        Write-Ok "Configuracion SMTP completa."
    }
}

if ($errores.Count -gt 0) {
    Write-Host ""
    Write-Err "No se puede iniciar por los siguientes problemas:"
    foreach ($e in $errores) { Write-Host "      - $e" -ForegroundColor Red }
    exit 1
}

# ---------------- 8. Resumen no sensible ----------------

Write-Host ""
Write-Host "================ RESUMEN DE CONFIGURACION ================" -ForegroundColor White
Write-Host ("  JAVA_HOME          : " + $env:JAVA_HOME)
Write-Host ("  DB_URL             : " + $env:DB_URL)
Write-Host ("  DB_USERNAME        : " + $env:DB_USERNAME)

$jwtResumen = if ($env:JWT_SECRET) { "definido (len=" + $env:JWT_SECRET.Length + ")" } else { "no definido (modo dev)" }
Write-Host ("  JWT_SECRET         : " + $jwtResumen)

Write-Host ("  APP_MAIL_HABILITADO: " + $env:APP_MAIL_HABILITADO)
Write-Host ("  APP_MAIL_FROM      : " + $env:APP_MAIL_FROM)
Write-Host ("  MAIL_HOST:PORT     : " + $env:MAIL_HOST + ":" + $env:MAIL_PORT)
Write-Host ("  MAIL_USERNAME      : " + $env:MAIL_USERNAME)

$mailResumen = if ($env:MAIL_PASSWORD) { "definida (len=" + $env:MAIL_PASSWORD.Length + ")" } else { "no definida" }
Write-Host ("  MAIL_PASSWORD      : " + $mailResumen)

$saResumen = if ($env:MUSEO_SUPERADMIN_EMAIL -and $env:MUSEO_SUPERADMIN_PASSWORD) { "si" } else { "no" }
Write-Host ("  SuperAdmin bootstrap: " + $saResumen)
Write-Host "=========================================================" -ForegroundColor White
Write-Host ""

# ---------------- 9. Iniciar Spring Boot ----------------

Write-Step "Iniciando Spring Boot (.\\mvnw.cmd spring-boot:run). Deten con Ctrl + C."
Write-Host ""

& .\mvnw.cmd spring-boot:run
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Ok "Spring Boot finalizo correctamente."
} else {
    Write-Err "Spring Boot finalizo con codigo de salida $exitCode."
}
exit $exitCode
