import importlib
import json
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core import integrations_api, mobile_api
from app.core.resources import CATALOG
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
from app.modules.master_data.onboarding.api import router as master_data_router
from app.modules.mobile.workspace.api import router as completion_router_0
from app.modules.operations.workflows.api import router as completion_router_2
from app.modules.reports.downloads.api import router as reports_router


def create_app(settings=None):
    settings = settings or Settings()
    app = FastAPI(
        title="EduNexa College API",
        version="0.1.0",
        description="EduNexa College backend. PostgreSQL (Supabase) persistence (or local JSON for development).",
    )
    app.state.settings = settings
    if settings.storage_backend == "postgres":
        from app.core.sql_store import PostgresStore

        app.state.store = PostgresStore()
    else:
        app.state.store = Store(settings.data_dir)
    app.state.catalog = CATALOG
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
        return {"status": "ok", "storage": settings.storage_backend}

    @app.get("/api/v1/manifest", tags=["API manifest"])
    def manifest():
        return json.loads(
            (Path(__file__).parent / "contracts/resources.json").read_text()
        )

    for router in [
        auth_api.router,
        admin_api.router,
        forms_router,
        finance_router,
        admissions_router,
        hostel_router,
        mobile_api.router,
        public_router,
        integrations_api.router,
        completion_router_0,
        completion_router_1,
        completion_router_2,
        completion_router_3,
        completion_router_4,
        enrollment_router,
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
    return app
