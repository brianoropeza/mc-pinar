@echo off
cd /d "%~dp0"
echo =========================================
echo AutoMac Pinar del Rio - Simulador 3D
 echo =========================================
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Debes instalar Node.js LTS.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Instalando dependencias...
  call npm.cmd install
  if errorlevel 1 (
    echo Error instalando dependencias.
    pause
    exit /b 1
  )
)
echo.
echo Abre en el navegador: http://localhost:5173/
echo Para detener el servidor presiona Ctrl+C.
call npm.cmd run dev
pause
