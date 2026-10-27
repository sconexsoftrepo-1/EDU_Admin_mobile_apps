"""Align SQL Server employee types with onboarding, without modifying employee data.

Run from backend: .venv/bin/python tools/setup_staff_schema.py --check
Remove --check to apply the two constraint updates in one transaction.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.sqlserver import SqlServerSettings, connect


def compatible(cursor, schema):
    cursor.execute(
        "SELECT cc.name,cc.definition,cc.is_disabled,cc.is_not_trusted "
        "FROM sys.check_constraints cc JOIN sys.tables t ON t.object_id=cc.parent_object_id "
        "JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=%s AND t.name='employees' "
        "AND cc.name IN ('employees_employee_type_check','employees_employment_type_check')",
        (schema,),
    )
    checks = {name: (definition, disabled, untrusted) for name, definition, disabled, untrusted in cursor.fetchall()}
    return all(name in checks and value in checks[name][0] and not any(checks[name][1:])
               for name, value in [('employees_employee_type_check', "'labour'"),
                                   ('employees_employment_type_check', "'daily_wage'")])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Read-only compatibility check')
    args = parser.parse_args()
    settings = SqlServerSettings()
    connection = connect(settings)
    try:
        cursor = connection.cursor()
        if compatible(cursor, settings.db_schema):
            print('Staff employment constraints are compatible and validated.')
            return 0
        if args.check:
            print('Migration required: the database does not yet allow labour / daily_wage.')
            return 1
        source = Path(__file__).resolve().parents[2] / 'database/sqlserver/013_staff_employment_types.sql'
        script = source.read_text().replace('dbo.', f'[{settings.db_schema}].')
        cursor.execute(script)
        if not compatible(cursor, settings.db_schema):
            raise RuntimeError('Staff constraints did not pass verification')
        connection.commit()
        print('Updated and verified both staff constraints; employee records were not changed.')
        return 0
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == '__main__':
    raise SystemExit(main())
