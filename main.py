import os
import secrets
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from email_validator import EmailNotValidError
from fastapi import FastAPI, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from database import get_connection, initialize_database
from security import (
    get_csrf_token,
    hash_password,
    is_valid_csrf,
    login_limiter,
    security_headers_middleware,
    verify_password,
)
from validation import EMAIL_MAX, NAME_MAX, PASSWORD_MAX, PASSWORD_MIN, normalize_email, validate_signup


BASE_DIR = Path(__file__).resolve().parent
CSRF_ERROR = "Your session has expired. Please refresh the page and try again."


@asynccontextmanager
async def lifespan(app):
    initialize_database()
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
app.middleware("http")(security_headers_middleware)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET") or secrets.token_hex(32),
    same_site="lax",
    max_age=86400,
    https_only=os.environ.get("COOKIE_SECURE") == "1",
)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


def render(request, page, status_code=200, **context):
    context.setdefault("errors", {})
    context.update(
        csrf_token=get_csrf_token(request),
        logged_in=bool(request.session.get("user_id")),
        limits={"name_max": NAME_MAX, "email_max": EMAIL_MAX, "password_min": PASSWORD_MIN, "password_max": PASSWORD_MAX},
    )
    return templates.TemplateResponse(request=request, name=page, context=context, status_code=status_code)


def client_key(request, email):
    host = request.client.host if request.client else "unknown"
    return f"{host}|{email}"


@app.get("/")
def home(request: Request):
    return render(request, "home.html")


@app.get("/signup")
def signup_page(request: Request):
    if request.session.get("user_id"):
        return RedirectResponse("/dashboard", status_code=303)
    return render(request, "signup.html")


@app.post("/signup")
def signup(
    request: Request,
    name: str = Form(""),
    email: str = Form(""),
    password: str = Form(""),
    confirm_password: str = Form(""),
    csrf_token: str = Form(""),
):
    if not is_valid_csrf(request, csrf_token):
        return render(request, "signup.html", status_code=403, error=CSRF_ERROR, name=name, email=email)

    cleaned, errors = validate_signup(name, email, password, confirm_password)
    if not errors:
        with get_connection() as connection:
            try:
                connection.execute(
                    "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                    (cleaned["name"], cleaned["email"], hash_password(password)),
                )
            except sqlite3.IntegrityError:
                errors["email"] = "This email is already registered. Please log in."
    if errors:
        return render(
            request,
            "signup.html",
            status_code=400,
            error="Please fix the highlighted fields.",
            errors=errors,
            name=cleaned["name"],
            email=cleaned["email"],
        )
    return RedirectResponse("/login?created=1", status_code=303)


@app.get("/login")
def login_page(request: Request):
    if request.session.get("user_id"):
        return RedirectResponse("/dashboard", status_code=303)
    message = "Your account is ready. Log in to get started." if request.query_params.get("created") == "1" else None
    return render(request, "login.html", message=message)


@app.post("/login")
def login(request: Request, email: str = Form(""), password: str = Form(""), csrf_token: str = Form("")):
    if not is_valid_csrf(request, csrf_token):
        return render(request, "login.html", status_code=403, error=CSRF_ERROR, email=email)

    email = email.strip().lower()[:EMAIL_MAX]
    key = client_key(request, email)
    retry_after = login_limiter.retry_after(key)
    if retry_after:
        minutes = (retry_after + 59) // 60
        error = f"Too many failed attempts. Please wait {minutes} minute(s) and try again."
        response = render(request, "login.html", status_code=429, error=error, email=email)
        response.headers["Retry-After"] = str(retry_after)
        return response

    with get_connection() as connection:
        user = connection.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    password_ok = verify_password(password[:PASSWORD_MAX], user["password"] if user else None)
    if user and password_ok:
        login_limiter.reset(key)
        request.session.clear()
        request.session["user_id"] = user["id"]
        return RedirectResponse("/dashboard", status_code=303)

    login_limiter.register_failure(key)
    return render(request, "login.html", status_code=401, error="Email or password is incorrect. Please try again.", email=email)


@app.get("/forgot-password")
def forgot_password_page(request: Request):
    return render(request, "forgot_password.html")


@app.post("/forgot-password")
def forgot_password(request: Request, email: str = Form(""), csrf_token: str = Form("")):
    if not is_valid_csrf(request, csrf_token):
        return render(request, "forgot_password.html", status_code=403, error=CSRF_ERROR, email=email)
    try:
        email = normalize_email(email)
    except EmailNotValidError:
        return render(request, "forgot_password.html", status_code=400, error="Please enter a valid email address.", email=email)
    message = "If an account exists for this email, a reset link will be sent. (Demo mode: no email is sent.)"
    return render(request, "forgot_password.html", message=message, email=email)


@app.get("/dashboard")
def dashboard(request: Request):
    with get_connection() as connection:
        user = connection.execute("SELECT name, email FROM users WHERE id = ?", (request.session.get("user_id"),)).fetchone()
    if not user:
        request.session.clear()
        return RedirectResponse("/login", status_code=303)
    return render(request, "dashboard.html", user=user)


@app.post("/logout")
def logout(request: Request, csrf_token: str = Form("")):
    if is_valid_csrf(request, csrf_token):
        request.session.clear()
    return RedirectResponse("/login", status_code=303)
