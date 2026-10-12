from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import risk, investigation


app = FastAPI(
    title="Aegis Fraud Detection API",
    version="0.1.0",
    description="Backend service for fraud detection, risk scoring, and investigation platform."
)

# Configure CORS for React frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(risk.router)
app.include_router(risk.router)
app.include_router(investigation.router)

@app.get("/api/v1/health", tags=["System Health"])
def health_check():
    return {"status": "healthy", "service": "aegis-backend"}