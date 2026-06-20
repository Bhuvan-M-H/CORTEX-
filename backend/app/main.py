from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import os

from . import ml_pipeline
from . import database

app = FastAPI(
    title="EventDNA AI Backend",
    description="Backend API for Event Impact Intelligence & Traffic Operations Copilot",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class EventCreateSchema(BaseModel):
    event_cause: str = Field(..., example="procession")
    event_type: str = Field(..., example="planned")
    zone: str = Field(..., example="Central Zone 2")
    junction: str = Field(..., example="M.G. Road")
    latitude: float = Field(12.9716, example=12.9716)
    longitude: float = Field(77.5946, example=77.5946)
    requires_road_closure: bool = Field(False, example=False)
    duration: float = Field(60.0, description="Duration in minutes", example=60.0)
    priority: str = Field("Low", example="Low")
    description: Optional[str] = Field(None, example="Annual religious procession route.")
    start_datetime: Optional[str] = Field(None, example="2026-06-20T14:00:00")

class PredictRequestSchema(BaseModel):
    event_cause: str
    event_type: str
    zone: str
    junction: str
    requires_road_closure: bool
    duration: float
    priority: str = "Low"

class TomFeedbackSchema(BaseModel):
    event_id: int
    predicted_impact: float
    recommended_officers: int
    recommended_patrols: int
    recommended_supervisors: int
    recommended_barricades: int
    actual_impact: float
    actual_officers: int
    actual_barricades: int
    actual_outcome: str # Successful, Partially Successful, Failed
    feedback: str

@app.on_event("startup")
def startup_event():
    print("Pre-loading ML Models and Index...")
    ml_pipeline.load_all_models()
    print("API is ready to handle requests.")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "EventDNA AI",
        "description": "Traffic Operations Copilot & Event Impact Intelligence Engine"
    }

# Endpoint 1: Get Paginated Events (Command Center and Database)
@app.get("/api/events")
def get_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    zone: Optional[str] = None,
    risk_level: Optional[str] = None,
    event_cause: Optional[str] = None,
    query: Optional[str] = None
):
    try:
        data = database.get_paginated_events(page, page_size, zone, risk_level, event_cause, query)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint 2: Get Single Event by ID
@app.get("/api/events/{event_id}")
def get_event(event_id: int):
    event = database.get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

# Endpoint 3: Predict Event Impact & Get Operational Recommendations
@app.post("/api/predict")
def predict_event(request: PredictRequestSchema):
    try:
        preds = ml_pipeline.predict_event_impact_and_recommend(
            event_cause=request.event_cause,
            event_type=request.event_type,
            zone=request.zone,
            junction=request.junction,
            requires_road_closure=request.requires_road_closure,
            duration=request.duration,
            priority=request.priority
        )
        return preds
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint 4: Insert New Event and Save Prediction
@app.post("/api/events")
def create_event(request: EventCreateSchema):
    try:
        # 1. Run predictions & recommendations first
        preds = ml_pipeline.predict_event_impact_and_recommend(
            event_cause=request.event_cause,
            event_type=request.event_type,
            zone=request.zone,
            junction=request.junction,
            requires_road_closure=request.requires_road_closure,
            duration=request.duration,
            priority=request.priority
        )
        
        # 2. Prepare event dictionary for insert
        start_dt = request.start_datetime or datetime.now().isoformat()
        
        event_dict = {
            'event_cause': request.event_cause,
            'event_type': request.event_type,
            'zone': request.zone,
            'junction': request.junction,
            'latitude': request.latitude,
            'longitude': request.longitude,
            'requires_road_closure': request.requires_road_closure,
            'duration': request.duration,
            'priority': request.priority,
            'description': request.description or "",
            'start_datetime': start_dt,
            'generated_description': preds['description'],
            'impact_score': preds['predicted_impact'],
            'risk_level': preds['risk_level'],
            'duration_category': preds['duration_category'],
            'area_impact': preds['area_impact'],
            'manpower_officers': preds['recommended_officers'],
            'manpower_patrols': preds['recommended_patrols'],
            'manpower_supervisors': preds['recommended_supervisors'],
            'barricades_count': preds['recommended_barricades'],
            'barricades_placement': preds['barricades_placement'],
            'diversion_route_a': preds['diversion_route_a'],
            'diversion_route_b': preds['diversion_route_b'],
            'diversion_route_c': preds['diversion_route_c'],
            'diversion_reasoning': preds['diversion_reasoning'],
        }
        
        # 3. Save to database
        new_id = database.insert_new_event(event_dict)
        event_dict['id'] = new_id
        
        # Return saved event and predictions
        return {
            'event': event_dict,
            'predictions': preds
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint 5: Get Zone Risk Analytics
@app.get("/api/zone-risk")
def get_zone_risk():
    try:
        data = database.get_zone_risk_scores()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint 6: Traffic Operations Memory (TOM) Logs
@app.get("/api/tom")
def get_tom_memory(limit: int = Query(50, ge=1, le=200)):
    try:
        data = database.get_tom_records(limit)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint 7: Post-Event Learning Feedback loop submission
@app.post("/api/tom/feedback")
def submit_tom_feedback(request: TomFeedbackSchema):
    try:
        success = database.insert_tom_record(
            event_id=request.event_id,
            predicted_impact=request.predicted_impact,
            rec_off=request.recommended_officers,
            rec_pat=request.recommended_patrols,
            rec_sup=request.recommended_supervisors,
            rec_barr=request.recommended_barricades,
            act_impact=request.actual_impact,
            act_off=request.actual_officers,
            act_barr=request.actual_barricades,
            outcome=request.actual_outcome,
            feedback=request.feedback
        )
        return {"success": success, "message": "Feedback submitted successfully. Models and Memory updated."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint 8: Get Performance Metrics (Prediction Accuracy, Evolution etc.)
@app.get("/api/metrics")
def get_metrics():
    try:
        data = database.get_performance_metrics()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
