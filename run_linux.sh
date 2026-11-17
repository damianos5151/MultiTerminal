#!/bin/bash


echo "Starting backend..."
cd backend
source .venv/bin/activate

uvicorn app.main:app --reload > ../backend.log 2>&1 &
BACKEND_PID=$!

cd ../frontend
echo "Starting frontend..."
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!

cd ..

clear 
echo "=========================================="
echo "  Fronted and backend ready"
echo "=========================================="
echo "Press [Ctrl+C], to stop."
echo ""
echo "Tip: Logs can be found in files 'backend.log' and 'frontend.log'"

cleanup() {
    echo ""
    echo "Stopping..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    pkill -P $$
    echo "Done"
    exit 0
}

trap cleanup INT TERM

while true; do
    sleep 1
done
