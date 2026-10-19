import os

# Ensure safe default environment variables for headless unit testing
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-suite-jwt-secret-key-32-chars-minimum-length-for-pytest!",
)

