
import os
import joblib
import numpy as np
import pandas as pd

from flask import Flask, request, jsonify

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "data", "electricity_model.pkl")

model = joblib.load(MODEL_PATH)

CLIMATE_FEATURES = [
    "2m_temperature_mean",
    "2m_temperature_max",
    "2m_temperature_min",
    "2m_dewpoint_temperature_mean",
    "2m_dewpoint_temperature_max",
    "2m_dewpoint_temperature_min",
    "surface_solar_radiation_downwards_mean",
    "surface_solar_radiation_downwards_max",
    "surface_solar_radiation_downwards_min",
    "total_cloud_cover_mean",
    "total_cloud_cover_max",
    "total_cloud_cover_min",
]

HISTORY_FEATURES = [
    "Consumption_Lag_1",
    "Consumption_Lag_7",
    "Consumption_Rolling_Mean_7",
]

DATE_FEATURES = [
    "Month_Sin",
    "Month_Cos",
    "DayOfYear_Sin",
    "DayOfYear_Cos",
    "DayOfWeek_Sin",
    "DayOfWeek_Cos",
]


# Allow requests from your React frontend
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "running",
        "model_loaded": True
    })


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Send a valid JSON object."}), 400

    required = [
        "state",
        "date",
        *CLIMATE_FEATURES,
        *HISTORY_FEATURES,
    ]

    missing = [
        field for field in required
        if field not in data or data[field] is None
    ]

    if missing:
        return jsonify({
            "error": "Required fields are missing.",
            "missing_fields": missing
        }), 400

    try:
        prediction_date = pd.to_datetime(
            data["date"], errors="raise"
        )

        if pd.isna(prediction_date):
            raise ValueError("Invalid date")

        numeric_features = CLIMATE_FEATURES + HISTORY_FEATURES

        values = {
            field: float(data[field])
            for field in numeric_features
        }

        if not np.isfinite(list(values.values())).all():
            raise ValueError("Feature values must be finite numbers.")

        month = prediction_date.month
        day_of_year = prediction_date.dayofyear
        day_of_week = prediction_date.dayofweek

        features = {
            "State": str(data["state"]),
            **values,
            "Month_Sin": np.sin(2 * np.pi * month / 12),
            "Month_Cos": np.cos(2 * np.pi * month / 12),
            "DayOfYear_Sin": np.sin(
                2 * np.pi * day_of_year / 365.25
            ),
            "DayOfYear_Cos": np.cos(
                2 * np.pi * day_of_year / 365.25
            ),
            "DayOfWeek_Sin": np.sin(
                2 * np.pi * day_of_week / 7
            ),
            "DayOfWeek_Cos": np.cos(
                2 * np.pi * day_of_week / 7
            ),
        }

        input_df = pd.DataFrame([features])
        prediction = float(model.predict(input_df)[0])

        return jsonify({
            "state": data["state"],
            "date": prediction_date.strftime("%Y-%m-%d"),
            "predicted_consumption": round(prediction, 3)
        })

    except (ValueError, TypeError) as error:
        return jsonify({
            "error": f"Invalid input: {str(error)}"
        }), 400

    except Exception as error:
        app.logger.exception("Prediction failed")
        return jsonify({
            "error": "Prediction failed. Check the server logs."
        }), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
