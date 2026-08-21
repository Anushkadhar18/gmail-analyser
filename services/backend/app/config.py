from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@db:5432/postgres"
    REDIS_URL: str = "redis://redis:6379/0"
    SECRET_KEY: str = "replace-me"
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    OAUTH_REDIRECT_URI: str | None = None
    OPENAI_API_KEY: str | None = None
    TOKEN_ENCRYPTION_KEY: str | None = None
    WEB_ORIGIN: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
