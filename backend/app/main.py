from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import hosts, terminal

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hosts.router, prefix="/api/v1")
app.include_router(terminal.router)