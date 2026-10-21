# Talents Unlocked

A simple local account platform built with FastAPI, SQLite, and HTML/CSS.

## Run locally

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open http://127.0.0.1:8000 in your browser. On Windows, activate with `.venv\Scripts\activate`.

The database `talents.db` is created automatically on startup. Sign up, log in, visit the dashboard, and log out. Emails are unique and stored in lowercase. Passwords are salted and hashed using PBKDF2; the `password` column never stores plain text.

The forgot-password page validates the email and checks whether an account exists. It displays a demo message and does not send email or change passwords.

`main.py` contains routes and validation, `database.py` manages SQLite, `templates/` contains the pages, and `static/style.css` contains styling. `base.html` shares the layout across pages.

## Deploy to Netlify

This project is configured to deploy directly to Netlify as a high-speed web application.

1. Connect your repository (`https://github.com/myra-rgb/talents_unlocked.git`) in Netlify.
2. Netlify will automatically detect the settings in [netlify.toml](netlify.toml):
   - **Publish directory**: `public`
3. Click **Deploy Site**. All pages (`/`, `/signup`, `/login`, `/dashboard`, `/forgot-password`) will load instantly without server setup.

