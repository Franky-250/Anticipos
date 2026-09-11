from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cronos_api_url: str = "https://cronos.pcmejia.com/api"
    cronos_api_key: str = ""

    # Azure AD / Microsoft Graph
    client_id: str = ""
    tenant_id: str = ""
    client_secret: str = ""
    correo_remitente: str = "aprobaciones@pcmejia.com.co"

    # Pandora SSO
    pandora_auth_url: str = "https://pandora.pcmejia.com"
    jwt_secret: str = ""
    app_frontend_url: str = "http://localhost:5173"


settings = Settings()

