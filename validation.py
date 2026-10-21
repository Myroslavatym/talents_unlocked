import re

from email_validator import EmailNotValidError, validate_email

NAME_MIN = 2
NAME_MAX = 50
EMAIL_MAX = 254
PASSWORD_MIN = 8
PASSWORD_MAX = 128

NAME_PATTERN = re.compile(r"^[^\W\d_]+(?:[ '\-][^\W\d_]+)*$")


def clean_name(name):
    return " ".join((name or "").split())


def normalize_email(email):
    email = (email or "").strip()
    if len(email) > EMAIL_MAX:
        raise EmailNotValidError("Email is too long.")
    return validate_email(email, check_deliverability=False).normalized.lower()


def password_problems(password):
    problems = []
    if len(password) < PASSWORD_MIN:
        problems.append(f"at least {PASSWORD_MIN} characters")
    if not re.search(r"[a-z]", password):
        problems.append("a lowercase letter")
    if not re.search(r"[A-Z]", password):
        problems.append("an uppercase letter")
    if not re.search(r"[0-9]", password):
        problems.append("a number")
    return problems


def validate_signup(name, email, password, confirm_password):
    errors = {}
    name = clean_name(name)
    email = (email or "").strip()
    password = password or ""
    confirm_password = confirm_password or ""

    if not name:
        errors["name"] = "Please enter your name."
    elif len(name) < NAME_MIN or len(name) > NAME_MAX:
        errors["name"] = f"Name must be between {NAME_MIN} and {NAME_MAX} characters."
    elif not NAME_PATTERN.match(name):
        errors["name"] = "Name can only contain letters, spaces, hyphens and apostrophes."

    if not email:
        errors["email"] = "Please enter your email address."
    else:
        try:
            email = normalize_email(email)
        except EmailNotValidError:
            errors["email"] = "Please enter a valid email address (e.g. you@example.com)."

    if not password:
        errors["password"] = "Please create a password."
    elif len(password) > PASSWORD_MAX:
        errors["password"] = f"Password must be at most {PASSWORD_MAX} characters."
    else:
        problems = password_problems(password)
        if problems:
            errors["password"] = "Password must contain " + ", ".join(problems) + "."

    if not confirm_password:
        errors["confirm_password"] = "Please confirm your password."
    elif confirm_password != password:
        errors["confirm_password"] = "Passwords do not match."

    return {"name": name, "email": email}, errors
