from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./anticipos.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def migrate_db():
    with engine.connect() as conn:
        inspector = inspect(engine)
        if "anticipos" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("anticipos")]
            new_columns = [
                ("cargo", "VARCHAR DEFAULT ''"),
                ("empresa", "VARCHAR DEFAULT ''"),
                ("email_solicitante", "VARCHAR DEFAULT ''"),
                ("motivo_tipo", "VARCHAR DEFAULT 'compras'"),
                ("motivo_detalle", "VARCHAR DEFAULT ''"),
                ("obra_destino", "VARCHAR DEFAULT ''"),
                ("transporte_otro", "BOOLEAN DEFAULT 0"),
                ("firma", "TEXT"),
                ("flujo_id", "INTEGER DEFAULT NULL"),
                ("flujo_nombre", "VARCHAR DEFAULT ''"),
                ("paso_actual", "INTEGER DEFAULT 1"),
                ("total_pasos", "INTEGER DEFAULT 1"),
                ("legalizado", "BOOLEAN DEFAULT 0"),
                ("monto_legalizado", "NUMERIC(14, 2) DEFAULT 0"),
                ("fecha_legalizacion", "DATETIME DEFAULT NULL"),
                ("legalizado_por", "VARCHAR DEFAULT ''"),
                ("observaciones_legalizacion", "TEXT DEFAULT ''"),
                ("supera_tope", "BOOLEAN DEFAULT 0"),
                ("monto_tope_aplicado", "NUMERIC(14, 2) DEFAULT 1500000"),
                ("autorizador_tope_nombre", "VARCHAR DEFAULT ''"),
                ("autorizador_tope_cargo", "VARCHAR DEFAULT ''"),
                ("autorizador_tope_email", "VARCHAR DEFAULT ''"),
                ("autorizado_tope", "BOOLEAN DEFAULT NULL"),
                ("fecha_autorizacion_tope", "DATETIME DEFAULT NULL"),
                ("motivo_rechazo_tope", "TEXT DEFAULT ''"),
            ]
            for col_name, col_type in new_columns:
                if col_name not in columns:
                    conn.execute(text(f"ALTER TABLE anticipos ADD COLUMN {col_name} {col_type}"))
            conn.commit()

        if "flujos_aprobacion" in inspector.get_table_names():
            columns_fl = [c["name"] for c in inspector.get_columns("flujos_aprobacion")]
            new_fl_columns = [
                ("cargos_asociados", "TEXT DEFAULT '[]'"),
                ("aplica_a_otros_cargos", "BOOLEAN DEFAULT 0"),
            ]
            for col_name, col_type in new_fl_columns:
                if col_name not in columns_fl:
                    conn.execute(text(f"ALTER TABLE flujos_aprobacion ADD COLUMN {col_name} {col_type}"))
            conn.commit()

        if "pasos_aprobacion" in inspector.get_table_names():
            columns_pasos = [c["name"] for c in inspector.get_columns("pasos_aprobacion")]
            new_paso_columns = [
                ("es_dinamico_solicitud", "BOOLEAN DEFAULT 0"),
                ("aprobadores_opcionales", "TEXT DEFAULT '[]'"),
            ]
            for col_name, col_type in new_paso_columns:
                if col_name not in columns_pasos:
                    conn.execute(text(f"ALTER TABLE pasos_aprobacion ADD COLUMN {col_name} {col_type}"))
            conn.commit()

        if "anticipos_pasos_progreso" in inspector.get_table_names():
            columns_prog = [c["name"] for c in inspector.get_columns("anticipos_pasos_progreso")]
            new_prog_columns = [
                ("aprobadores_opcionales", "TEXT DEFAULT '[]'"),
            ]
            for col_name, col_type in new_prog_columns:
                if col_name not in columns_prog:
                    conn.execute(text(f"ALTER TABLE anticipos_pasos_progreso ADD COLUMN {col_name} {col_type}"))
            conn.commit()

    Base.metadata.create_all(bind=engine)

    # Sembrar Administrador Inicial (jheyson.mena@pcmejia.com.co) si no existe
    with engine.connect() as conn:
        admin_email = "jheyson.mena@pcmejia.com.co"
        res = conn.execute(
            text("SELECT id, rol FROM usuarios_roles WHERE LOWER(email) = :email"),
            {"email": admin_email.lower()}
        ).fetchone()
        if not res:
            conn.execute(
                text(
                    "INSERT INTO usuarios_roles (email, nombre, cargo, rol, activo) "
                    "VALUES (:email, :nombre, :cargo, :rol, :activo)"
                ),
                {
                    "email": admin_email.lower(),
                    "nombre": "Jheyson Mena",
                    "cargo": "Administrador del Sistema",
                    "rol": "ADMINISTRADOR",
                    "activo": True,
                }
            )
            conn.commit()
        elif res[1] != "ADMINISTRADOR":
            conn.execute(
                text("UPDATE usuarios_roles SET rol = 'ADMINISTRADOR', activo = 1 WHERE id = :id"),
                {"id": res[0]}
            )
            conn.commit()

        # Sembrar Configuración de Tope Predeterminado ($1.500.000) si no existe
        res_tope = conn.execute(text("SELECT id FROM configuracion_topes LIMIT 1")).fetchone()
        if not res_tope:
            conn.execute(
                text(
                    "INSERT INTO configuracion_topes (monto_tope, activo, descripcion, autorizadores) "
                    "VALUES (:monto, :activo, :desc, :autorizadores)"
                ),
                {
                    "monto": 1500000,
                    "activo": True,
                    "desc": "Tope estándar para anticipos de obra ($1.500.000 COP)",
                    "autorizadores": "[]",
                }
            )
            conn.commit()


def seed_flujos_predeterminados():
    # Ya no se queman datos predeterminados en la base de datos
    pass



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

