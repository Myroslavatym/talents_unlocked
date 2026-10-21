import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

_TMP_DIR = tempfile.TemporaryDirectory()
os.environ["DATABASE_PATH"] = str(Path(_TMP_DIR.name) / "test.db")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

import security
from database import get_connection
from main import app
from validation import validate_signup

CSRF_RE = re.compile(r'name="csrf_token" value="([^"]+)"')
GOOD = {"name": "Ada Lovelace", "email": "Ada@Example.com", "password": "Secure123", "confirm_password": "Secure123"}


def csrf_from(response):
    match = CSRF_RE.search(response.text)
    assert match, "CSRF token not found in page"
    return match.group(1)


class SignupValidationTests(unittest.TestCase):
    def test_valid_data_passes_and_is_normalized(self):
        cleaned, errors = validate_signup("  Ada   Lovelace ", "Ada@Example.com", "Secure123", "Secure123")
        self.assertEqual(errors, {})
        self.assertEqual(cleaned, {"name": "Ada Lovelace", "email": "ada@example.com"})

    def test_cyrillic_hyphen_and_apostrophe_names_are_allowed(self):
        for name in ("Іван Мельник", "Mary-Jane", "O'Connor"):
            _, errors = validate_signup(name, "a@b.co", "Secure123", "Secure123")
            self.assertNotIn("name", errors, name)

    def test_name_rules(self):
        cases = {"": "Please enter", "A": "between", "x" * 51: "between", "R2D2": "only contain", "<script>": "only contain"}
        for name, expected in cases.items():
            _, errors = validate_signup(name, "a@b.co", "Secure123", "Secure123")
            self.assertIn(expected, errors.get("name", ""), name)

    def test_email_rules(self):
        for email in ("", "plainaddress", "a@b", "a@@b.com", "a" * 250 + "@b.com"):
            _, errors = validate_signup("Ada", email, "Secure123", "Secure123")
            self.assertIn("email", errors, email)

    def test_password_rules(self):
        cases = {
            "": "create a password",
            "Ab1": "at least 8 characters",
            "alllowercase1": "an uppercase letter",
            "ALLUPPERCASE1": "a lowercase letter",
            "NoNumbersHere": "a number",
            "Aa1" + "x" * 130: "at most 128",
        }
        for password, expected in cases.items():
            _, errors = validate_signup("Ada", "a@b.co", password, password)
            self.assertIn(expected, errors.get("password", ""), password)

    def test_confirm_password_must_match(self):
        _, errors = validate_signup("Ada", "a@b.co", "Secure123", "Secure124")
        self.assertEqual(errors.get("confirm_password"), "Passwords do not match.")


class AuthFlowTests(unittest.TestCase):
    def setUp(self):
        self.client_cm = TestClient(app)
        self.client = self.client_cm.__enter__()
        security.login_limiter.reset()
        with get_connection() as connection:
            connection.execute("DELETE FROM users")

    def tearDown(self):
        self.client_cm.__exit__(None, None, None)

    def signup(self, **overrides):
        data = dict(GOOD, **overrides)
        data["csrf_token"] = csrf_from(self.client.get("/signup"))
        return self.client.post("/signup", data=data, follow_redirects=False)

    def login(self, email="ada@example.com", password="Secure123"):
        token = csrf_from(self.client.get("/login"))
        return self.client.post("/login", data={"email": email, "password": password, "csrf_token": token}, follow_redirects=False)

    def test_home_page_lists_course_catalog(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn('id="course-grid"', response.text)
        self.assertIn("/static/courses.js", response.text)
        self.assertEqual(self.client.get("/static/courses.js").status_code, 200)

    def test_signup_success_redirects_to_login_and_hashes_password(self):
        response = self.signup()
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["location"], "/login?created=1")
        with get_connection() as connection:
            row = connection.execute("SELECT name, email, password FROM users").fetchone()
        self.assertEqual((row["name"], row["email"]), ("Ada Lovelace", "ada@example.com"))
        self.assertNotIn("Secure123", row["password"])
        self.assertRegex(row["password"], r"^[0-9a-f]{32}\$[0-9a-f]{64}$")

    def test_signup_shows_field_errors(self):
        response = self.signup(name="A", email="bad", password="weak", confirm_password="other")
        self.assertEqual(response.status_code, 400)
        for text in ("between 2 and 50", "valid email", "at least 8 characters", "Passwords do not match"):
            self.assertIn(text, response.text)

    def test_duplicate_email_is_rejected(self):
        self.signup()
        response = self.signup(email="ADA@example.com")
        self.assertEqual(response.status_code, 400)
        self.assertIn("already registered", response.text)

    def test_signup_escapes_html_in_name(self):
        response = self.signup(name="<script>alert(1)</script>")
        self.assertNotIn("<script>alert(1)</script>", response.text)

    def test_full_login_flow(self):
        self.signup()
        self.assertEqual(self.client.get("/dashboard", follow_redirects=False).headers["location"], "/login")

        response = self.login(email="  ADA@example.com ")
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["location"], "/dashboard")

        dashboard = self.client.get("/dashboard")
        self.assertEqual(dashboard.status_code, 200)
        self.assertIn("Ada Lovelace", dashboard.text)
        self.assertEqual(dashboard.headers["cache-control"], "no-store")
        self.assertEqual(self.client.get("/login", follow_redirects=False).headers["location"], "/dashboard")

        logout = self.client.post("/logout", data={"csrf_token": csrf_from(dashboard)}, follow_redirects=False)
        self.assertEqual(logout.headers["location"], "/login")
        self.assertEqual(self.client.get("/dashboard", follow_redirects=False).status_code, 303)

    def test_wrong_password_and_unknown_email_get_same_error(self):
        self.signup()
        wrong = self.login(password="Wrong1234")
        unknown = self.login(email="nobody@example.com")
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(unknown.status_code, 401)
        self.assertIn("Email or password is incorrect", wrong.text)
        self.assertIn("Email or password is incorrect", unknown.text)

    def test_post_without_csrf_token_is_rejected(self):
        self.client.get("/signup")
        response = self.client.post("/signup", data=GOOD)
        self.assertEqual(response.status_code, 403)
        with get_connection() as connection:
            self.assertIsNone(connection.execute("SELECT id FROM users").fetchone())

    def test_login_is_rate_limited_after_five_failures(self):
        self.signup()
        for _ in range(5):
            self.assertEqual(self.login(password="Wrong1234").status_code, 401)
        locked = self.login()
        self.assertEqual(locked.status_code, 429)
        self.assertIn("Too many failed attempts", locked.text)
        self.assertIn("retry-after", locked.headers)

    def test_security_headers_are_present(self):
        headers = self.client.get("/").headers
        self.assertIn("default-src 'self'", headers["content-security-policy"])
        self.assertEqual(headers["x-frame-options"], "DENY")
        self.assertEqual(headers["x-content-type-options"], "nosniff")
        self.assertEqual(headers["referrer-policy"], "strict-origin-when-cross-origin")

    def test_forgot_password_does_not_reveal_accounts(self):
        self.signup()
        token = csrf_from(self.client.get("/forgot-password"))
        known = self.client.post("/forgot-password", data={"email": "ada@example.com", "csrf_token": token})
        unknown = self.client.post("/forgot-password", data={"email": "nobody@example.com", "csrf_token": token})
        self.assertIn("If an account exists", known.text)
        self.assertIn("If an account exists", unknown.text)


if __name__ == "__main__":
    unittest.main()
