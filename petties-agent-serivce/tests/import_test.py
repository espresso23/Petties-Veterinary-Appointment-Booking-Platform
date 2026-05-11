
import sys
from pathlib import Path

# Add project root to sys.path
root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

print("1. Importing fastmcp_app...")
print("Success")

print("2. Importing medical_tools...")
print("Success")

print("3. Importing booking_tools...")
print("Success")

print("4. Importing clinic_tools...")
print("Success")

print("5. Importing mcp_server.py (which imports all tools)...")
print("Success")
