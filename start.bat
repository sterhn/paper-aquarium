@echo off
rem Double-click to start the aquarium server. Close this window to stop it.
cd /d "%~dp0"
where node 1>NUL 2>NUL
if errorlevel 1 (
  echo Node.js not found. Install the LTS version from https://nodejs.org/ and try again.
  pause
  exit /b 1
)
if "%PORT%"=="" set PORT=8000
rem Open the browser a couple of seconds later, once the server is up.
start "" /b cmd /c "timeout /t 2 1>NUL & start "" http://localhost:%PORT%/"
node server.js
pause
