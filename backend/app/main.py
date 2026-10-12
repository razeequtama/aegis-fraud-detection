from fastapi import FastAPI

app = FastAPI(
    title="Aegis Fraud Detection API",
    version="0.1.0",
    description="Backend service for risk scoring, graph analysis, and fraud investigation."
)

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "service": "aegis-backend",
        "version": "0.1.0"
    }