"""Preflight for the co-located Windows SQL Server deployment; no secrets printed."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


def main():
    from app.core.settings import Settings
    from app.core.sqlserver import SqlServerSettings, connect

    settings = Settings(_env_file=ROOT / '.env')
    sql = SqlServerSettings(_env_file=ROOT / '.env')
    if settings.storage_backend != 'sqlserver':
        raise ValueError('Set EDUNEXA_STORAGE_BACKEND=sqlserver in .env.')
    if sql.host not in ('127.0.0.1', 'localhost') or sql.port != 1433 or sql.name != 'Edu Admin':
        raise ValueError('Set SQL host to 127.0.0.1, port to 1433, and database name to Edu Admin in .env.')
    connection = connect(sql)
    try:
        cur = connection.raw.cursor()
        cur.execute('SELECT COUNT(*) FROM dbo.roles')
        cur.fetchone()
    finally:
        connection.close()
    print('Production settings and migrated SQL database access verified.')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        if type(exc) is ValueError:
            print(str(exc), file=sys.stderr)
        else:
            print(f'Preflight failed ({type(exc).__name__}). Check .env settings, SQL login, and SQL Server availability.', file=sys.stderr)
        sys.exit(1)
