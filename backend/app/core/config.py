from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # PostgreSQL — async driver (asyncpg)
    DATABASE_URL: str = "postgresql+asyncpg://multiterminal:multiterminal_dev_password@localhost:5432/multiterminal"
    
    # PostgreSQL — sync driver (dla Alembica i skryptów)
    DATABASE_URL_SYNC: str = "postgresql+psycopg://multiterminal:multiterminal_dev_password@localhost:5432/multiterminal"
    
    # SSH
    SSH_KEY_PATH: str = "~/.ssh/id_rsa"
    SSH_TIMEOUT: int = 10
    
    # Skanowanie
    SCAN_INTERVAL: int = 300
    SCAN_SUBNET: str = "192.168.1.0/24"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()