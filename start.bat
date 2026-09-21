@echo off
title Facebook Automation Engine
cd /d "%~dp0"
echo =========================================================
echo   Dang khoi dong Facebook Automation Engine...
echo =========================================================

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" run.py
) else (
    echo Khong tim thay thu muc .venv!
    echo Vui long tao virtualenv truoc bang: python -m venv .venv
    pause
)
