import os
import httpx

# Ensure safe default environment variables for headless unit testing
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("TESTING", "1")
if os.environ.get("DATABASE_URL", "").startswith("sqlite"):
    os.environ.pop("DATABASE_HOST", None)
    os.environ.pop("DATABASE_PORT", None)

os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-suite-jwt-secret-key-32-chars-minimum-length-for-pytest!",
)

# Compatibility shim: httpx >= 0.28 removed the legacy 'app' argument from Client.__init__,
# which Starlette 0.36.x passes to super().__init__ in TestClient.
_orig_httpx_init = httpx.Client.__init__


def _compat_httpx_init(self, *args, app=None, **kwargs):
    return _orig_httpx_init(self, *args, **kwargs)


httpx.Client.__init__ = _compat_httpx_init
