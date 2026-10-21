import sqlite3
from contextlib import contextmanager
from pathlib import Path


import os


def get_database_path():
    if "DATABASE_PATH" in os.environ:
        return Path(os.environ["DATABASE_PATH"])
    default_path = Path(__file__).resolve().parent / "talents.db"
    try:
        test_file = Path(__file__).resolve().parent / ".write_test"
        test_file.touch()
        test_file.unlink()
        return default_path
    except OSError:
        return Path("/tmp/talents.db")


DATABASE_PATH = get_database_path()


@contextmanager
def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize_database():
    with get_connection() as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
            )"""
        )
