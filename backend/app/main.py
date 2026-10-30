import importlib
import json
import os
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.openapi.utils import get_openapi
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core import integrations_api, mobile_api, push_api
from app.core.timetable_templates import router as timetable_templates_router
from app.core.assignment_workspace import router as assignment_workspace_router
from app.core.resources import CATALOG
from app.core.files import files_for
from app.core.settings import Settings
from app.core.storage import Store
from app.modules.access_control.authentication import api as auth_api
from app.modules.access_control.forms.api import router as forms_router
from app.modules.access_control.role_management import api as admin_api
from app.modules.administration.workspace.api import router as completion_router_1
from app.modules.admissions.enrollment.api import router as admissions_router
from app.modules.admissions.public_intake.api import router as public_router
from app.modules.documents.files.api import router as completion_router_3
from app.modules.finance.transactions.api import router as finance_router
from app.modules.hostel.permissions_workflow.api import router as hostel_router
from app.modules.imports.excel.api import router as completion_router_4
from app.modules.master_data.enrollment.api import router as enrollment_router
from app.modules.master_data.staff.api import router as staff_onboarding_router
from app.modules.master_data.onboarding.api import router as master_data_router
from app.modules.mobile.workspace.api import router as completion_router_0
from app.modules.operations.workflows.api import router as completion_router_2
from app.modules.reports.downloads.api import router as reports_router


EXAMPLES = Path(__file__).parent / "contracts" / "openapi-examples.json"


def with_examples(app):
    """Show sample payloads and responses in /docs.

    The samples (real request/response pairs from the test suite, or records built from the table
    contracts) are written by tools/generate_api_reference.py, the same source as
    docs/API_REFERENCE.txt. Swagger shows them as each endpoint's request and response examples.
    """
    examples = json.loads(EXAMPLES.read_text()) if EXAMPLES.exists() else {}

    def openapi():
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(title=app.title, version=app.version, description=app.description, routes=app.routes)
        for path, methods in schema.get("paths", {}).items():
            for method, op in methods.items():
                sample = examples.get(f"{method.upper()} {path}")
                if not sample:
                    continue
                if sample.get("request") is not None:
                    body = op.setdefault("requestBody", {"required": True})
                    media = body.setdefault("content", {}).setdefault("application/json", {})
                    media.setdefault("schema", {"type": "object"})
                    media["example"] = sample["request"]
                if sample.get("response") is not None:
                    status = str(sample.get("status") or 200)
                    response = op.setdefault("responses", {}).setdefault(status, {"description": "Successful Response"})
                    media = response.setdefault("content", {}).setdefault("application/json", {})
                    media.setdefault("schema", {})
                    media["example"] = sample["response"]
                if sample.get("query"):
                    op["description"] = (op.get("description") or op.get("summary") or "").rstrip() + \
                        f"\n\nExample query: `?{sample['query']}`"
        app.openapi_schema = schema
        return schema

    app.openapi = openapi


def create_app(settings=None):
    settings = settings or Settings()
    app = FastAPI(
        title="EduNexa College API",
        version="0.1.0",
        description="EduNexa College backend. PostgreSQL or Microsoft SQL Server persistence (local JSON for development).",
    )
    app.state.settings = settings
    if settings.storage_backend == "postgres":
        from app.core.sql_store import PostgresStore

        app.state.store = PostgresStore()
    elif settings.storage_backend == "sqlserver":
        from app.core.sqlserver import SqlServerStore

        app.state.store = SqlServerStore()
    else:
        app.state.store = Store(settings.data_dir)
    app.state.catalog = CATALOG
    app.state.files = files_for(settings)
    if hasattr(app.state.store, "request_scope"):

        @app.middleware("http")
        async def release_snapshots(request: Request, call_next):
            # Read-only snapshots hand their database connection back when the request ends.
            with app.state.store.request_scope():
                return await call_next(request)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        # Limit JSON request buffering before validation. Files use a future streaming storage adapter.
        max_body = 1_048_576
        size = 0
        chunks = []
        async for chunk in request.stream():
            size += len(chunk)
            if size > max_body:
                return JSONResponse(
                    {"detail": "Request body exceeds 1 MiB"}, status_code=413
                )
            chunks.append(chunk)
        request._body = b"".join(chunks)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Request-ID"] = uuid4().hex
        return response

    @app.get("/health", tags=["Health"])
    def health():
        return {
            "status": "ok",
            "storage": settings.storage_backend,
            "files": type(app.state.files).__name__.replace("Files", "").lower() or "local",
            "certificate_signing": "configured" if settings.certificate_signing_key else "local key file"
            if not os.environ.get("VERCEL") else "not configured",
        }

    @app.get("/api/v1/manifest", tags=["API manifest"])
    def manifest():
        return json.loads(
            (Path(__file__).parent / "contracts/resources.json").read_text()
        )

    for router in [
        auth_api.router,
        timetable_templates_router,
        assignment_workspace_router,
        admin_api.router,
        forms_router,
        finance_router,
        admissions_router,
        hostel_router,
        mobile_api.router,
        push_api.router,
        public_router,
        integrations_api.router,
        completion_router_0,
        completion_router_1,
        completion_router_2,
        completion_router_3,
        completion_router_4,
        enrollment_router,
        staff_onboarding_router,
        master_data_router,
    ]:
        app.include_router(router, prefix="/api/v1")
    for entry in json.loads(
        (Path(__file__).parent / "contracts/resources.json").read_text()
    ):
        if entry["generic_api"]:
            module = importlib.import_module(
                f"app.modules.{entry['module']}.{entry['screen']}.api"
            )
            app.include_router(
                module.router, prefix="/api/v1/" + entry["module"].replace("_", "-")
            )
    app.include_router(reports_router, prefix="/api/v1")
    with_examples(app)
    return app
