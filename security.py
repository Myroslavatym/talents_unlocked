import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque

PBKDF2_ITERATIONS = 600_000


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return f"{salt}${digest.hex()}"


_DUMMY_HASH = hash_password(secrets.token_hex(16))


def verify_password(password, stored_hash):
    stored_hash = stored_hash or _DUMMY_HASH
    salt = stored_hash.split("$")[0]
    return hmac.compare_digest(hash_password(password, salt), stored_hash)


CSRF_SESSION_KEY = "csrf_token"


def get_csrf_token(request):
    token = request.session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        request.session[CSRF_SESSION_KEY] = token
    return token


def is_valid_csrf(request, submitted_token):
    expected = request.session.get(CSRF_SESSION_KEY)
    return bool(expected and submitted_token) and hmac.compare_digest(expected, submitted_token)


class LoginRateLimiter:
    def __init__(self, max_attempts=5, window=15 * 60):
        self.max_attempts = max_attempts
        self.window = window
        self._failures = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key, now):
        attempts = self._failures[key]
        while attempts and now - attempts[0] > self.window:
            attempts.popleft()
        return attempts

    def retry_after(self, key):
        now = time.monotonic()
        with self._lock:
            attempts = self._prune(key, now)
            if len(attempts) < self.max_attempts:
                return 0
            return max(1, int(self.window - (now - attempts[0])))

    def register_failure(self, key):
        with self._lock:
            self._prune(key, time.monotonic()).append(time.monotonic())

    def reset(self, key=None):
        with self._lock:
            if key is None:
                self._failures.clear()
            else:
                self._failures.pop(key, None)


login_limiter = LoginRateLimiter()


CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'",
    ]
)

SECURITY_HEADERS = {
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}


async def security_headers_middleware(request, call_next):
    response = await call_next(request)
    for header, value in SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    if request.url.scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if request.url.path in ("/dashboard", "/login", "/signup"):
        response.headers["Cache-Control"] = "no-store"
    return response
