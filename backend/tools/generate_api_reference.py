"""Write docs/API_REFERENCE.txt: every API grouped by module and by dashboard screen, with URL,
method, permission, sample payload and sample response; and app/contracts/openapi-examples.json,
the same samples for the interactive documentation at /docs.

Samples are real where possible: the test suite runs (local JSON store, temporary data) with a
recorder that keeps the first successful request/response per endpoint; tokens and passwords are
masked. CRUD screens use records built from each table's contract, and remaining endpoints show
their request schema. Run from backend/: python tools/generate_api_reference.py
"""

import json
import re
import secrets
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
OUT = ROOT / "docs" / "API_REFERENCE.txt"
# The same samples feed the interactive docs (/docs): app.main merges them into the OpenAPI schema.
EXAMPLES = ROOT / "app" / "contracts" / "openapi-examples.json"
SECRET_KEYS = {"access_token", "refresh_token", "password", "new_password", "current_password", "password_hash",
               "token", "content_base64", "signature"}
MAX_LINES = 40


# ---------------------------------------------------------------------------
# Capture real request/response pairs from the test suite
# ---------------------------------------------------------------------------


def mask(value):
    if isinstance(value, dict):
        return {k: ("<" + k + ">" if k in SECRET_KEYS and v else mask(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [mask(v) for v in value[:2]] + (["..."] if len(value) > 2 else [])
    return value


class Recorder:
    def __init__(self):
        self.samples = {}

    def pytest_configure(self, config):
        from starlette.testclient import TestClient

        original = TestClient.request
        recorder = self

        def request(client, method, url, *args, **kwargs):
            response = original(client, method, url, *args, **kwargs)
            try:
                key = (method.upper(), str(url).split("?")[0])
                if 200 <= response.status_code < 300 and key not in recorder.samples:
                    body = kwargs.get("json")
                    ctype = response.headers.get("content-type", "")
                    out = response.json() if "json" in ctype else f"<{ctype or 'empty'} body, {len(response.content)} bytes>"
                    query = str(url).split("?", 1)[1] if "?" in str(url) else ""
                    recorder.samples[key] = {"status": response.status_code, "request": mask(body) if body else None,
                                             "query": query, "response": mask(out) if response.content else None}
            except Exception:
                pass
            return response

        TestClient.request = request


def capture():
    import pytest

    recorder = Recorder()
    code = pytest.main(["-q", "-p", "no:cacheprovider", str(ROOT / "tests")], plugins=[recorder])
    if code not in (0, 1):
        raise SystemExit(f"Test run failed to start ({code})")
    return recorder.samples


# ---------------------------------------------------------------------------
# Sample records from table contracts
# ---------------------------------------------------------------------------


def example(table, field):
    name, kind = field["name"], field["type"]
    if field.get("choices"):
        return field["choices"][0]
    if name == "code":
        return f"{table[:3].upper()}-001"
    if name.endswith("_code"):
        return f"{(field.get('reference') or name[:-5])[:3].upper()}-001"
    if "email" in name:
        return "name@example.edu"
    if "phone" in name:
        return "9876543210"
    if kind == "date":
        return "2026-06-01"
    if kind.startswith("timestamp"):
        return "2026-06-01T09:00:00+05:30"
    if kind == "boolean":
        return True
    if kind in {"integer", "smallint", "bigint"}:
        return 1
    if kind.startswith("numeric"):
        return "1000.00"
    if kind in {"jsonb", "text[]"}:
        return {}
    if name.endswith("_at"):
        return "2026-06-01T09:00:00+05:30"
    return name.replace("_", " ").capitalize()


def sample_record(catalog, table, required_only=False):
    return {f["name"]: example(table, f) for f in catalog[table]["fields"] if f.get("required") or not required_only}


def schema_example(spec, schema, depth=0):
    if depth > 6 or not isinstance(schema, dict):
        return "..."
    if "$ref" in schema:
        return schema_example(spec, spec["components"]["schemas"][schema["$ref"].split("/")[-1]], depth + 1)
    for key in ("anyOf", "oneOf", "allOf"):
        if key in schema:
            options = [s for s in schema[key] if s.get("type") != "null"]
            return schema_example(spec, options[0], depth + 1) if options else None
    kind = schema.get("type")
    if "enum" in schema:
        return schema["enum"][0]
    if kind == "object" or "properties" in schema:
        return {k: schema_example(spec, v, depth + 1) for k, v in schema.get("properties", {}).items()}
    if kind == "array":
        return [schema_example(spec, schema.get("items", {}), depth + 1)]
    if kind == "string":
        fmt = schema.get("format")
        return {"date": "2026-06-01", "date-time": "2026-06-01T09:00:00+05:30"}.get(fmt, "string")
    if kind == "integer":
        return 1
    if kind == "number":
        return 1.0
    if kind == "boolean":
        return True
    return None


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


def pretty(value):
    text = json.dumps(value, indent=2, ensure_ascii=False, default=str)
    lines = text.splitlines()
    if len(lines) > MAX_LINES:
        lines = lines[:MAX_LINES] + ["  ... (truncated)"]
    return "\n".join("      " + line for line in lines)


EXAMPLE_DATA = {}


def entry(method, path, purpose, permission=None, query=None, payload=None, status=200, response=None, note=None):
    if payload is not None or response is not None:
        EXAMPLE_DATA[f"{method} {path}"] = {"status": status, "request": payload,
                                            "response": response if isinstance(response, (dict, list)) else None,
                                            "query": query}
    out = [f"  {method:<6} {path}", f"      Purpose: {purpose}"]
    if permission:
        out.append(f"      Permission: {permission}")
    if query:
        out.append(f"      Query: {query}")
    if payload is not None:
        out += ["      Sample payload:", pretty(payload)]
    out.append(f"      Response {status}:" if response is not None else f"      Response {status}: (no body)")
    if response is not None:
        out.append(pretty(response))
    if note:
        out.append(f"      Note: {note}")
    return "\n".join(out) + "\n"


def matcher(path):
    return re.compile("^" + re.sub(r"\{[^}]+\}", r"[^/]+", path) + "$")


def main():
    samples = capture()

    from app.core.resources import CATALOG
    from app.core.settings import Settings
    from app.main import create_app

    app = create_app(Settings(jwt_secret=secrets.token_urlsafe(64), data_dir=Path(tempfile.mkdtemp())))
    spec = app.openapi()
    resources = json.loads((ROOT / "app/contracts/resources.json").read_text())
    screens = json.loads((ROOT / "app/contracts/screens.json").read_text())
    crud = {e["path"]: e for e in resources if e["generic_api"]}

    def captured(method, path):
        rx = matcher(path)
        return next((v for (m, p), v in samples.items() if m == method and rx.match(p)), None)

    lines = [
        "EDUNEXA COLLEGE — API REFERENCE",
        "=" * 78,
        "Generated by backend/tools/generate_api_reference.py from the running API definition.",
        "Samples marked [captured] are real request/response pairs recorded from the backend test",
        "suite (tokens and passwords masked); other samples are built from the table contracts or the",
        "request schema. Interactive documentation: <base-url>/docs (OpenAPI: <base-url>/openapi.json).",
        "",
        "Base URL       : http://<host>:8010   (all paths below start with /api/v1 unless shown)",
        "Authentication : POST /api/v1/auth/login -> access_token; send 'Authorization: Bearer <token>'.",
        "                 Refresh with POST /api/v1/auth/refresh. Web portal calls go through the",
        "                 dashboard proxy /api/college/<path without /api/v1>, which keeps tokens in cookies.",
        "Errors         : JSON {\"detail\": \"message\"}; 401 not signed in, 403 no permission,",
        "                 404 not found, 409 conflicts with a business or database rule, 422 invalid input.",
        "Paging         : list endpoints accept offset (default 0) and limit (default 50, max 200) and",
        "                 return {items, total, offset, limit}.",
        "Permissions    : <table>:<action>, action one of view, create, edit, delete, approve, export.",
        "",
    ]

    # Part 1: by module
    lines += ["", "PART 1 — APIS BY MODULE AND SCREEN", "=" * 78, ""]
    done = set()
    by_module = {}
    for e in resources:
        if e["generic_api"]:
            by_module.setdefault(e["module"], []).append(e)
    other = {}
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            if path in crud or path.rstrip("}").rsplit("/{", 1)[0] in crud:
                continue
            tag = (op.get("tags") or ["General"])[0]
            other.setdefault(tag, []).append((method.upper(), path, op))

    for module in sorted(by_module):
        lines += [f"MODULE: {module.replace('_', ' ').title()}", "-" * 78]
        for e in sorted(by_module[module], key=lambda x: x["screen"]):
            table, base = e["screen"], e["path"]
            record = sample_record(CATALOG, table)
            required = sample_record(CATALOG, table, required_only=True)
            lines.append(f"\n  Screen/table: {table.replace('_', ' ').title()}  ({table})\n")

            def real(method, path, fallback):
                got = captured(method, path)
                done.add((method, path))
                return (got["response"], " [captured]") if got and got["response"] is not None else (fallback, "")

            resp, tag = real("GET", base, {"items": [record], "total": 1, "offset": 0, "limit": 50})
            lines.append(entry("GET", base, "List records" + tag, f"{table}:view", "offset=0&limit=50", response=resp))
            resp, tag = real("GET", base + "/{code}", record)
            lines.append(entry("GET", base + "/{code}", "Get one record by code" + tag, f"{table}:view", response=resp))
            got = captured("POST", base)
            done.add(("POST", base))
            lines.append(entry("POST", base, "Create a record" + (" [captured]" if got else ""), f"{table}:create",
                               payload=got["request"] if got and got["request"] else required, status=201,
                               response=got["response"] if got else record))
            got = captured("PATCH", base + "/{code}")
            done.add(("PATCH", base + "/{code}"))
            patch = {k: v for k, v in record.items() if k not in {"code"}}
            lines.append(entry("PATCH", base + "/{code}", "Update fields of a record" + (" [captured]" if got else ""),
                               f"{table}:edit", payload=got["request"] if got and got["request"] else dict(list(patch.items())[:2]),
                               response=got["response"] if got else record))
            done.add(("DELETE", base + "/{code}"))
            lines.append(entry("DELETE", base + "/{code}", "Delete a record (refused while other records reference it)",
                               f"{table}:delete", status=204))
        lines.append("")

    for tag in sorted(other):
        lines += [f"MODULE: {tag}", "-" * 78, ""]
        for method, path, op in sorted(other[tag], key=lambda x: (x[1], x[0])):
            got = captured(method, path)
            body = op.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema")
            payload = (got["request"] if got and got["request"] else None) or (schema_example(spec, body) if body else None)
            status = got["status"] if got else int(next((s for s in op.get("responses", {}) if s.startswith("2")), "200"))
            purpose = (op.get("description") or op.get("summary") or "").strip().splitlines()[0] if (op.get("description") or op.get("summary")) else ""
            response_schema = (op.get("responses", {}).get(str(status), {}).get("content", {})
                               .get("application/json", {}).get("schema"))
            response = got["response"] if got else (schema_example(spec, response_schema) if response_schema else None)
            lines.append(entry(method, path, (purpose or path) + (" [captured]" if got else ""), query=got["query"] if got and got["query"] else None,
                               payload=payload, status=status, response=response,
                               note=None if got else "Response shape: see /docs for this endpoint"))
        lines.append("")

    # Part 2: by dashboard screen
    lines += ["", "PART 2 — DASHBOARD SCREENS AND THE APIS THEY USE", "=" * 78, ""]
    paths = {e["screen"]: e["path"] for e in resources if e["generic_api"]}
    special = {
        "roles": ["GET /api/v1/administration/roles", "POST /api/v1/administration/roles", "PUT /api/v1/administration/roles/{code}", "DELETE /api/v1/administration/roles/{code}"],
        "accounts": ["GET /api/v1/administration/accounts", "POST /api/v1/administration/accounts"],
        "forms": ["GET /api/v1/forms", "POST /api/v1/forms"],
        "imports": ["GET /api/v1/imports/excel/contract", "POST /api/v1/imports/excel/validate", "POST /api/v1/imports/excel/{code}/commit"],
        "documents": ["POST /api/v1/documents/upload", "GET /api/v1/documents/{kind}/{code}/download"],
        "student-enrollment": ["POST /api/v1/master-data/actions/enroll-student  (student with father and mother details)",
                               "POST /api/v1/master-data/students", "POST /api/v1/master-data/students/{student_code}/parents",
                               "GET /api/v1/master-data/students/{student_code}/parents",
                               "POST /api/v1/documents/upload  (kind student_document)"],
        "teaching-staff": ["POST /api/v1/master-data/staff/teaching", "GET /api/v1/master-data/staff?kind=teaching"],
        "non-teaching-staff": ["POST /api/v1/master-data/staff/non-teaching", "GET /api/v1/master-data/staff?kind=non-teaching"],
        "course-setup": ["POST /api/v1/master-data/courses", "POST /api/v1/master-data/courses/{program_code}/batches",
                         "GET /api/v1/master-data/courses/{program_code}", "POST /api/v1/master-data/course-enrollments"],
    }
    for s in screens:
        lines.append(f"Screen: {s['title']}  (key: {s['key']})")
        lines.append(f"  GET /api/v1/workspace/screens/{s['key']}   -> resources, fields and allowed actions")
        for api in special.get(s["key"], []):
            lines.append(f"  {api}")
        for table in s["resources"]:
            if table in paths:
                lines.append(f"  {table:<34} {paths[table]}   (GET list, GET/{{code}}, POST, PATCH/{{code}}, DELETE/{{code}})")
        lines.append("")

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n")
    EXAMPLES.write_text(json.dumps(EXAMPLE_DATA, indent=1, ensure_ascii=False, default=str) + "\n")
    endpoints = sum(len(m) for m in spec["paths"].values())
    print(f"Wrote {OUT.relative_to(ROOT)}: {endpoints} endpoints, {len(samples)} captured samples, {len(screens)} screens")


if __name__ == "__main__":
    main()
