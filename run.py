import os
import sys
import socket
import subprocess

# Auto-detect and switch to local virtual environment (.venv) if run with global Python
VENV_PYTHON = os.path.abspath(os.path.join(os.path.dirname(__file__), ".venv", "Scripts", "python.exe"))
if os.path.exists(VENV_PYTHON) and sys.executable.lower() != VENV_PYTHON.lower():
    result = subprocess.call([VENV_PYTHON, os.path.abspath(__file__)] + sys.argv[1:])
    sys.exit(result)

# Ensure console supports utf-8 output without charmap errors on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def find_available_port(host: str, preferred_port: int) -> int:
    """Finds an open port on Windows; in Docker/Linux container, preserves configured port directly"""
    if sys.platform != "win32" or os.environ.get("DOCKER_CONTAINER"):
        return preferred_port

    ports_to_try = [preferred_port, 8080, 8000, 8001, 8002, 8888]
    # Remove duplicates while preserving order
    seen = set()
    candidate_ports = [p for p in ports_to_try if not (p in seen or seen.add(p))]
    
    for port in candidate_ports:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind((host, port))
            s.close()
            return port
        except OSError:
            continue
    return preferred_port

try:
    import uvicorn
    from app.config import settings
except ImportError as e:
    print("\n" + "=" * 65)
    print(" [ERROR] Thieu thu vien hoac chua kich hoat moi truong ao (.venv)!")
    print(f" Chi tiet: {e}")
    print(" Huong dan:")
    print("   1. Kich hoat venv: .venv\\Scripts\\activate")
    print("   2. Chay lai: python run.py")
    print("   3. Hoac nhap dup file: start.bat")
    print("=" * 65 + "\n")
    sys.exit(1)

if __name__ == "__main__":
    active_port = find_available_port(settings.HOST, settings.PORT)
    
    print("=" * 65)
    print(" Starting Facebook Automation Backend Engine")
    print(f" Dashboard: http://{settings.HOST}:{active_port}/")
    print(f" API Docs:  http://{settings.HOST}:{active_port}/docs")
    if active_port != settings.PORT:
        print(f" (Port {settings.PORT} dang ban, tu dong chuyen sang Port {active_port})")
    print("=" * 65)
    
    loop_arg = "app.utils.loop:get_proactor_loop" if sys.platform == "win32" else "asyncio"

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=active_port,
        reload=False,
        loop=loop_arg
    )

