#!/bin/bash

echo "Uruchamianie backendu..."
cd backend
source .venv/bin/activate

uvicorn app.main:app --reload > ../backend.log 2>&1 &
BACKEND_PID=$!

cd ../frontend
echo "Uruchamianie frontendu..."
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!

cd ..

clear 
echo "=========================================="
echo "  Aplikacje uruchomione pomyślnie!"
echo "=========================================="
echo "Naciśnij [Ctrl+C], aby wyłączyć aplikacje."
echo ""
echo "Wskazówka: Logi znajdziesz w plikach backend.log oraz frontend.log"

cleanup() {
    echo ""
    echo "Zatrzymywanie aplikacji..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    pkill -P $$
    echo "Gotowe!"
    exit 0
}

trap cleanup INT TERM

while true; do
    sleep 1
done
