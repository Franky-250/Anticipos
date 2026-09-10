from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cronos_api_url: str = "https://cronos.pcmejia.com/api"
    cronos_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
