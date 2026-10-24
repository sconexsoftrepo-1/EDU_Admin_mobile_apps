"""Copy PostgreSQL to SQL Server with encrypted backups and conflict checks.

Defaults to a full rehearsal followed by ROLLBACK. --apply commits one transaction.
Source PostgreSQL is always read-only. Both connection settings stay in ignored files.
"""
import argparse
import hashlib
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import dotenv_values
from psycopg import sql

from app.core.database import DatabaseSettings, connect as postgres_connect
from app.core.sqlserver import SqlServerSettings, connect as sqlserver_connect, identifier
from app.core.sql_store import Metadata, Table, Column

ROOT = Path(__file__).resolve().parents[1]


def target_settings(path):
    values = dotenv_values(path)
    return SqlServerSettings(_env_file=None, host=values['EDUNEXA_TARGET_HOST'],
        port=int(values.get('EDUNEXA_TARGET_PORT', 1433)), name=values['EDUNEXA_TARGET_DATABASE'],
        user=values['EDUNEXA_TARGET_USER'], password=values['EDUNEXA_TARGET_PASSWORD'])


def query(cursor, statement, params=None):
    cursor.execute(statement, params)
    names = [column[0] for column in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def source_snapshot(connection):
    cur = connection.cursor()
    columns = query(cur, """SELECT c.table_name,c.column_name,c.udt_name,c.data_type,c.is_nullable,
        c.is_identity,c.column_default,c.character_maximum_length,c.numeric_precision,c.numeric_scale
        FROM information_schema.columns c JOIN information_schema.tables t
        ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE'
        WHERE c.table_schema='public' ORDER BY c.table_name,c.ordinal_position""")
    tables = sorted({c['table_name'] for c in columns})
    rows_query = sql.SQL(' UNION ALL ').join(sql.SQL(
        "SELECT {} AS table_name,COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb)::text AS payload FROM public.{} t"
    ).format(sql.Literal(table), sql.Identifier(table)) for table in tables)
    cur.execute(rows_query)
    records = {table: json.loads(payload or '[]', parse_float=Decimal) for table, payload in cur.fetchall()}
    fks = query(cur, """SELECT cl.relname AS table_name,a.attname AS column_name,
        pcl.relname AS parent_table,pa.attname AS parent_column FROM pg_constraint fk
        JOIN pg_class cl ON cl.oid=fk.conrelid JOIN pg_namespace n ON n.oid=cl.relnamespace
        JOIN pg_class pcl ON pcl.oid=fk.confrelid
        JOIN pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=fk.conkey[1]
        JOIN pg_attribute pa ON pa.attrelid=fk.confrelid AND pa.attnum=fk.confkey[1]
        WHERE fk.contype='f' AND n.nspname='public'""")
    uniques = query(cur, """SELECT t.relname AS table_name,co.conname AS key_name,
        array_agg(a.attname ORDER BY k.ord) AS columns FROM pg_constraint co
        JOIN pg_class t ON t.oid=co.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
        JOIN LATERAL unnest(co.conkey) WITH ORDINALITY k(attnum,ord) ON true
        JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum
        WHERE n.nspname='public' AND co.contype IN ('p','u') GROUP BY t.relname,co.conname""")
    return {'columns': columns, 'records': records, 'fks': fks, 'unique': uniques}


def target_snapshot(connection):
    # Use the native cursor: system catalogs and dynamic, already quoted identifiers.
    cur = connection.raw.cursor()
    columns = query(cur, """SELECT t.name AS table_name,c.name AS column_name,ty.name AS type_name,
        c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,dc.definition AS default_value
        FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
        JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
        LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id
        WHERE s.name='dbo' ORDER BY t.name,c.column_id""")
    tables = sorted({c['table_name'] for c in columns})
    statement = ' UNION ALL '.join(
        f"SELECT '{table}' AS table_name,(SELECT * FROM dbo.{identifier(table)} FOR JSON PATH,INCLUDE_NULL_VALUES) AS payload"
        for table in tables)
    cur.execute(statement)
    records = {table: json.loads(payload or '[]', parse_float=Decimal) for table, payload in cur.fetchall()}
    return {'columns': columns, 'records': records}


def protect_backup(directory, name, value):
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(directory, 0o700)
    keyfile = directory / '.backup-key'
    if keyfile.exists():
        key = keyfile.read_bytes()
    else:
        key = AESGCM.generate_key(bit_length=256)
        fd = os.open(keyfile, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as out:
            out.write(key)
    payload = json.dumps(value, default=str, ensure_ascii=False).encode()
    nonce = os.urandom(12)
    path = directory / f'{name}.json.aesgcm'
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as out:
        out.write(nonce + AESGCM(key).encrypt(nonce, payload, name.encode()))
    return {'file': str(path), 'sha256': hashlib.sha256(payload).hexdigest()}


def sql_type(column):
    typ = column['udt_name']
    if typ in {'varchar', 'bpchar'}:
        return f"NVARCHAR({column['character_maximum_length']})"
    if typ in {'text', 'json', 'jsonb'} or typ.startswith('_'):
        return 'NVARCHAR(MAX)'
    if typ in {'int2','int4','int8'}:
        return {'int2':'SMALLINT','int4':'INT','int8':'BIGINT'}[typ]
    if typ == 'bool':
        return 'BIT'
    if typ == 'numeric':
        return f"DECIMAL({column['numeric_precision'] or 38},{column['numeric_scale'] or 0})"
    if typ in {'timestamp','timestamptz'}:
        return 'DATETIMEOFFSET(6)'
    if typ == 'date':
        return 'DATE'
    if typ == 'time':
        return 'TIME(6)'
    raise ValueError(f'Unsupported source column type: {typ}')


def default_sql(column):
    value = column['column_default']
    if value is None:
        return ''
    if value.upper() == 'CURRENT_TIMESTAMP' or value.lower() == 'now()':
        return ' DEFAULT SYSDATETIMEOFFSET()'
    value = re.sub(r'::[a-z_ ]+(?:\[\])?', '', value)
    if value.lower() in {'true','false'}:
        value = '1' if value.lower() == 'true' else '0'
    if not re.fullmatch(r"(?:'[^']*'|[-+]?\d+(?:\.\d+)?)", value):
        raise ValueError(f"Unsupported default for {column['table_name']}.{column['column_name']}")
    return f' DEFAULT {value}'


def schema_patch(source, target):
    groups = defaultdict(list)
    for col in source['columns']:
        groups[col['table_name']].append(col)
    existing = {(c['table_name'],c['column_name']): c for c in target['columns']}
    target_tables = set(target['records'])
    statements = []
    for table, columns in groups.items():
        if table == 'schema_migrations':
            continue
        if table not in target_tables:
            definitions = []
            for col in columns:
                name = col['column_name']
                identity = ' IDENTITY(1,1) PRIMARY KEY' if col['is_identity'] == 'YES' else ''
                nullable = ' NULL' if col['is_nullable'] == 'YES' else ' NOT NULL'
                definitions.append(identifier(name)+' '+sql_type(col)+identity+nullable+(default_sql(col) if not identity else ''))
                if col['udt_name'] in {'json','jsonb'} or col['udt_name'].startswith('_'):
                    definitions.append(f'CHECK ({identifier(name)} IS NULL OR ISJSON({identifier(name)})=1)')
            statements.append(f'CREATE TABLE dbo.{identifier(table)} ('+',\n'.join(definitions)+')')
            for unique in source['unique']:
                if unique['table_name'] != table or unique['columns'] == ['id']:
                    continue
                fields = ','.join(map(identifier, unique['columns']))
                nullable = [c for c in columns if c['column_name'] in unique['columns'] and c['is_nullable'] == 'YES']
                condition = ' WHERE '+' AND '.join(identifier(c['column_name'])+' IS NOT NULL' for c in nullable) if nullable else ''
                statements.append(f'CREATE UNIQUE INDEX {identifier(unique["key_name"][:120])} ON dbo.{identifier(table)} ({fields}){condition}')
            continue
        for col in columns:
            key = (table,col['column_name'])
            if key not in existing:
                nullable = ' NULL' if col['is_nullable']=='YES' else ' NOT NULL'
                statements.append(f'ALTER TABLE dbo.{identifier(table)} ADD {identifier(col["column_name"])} {sql_type(col)}{nullable}{default_sql(col)}')
                for unique in source['unique']:
                    if unique['table_name']==table and unique['columns']==[col['column_name']]:
                        field=identifier(col['column_name'])
                        condition=f' WHERE {field} IS NOT NULL' if col['is_nullable']=='YES' else ''
                        statements.append(f'CREATE UNIQUE INDEX {identifier(unique["key_name"][:120])} ON dbo.{identifier(table)} ({field}){condition}')
            elif col['is_nullable']=='YES' and not existing[key]['is_nullable']:
                statements.append(f'ALTER TABLE dbo.{identifier(table)} ALTER COLUMN {identifier(col["column_name"])} {sql_type(col)} NULL')
    for fk in source['fks']:
        if fk['table_name'] in target_tables:
            continue
        table, column, parent, pc = (fk[k] for k in ['table_name','column_name','parent_table','parent_column'])
        statements.append(f'ALTER TABLE dbo.{identifier(table)} ADD FOREIGN KEY ({identifier(column)}) REFERENCES dbo.{identifier(parent)} ({identifier(pc)})')
    return statements


def canonical(value, column=None):
    if isinstance(value, str) and column and (column['udt_name'] in {'json','jsonb'} or column['udt_name'].startswith('_')):
        value=json.loads(value,parse_float=Decimal)
    if isinstance(value, (dict,list)):
        return json.dumps(value,sort_keys=True,ensure_ascii=False,default=str)
    if column and column['udt_name'] in {'timestamptz','timestamp'} and value is not None:
        value=datetime.fromisoformat(str(value).replace('Z','+00:00'))
        if value.tzinfo is None:
            value=value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if column and column['udt_name']=='numeric' and value is not None:
        return Decimal(str(value))
    return value


def map_values(value, aliases):
    if isinstance(value, dict):
        return {k:map_values(v,aliases) for k,v in value.items()}
    if isinstance(value, list):
        return [map_values(v,aliases) for v in value]
    return aliases.get(value,value) if isinstance(value,str) else value


def key_for(table, row):
    if table=='record_extras':
        return row['table_name'],row['record_code']
    return row['code']


def prepare(source,target,merge_login):
    aliases={}
    allowed_user_updates=set()
    target_logins={u['login_id'].casefold():u for u in target['records'].get('users',[])}
    for user in source['records'].get('users',[]):
        existing=target_logins.get(user['login_id'].casefold())
        if existing:
            if user['code']!=existing['code'] or user['password_hash']!=existing['password_hash']:
                if merge_login != 'postgres':
                    raise ValueError('Application login conflict; explicit --merge-login postgres is required')
                aliases[user['code']]=existing['code']
                allowed_user_updates.add(existing['code'])
    links={(r['role_code'],r['permission_code']):r for r in target['records'].get('role_permissions',[])}
    for link in source['records'].get('role_permissions',[]):
        existing=links.get((link['role_code'],link['permission_code']))
        if existing:
            aliases[link['code']]=existing['code']
    records=map_values(source['records'],aliases)
    return records,aliases,allowed_user_updates


def parameter(value,column):
    if value is None:
        return None
    typ=column['udt_name']
    if typ in {'json','jsonb'} or typ.startswith('_'):
        return json.dumps(value,ensure_ascii=False,sort_keys=True,default=str)
    if typ=='numeric':
        return Decimal(str(value))
    return value


def transfer(connection,source,target,merge_login):
    records,aliases,user_updates=prepare(source,target,merge_login)
    columns=defaultdict(dict)
    for c in source['columns']:
        columns[c['table_name']][c['column_name']]=c
    meta=object.__new__(Metadata);meta.tables={}
    for table, cols in columns.items():
        definition=meta.tables[table]=Table(table)
        for name,c in cols.items():
            definition.columns[name]=Column(name,c['udt_name'],c['is_nullable']=='YES',c['is_identity']=='YES')
    for fk in source['fks']:
        meta.tables[fk['table_name']].fks.append((fk['column_name'],fk['parent_table'],fk['parent_column']))
        if fk['parent_column']=='id':
            raise ValueError('Numeric foreign-key remapping required; aborting before transfer')
    order=meta._order()
    cursor=connection.raw.cursor()
    report={'inserted':{},'updated':{},'reused':{},'identity_alias_count':len(aliases)}
    expected={}
    for table in order:
        if table=='schema_migrations':
            continue  # PostgreSQL checksums are archived, not mixed into SQL Server's ledger.
        existing={key_for(table,r):r for r in target['records'].get(table,[])}
        expected[table]={}
        for raw in records.get(table,[]):
            row={k:v for k,v in raw.items() if columns[table][k]['is_identity']!='YES'}
            key=key_for(table,row)
            before=existing.get(key)
            if table=='record_extras' and before:
                left=before['data'] if isinstance(before['data'],dict) else json.loads(before['data'])
                row['data']={**left,**row['data']}
            expected[table][key]=row
            different=[k for k in row if k not in {'id','created_at','updated_at'} and before is not None
                and canonical(row[k],columns[table][k])!=canonical(before.get(k),columns[table][k])]
            if before and different:
                allowed=table=='record_extras' or (table=='users' and key in user_updates)
                if not allowed:
                    raise ValueError(f'Conflicting existing record in {table}; different fields: {different}')
                fields=[k for k in row if k not in {'id','code','created_at','updated_at','table_name','record_code'}]
                condition='table_name=%s AND record_code=%s' if table=='record_extras' else 'code=%s'
                keys=key if isinstance(key,tuple) else (key,)
                cursor.execute(f'UPDATE dbo.{identifier(table)} SET '+','.join(identifier(k)+'=%s' for k in fields)+' WHERE '+condition,
                    tuple(parameter(row[k],columns[table][k]) for k in fields)+tuple(keys))
                while cursor.nextset():
                    pass
                report['updated'][table]=report['updated'].get(table,0)+1
            elif before:
                report['reused'][table]=report['reused'].get(table,0)+1
            else:
                fields=list(row)
                cursor.execute(f'INSERT INTO dbo.{identifier(table)} ('+','.join(map(identifier,fields))+') VALUES ('+','.join(['%s']*len(fields))+')',
                    tuple(parameter(row[k],columns[table][k]) for k in fields))
                while cursor.nextset():
                    pass
                report['inserted'][table]=report['inserted'].get(table,0)+1
                existing[key]=row
    after=target_snapshot(connection)['records']
    verified={}
    for table, rows in expected.items():
        stored={key_for(table,r):r for r in after.get(table,[])}
        for key, row in rows.items():
            actual=stored.get(key)
            if actual is None:
                raise ValueError(f'Verification failed: missing row in {table}')
            for name,value in row.items():
                if name in {'id','created_at','updated_at'}:
                    continue
                if canonical(value,columns[table][name])!=canonical(actual.get(name),columns[table][name]):
                    raise ValueError(f'Verification failed: {table}.{name}')
        if rows:
            verified[table]=len(rows)
    report['verified_source_rows']=verified
    report['courses']=len(after.get('programs',[]))
    report['accounts']=len(after.get('users',[]))
    return report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--merge-login',choices=['postgres'])
    parser.add_argument('--target-env',default='.migration-target/.env')
    parser.add_argument('--source-env',default='.migration-target/source-postgres.env')
    args=parser.parse_args()
    settings=target_settings(args.target_env)
    directory=ROOT/'.migration-target'/'backups'
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    with postgres_connect(DatabaseSettings(_env_file=args.source_env)) as source_conn:
        source_conn.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
        source=source_snapshot(source_conn)
        print(json.dumps({'stage':'source-read','tables':len(source['records']),'rows':sum(map(len,source['records'].values()))}),flush=True)
        target=sqlserver_connect(settings)
        try:
            cur=target.raw.cursor()
            cur.execute("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource='edunexa-store:dbo',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000; SELECT @r")
            if cur.fetchone()[0]<0:
                raise ValueError('Target is busy')
            before=target_snapshot(target)
            backups={'source':protect_backup(directory,stamp+'-postgres',source),
                'target':protect_backup(directory,stamp+'-sqlserver',before)}
            print(json.dumps({'stage':'backups-created','files':backups}),flush=True)
            prepare(source,before,args.merge_login)  # fail on an unresolved login before DDL.
            patch=schema_patch(source,before)
            patch_file=ROOT/'.migration-target'/f'{stamp}-alignment.sql'
            patch_file.write_text(';\n'.join(patch)+';\n')
            for statement in patch:
                cur.execute(statement)
                while cur.nextset():
                    pass
            print(json.dumps({'stage':'schema-aligned','statements':len(patch)}),flush=True)
            result=transfer(target,source,before,args.merge_login)
            version='011-postgres-transfer'
            digest=hashlib.sha256(patch_file.read_bytes()).hexdigest()
            cur.execute('SELECT version FROM dbo.schema_migrations WHERE version=%s',(version,))
            if cur.fetchone() is None:
                cur.execute('INSERT INTO dbo.schema_migrations (version,source_file,source_sha256,applied_file,applied_sha256) VALUES (%s,%s,%s,%s,%s)',
                    (version,'PostgreSQL verified transfer',digest,patch_file.name,digest))
                while cur.nextset():
                    pass
            result.update({'committed':args.apply,'backups':backups,'schema_statements':len(patch)})
            if args.apply:
                target.commit()
            else:
                target.rollback()
            output=ROOT/'.migration-target'/f'{stamp}-report.json'
            output.write_text(json.dumps(result,indent=2))
            print(json.dumps(result),flush=True)
        except BaseException:
            target.rollback()
            raise
        finally:
            target.close()


if __name__=='__main__':
    try:
        main()
    except Exception as exc:
        # Driver errors can contain row values. Keep details local, never print them.
        path=ROOT/'.migration-target'/'last-error.txt'
        path.write_text(__import__('traceback').format_exc());os.chmod(path,0o600)
        print(json.dumps({'status':'rolled-back','error_type':type(exc).__name__,'details_file':str(path)}),flush=True)
        sys.exit(1)
