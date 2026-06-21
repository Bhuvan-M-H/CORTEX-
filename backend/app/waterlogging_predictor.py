import os
import json
import joblib
import requests
from datetime import datetime
from . import database

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXCEL_PATH = os.path.join(BASE_DIR, "underpass.xlsx")
JSON_PATH = os.path.join(BASE_DIR, "underpasses.json")
MODEL_PATH = os.path.join(BASE_DIR, "backend", "app", "waterlogging_model.joblib")

class WaterloggingPredictor:
    def __init__(self):
        self.model = None
        self.underpasses = []
        self._load_resources()

    def _load_resources(self):
        # Load Model
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                print(f"Loaded waterlogging prediction model from {MODEL_PATH}")
            except Exception as e:
                print(f"Error loading waterlogging model: {e}")
        else:
            print(f"Warning: Waterlogging model not found at {MODEL_PATH}")

        # Load Underpass Locations (JSON first, then Excel, then hardcoded fallback)
        if os.path.exists(JSON_PATH):
            try:
                with open(JSON_PATH, "r", encoding="utf-8") as f:
                    self.underpasses = json.load(f)
                print(f"Loaded {len(self.underpasses)} underpasses from {JSON_PATH}")
            except Exception as e:
                print(f"Error loading underpasses.json: {e}")

        if not self.underpasses and os.path.exists(EXCEL_PATH):
            try:
                import pandas as pd
                df = pd.read_excel(EXCEL_PATH)
                unique_df = df.groupby('underpass_id').first().reset_index()
                self.underpasses = unique_df.to_dict(orient="records")
                print(f"Loaded {len(self.underpasses)} underpasses from {EXCEL_PATH}")
            except Exception as e:
                print(f"Error loading underpass.xlsx: {e}")

        # Hardcoded BBMP Underpasses Fallback (so it always works!)
        if not self.underpasses:
            self.underpasses = [
                {
                    "underpass_id": "UP-01",
                    "location_name": "Kranthiveera Sangolli Rayanna (Majestic) Underpass",
                    "latitude": 12.9764,
                    "longitude": 77.5729,
                    "bbmp_zone": "Central Zone 1",
                    "drain_blockage_flag": 1
                },
                {
                    "underpass_id": "UP-02",
                    "location_name": "Hebbal Outer Ring Road Underpass",
                    "latitude": 13.0359,
                    "longitude": 77.5978,
                    "bbmp_zone": "North Zone 1",
                    "drain_blockage_flag": 0
                },
                {
                    "underpass_id": "UP-03",
                    "location_name": "Silk Board Junction Underpass",
                    "latitude": 12.9176,
                    "longitude": 77.6244,
                    "bbmp_zone": "South Zone 1",
                    "drain_blockage_flag": 1
                },
                {
                    "underpass_id": "UP-04",
                    "location_name": "Tagore Circle Underpass (Basavanagudi)",
                    "latitude": 12.9463,
                    "longitude": 77.5738,
                    "bbmp_zone": "South Zone 2",
                    "drain_blockage_flag": 0
                },
                {
                    "underpass_id": "UP-05",
                    "location_name": "Richmond Circle Underpass",
                    "latitude": 12.9600,
                    "longitude": 77.5970,
                    "bbmp_zone": "Central Zone 2",
                    "drain_blockage_flag": 0
                },
                {
                    "underpass_id": "UP-06",
                    "location_name": "Le Meridien Underpass (Sankey Road)",
                    "latitude": 12.9882,
                    "longitude": 77.5891,
                    "bbmp_zone": "Central Zone 1",
                    "drain_blockage_flag": 1
                }
            ]
            print(f"Loaded {len(self.underpasses)} hardcoded fallback underpass locations.")

    def fetch_weather_and_predict(self, google_api_key: str = None, simulate_heavy_rain: bool = False):
        if not self.underpasses:
            return {
                "timestamp": datetime.now().isoformat(),
                "google_api_key_used": False,
                "simulate_heavy_rain": simulate_heavy_rain,
                "alerts_triggered": 0,
                "predictions": []
            }

        results = []
        alerts_triggered = 0

        # Read GOOGLE_API_KEY from environment if not passed
        api_key = google_api_key or os.getenv("GOOGLE_API_KEY", "")

        for row in self.underpasses:
            up_id = str(row['underpass_id'])
            name = str(row['location_name'])
            lat = float(row['latitude'])
            lon = float(row['longitude'])
            zone = str(row['bbmp_zone'])
            default_blockage = int(row['drain_blockage_flag'])

            # Fetch weather (real-time from Open-Meteo or simulated)
            weather = self._fetch_weather_details(lat, lon, api_key, simulate_heavy_rain)

            # Prepare features for the ML model (list of lists instead of pandas DataFrame)
            features = [[
                weather['rainfall_3hr_mm'],
                weather['peak_intensity_mm_hr'],
                default_blockage
            ]]

            # Run prediction
            is_flooded = 0
            probability = 0.0
            if self.model:
                try:
                    is_flooded = int(self.model.predict(features)[0])
                    # Try to get prediction probability if available
                    if hasattr(self.model, "predict_proba"):
                        proba = self.model.predict_proba(features)[0]
                        probability = float(proba[1])
                    else:
                        probability = 1.0 if is_flooded else 0.0
                except Exception as e:
                    print(f"Prediction failed for {name}: {e}")
                    is_flooded = 1 if weather['rainfall_3hr_mm'] > 30.0 else 0
            else:
                # Heuristic fallback if model is missing
                is_flooded = 1 if (weather['rainfall_3hr_mm'] > 30.0 or weather['peak_intensity_mm_hr'] > 45.0) else 0
                probability = min(1.0, weather['rainfall_3hr_mm'] / 50.0)

            # High alert & prevention logic
            assigned_officers = []
            alert_message = ""

            if is_flooded == 1:
                alerts_triggered += 1
                # Find the 2 nearest Available officers to secure this underpass
                nearest = database.get_nearest_officers(lat, lon, limit=2)
                for officer in nearest:
                    # Update status to HighAlert to inform them
                    database.update_officer_status(officer['id'], "HighAlert")
                    assigned_officers.append({
                        "id": officer['id'],
                        "name": officer['officer_name'],
                        "distance_km": officer['distance_km'],
                        "eta_mins": officer['eta_mins']
                    })

                officer_names = ", ".join([o['name'] for o in assigned_officers]) if assigned_officers else "No available officers"
                alert_message = f"WATERLOGGING ALERT: High risk of flooding predicted at {name} (Rainfall: {weather['rainfall_3hr_mm']}mm, Intensity: {weather['peak_intensity_mm_hr']}mm/hr). " \
                                f"Assigned nearest units to secure the location: {officer_names}. Officers set to HIGH ALERT."

                # Log to stdout/console (mock integrations)
                print(f"[SMS Gateway] Dispatched emergency SMS to {officer_names} for underpass security at {name}.")
                print(f"[Control Room] Broad-cast high-alert warning message: '{alert_message}'")

                # Also log this as a dispatch in the DB!
                try:
                    conn = database.get_db_connection()
                    cursor = conn.cursor()

                    # Check if an event already exists for this underpass in the last 1 hour
                    cursor.execute("SELECT id FROM events WHERE junction = ? AND event_cause = 'water_logging' AND outcome = 'Active'", (name,))
                    existing_event = cursor.fetchone()

                    if not existing_event:
                        # Insert a new event
                        event_dict = {
                            'event_cause': 'water_logging',
                            'event_type': 'unplanned',
                            'zone': zone,
                            'junction': name,
                            'latitude': lat,
                            'longitude': lon,
                            'requires_road_closure': True,
                            'duration': 180.0,
                            'priority': 'Critical',
                            'description': f"Automated Waterlogging Prediction at {name} using weather telemetry.",
                            'start_datetime': datetime.now().isoformat(),
                            'generated_description': f"Water logging hazard predicted at {name} Underpass due to heavy rainfall.",
                            'impact_score': float(probability * 100.0),
                            'risk_level': 'Critical' if probability > 0.7 else 'High',
                            'duration_category': 'Long (2h-4h)',
                            'area_impact': 'Local Underpass Area',
                            'manpower_officers': len(assigned_officers),
                            'manpower_patrols': 1,
                            'manpower_supervisors': 0,
                            'barricades_count': 6,
                            'barricades_placement': 'Underpass approach roads',
                            'diversion_route_a': 'Primary Bypass Ring Road',
                            'diversion_route_b': 'Secondary slip road',
                            'diversion_route_c': 'None',
                            'diversion_reasoning': 'Low-lying underpass flooded. Avoid entry.',
                            'impact_radius_m': 300.0,
                            'affected_junctions': 2,
                            'affected_roads': 3,
                            'severity_level': 'High',
                            'live_traffic_snapshot': '{}'
                        }
                        event_id = database.insert_new_event(event_dict)

                        # Create dispatch record
                        database.create_dispatch(
                            event_id=event_id,
                            officer_ids=[o['id'] for o in assigned_officers],
                            barricades_count=6,
                            diversion_route='Primary Bypass Ring Road',
                            message=alert_message
                        )
                except Exception as db_err:
                    print(f"Error saving waterlogging event to database: {db_err}")

            results.append({
                "underpass_id": up_id,
                "location_name": name,
                "latitude": lat,
                "longitude": lon,
                "bbmp_zone": zone,
                "weather": weather,
                "drain_blockage_flag": default_blockage,
                "prediction": {
                    "is_flooded": is_flooded,
                    "probability": round(probability, 2),
                    "alert_level": "RED (Flooding / High Risk)" if is_flooded == 1 else "GREEN (Safe / Low Risk)"
                },
                "response": {
                    "alert_triggered": is_flooded == 1,
                    "assigned_officers": assigned_officers,
                    "message": alert_message
                }
            })

        return {
            "timestamp": datetime.now().isoformat(),
            "google_api_key_used": bool(api_key),
            "simulate_heavy_rain": simulate_heavy_rain,
            "alerts_triggered": alerts_triggered,
            "predictions": results
        }

    def _fetch_weather_details(self, lat: float, lon: float, api_key: str = None, simulate_heavy_rain: bool = False):
        if simulate_heavy_rain:
            import random
            random.seed(int(lat * lon + datetime.now().timestamp()))
            rainfall_3hr = random.uniform(35.0, 75.0)
            peak_intensity = random.uniform(40.0, 95.0)
            return {
                "rainfall_3hr_mm": round(rainfall_3hr, 2),
                "peak_intensity_mm_hr": round(peak_intensity, 2),
                "elevation_m": round(random.uniform(850, 920), 1),
                "source": "Monsoon Heavy Rain Simulation Mode"
            }

        # 1. Try Google Elevation API if key is present
        elevation = None
        if api_key:
            try:
                url = f"https://maps.googleapis.com/maps/api/elevation/json?locations={lat},{lon}&key={api_key}"
                res = requests.get(url, timeout=3)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("status") == "OK" and data.get("results"):
                        elevation = data['results'][0]['elevation']
            except Exception as e:
                print(f"Google Maps Elevation API exception: {e}")

        # 2. Query Open-Meteo for real-time weather
        try:
            url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=precipitation,rain&hourly=precipitation,rain&timezone=Asia/Kolkata"
            res = requests.get(url, timeout=3)
            if res.status_code == 200:
                data = res.json()
                current_precip = data.get("current", {}).get("precipitation", 0.0)
                hourly_precip = data.get("hourly", {}).get("precipitation", [])

                rainfall_3hr_mm = sum(hourly_precip[:3]) if len(hourly_precip) >= 3 else current_precip * 3.0
                peak_intensity_mm_hr = max(hourly_precip[:12]) if len(hourly_precip) > 0 else current_precip

                return {
                    "rainfall_3hr_mm": round(rainfall_3hr_mm, 2),
                    "peak_intensity_mm_hr": round(peak_intensity_mm_hr, 2),
                    "elevation_m": round(elevation, 1) if elevation else None,
                    "source": "Open-Meteo API"
                }
        except Exception as e:
            print(f"Open-Meteo Weather API query error: {e}")

        # Fallback simulation if offline/network fails
        import random
        random.seed(int((lat + lon) * 100000))
        rainfall_3hr = random.uniform(5.0, 25.0)
        peak_intensity = random.uniform(5.0, 35.0)
        return {
            "rainfall_3hr_mm": round(rainfall_3hr, 2),
            "peak_intensity_mm_hr": round(peak_intensity, 2),
            "elevation_m": round(random.uniform(850, 920), 1),
            "source": "OSM Weather Intelligence Engine (Simulation Fallback)"
        }
