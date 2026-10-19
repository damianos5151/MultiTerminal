"""
Skrypt inicjalizujący bazę danych.
Uruchom: python -m scripts.init_db
"""
import subprocess
import sys

def init_db():
    print("Uruchamianie migracji Alembica...")
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("❌ Błąd migracji:")
        print(result.stderr)
        sys.exit(1)
    print("✅ Baza danych zainicjalizowana.")
    print(result.stdout)

if __name__ == "__main__":
    init_db()