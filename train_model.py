import os
import joblib
import pandas as pd
import numpy as np

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

# India ke sirf 28 states; Union Territories exclude honge.
INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
    "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
    "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
    "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
]

# 1. Load dataset
file_path = "Backend/data/merged_climate_electricity.csv"
output_dir = "Backend/data"
os.makedirs(output_dir, exist_ok=True)

print("Loading dataset...")
df = pd.read_csv(file_path, parse_dates=["Date"])

# 2. Clean data and filter to the 28 states BEFORE creating lag features.
df = df.dropna(subset=["Date", "State", "Consumption"]).copy()
df["State"] = df["State"].astype(str).str.strip()
df["Consumption"] = pd.to_numeric(df["Consumption"], errors="coerce")
df = df.dropna(subset=["Consumption"])

available_states = set(df["State"].unique())
missing_states = sorted(set(INDIAN_STATES) - available_states)
unexpected_states = sorted(available_states - set(INDIAN_STATES))
df = df[df["State"].isin(INDIAN_STATES)].copy()

print("States included:", df["State"].nunique())
print("Included state names:", ", ".join(sorted(df["State"].unique())))
if missing_states:
    print("WARNING - expected states absent from dataset:", ", ".join(missing_states))
if unexpected_states:
    print("Excluded non-state entries (including UTs if present):", ", ".join(unexpected_states))
if df["State"].nunique() == 0:
    raise ValueError("No state names matched the 28-state list. Check State column spellings.")

negative_count = int((df["Consumption"] < 0).sum())
print("Negative consumption records:", negative_count)
if negative_count:
    print("WARNING: negative values retained; verify them against source data.")

# Remove ambiguous duplicate Date-State records.
duplicate_mask = df.duplicated(subset=["Date", "State"], keep=False)
if duplicate_mask.any():
    print("Warning: ambiguous duplicate Date-State records:", int(duplicate_mask.sum()))
    print("Removing these ambiguous records from modeling.")
    df = df.loc[~duplicate_mask].copy()

df = df.sort_values(["State", "Date"]).reset_index(drop=True)

# 3. Climate features
climate_features = [
    "2m_temperature_mean", "2m_temperature_max", "2m_temperature_min",
    "2m_dewpoint_temperature_mean", "2m_dewpoint_temperature_max",
    "2m_dewpoint_temperature_min",
    "surface_solar_radiation_downwards_mean",
    "surface_solar_radiation_downwards_max",
    "surface_solar_radiation_downwards_min",
    "total_cloud_cover_mean", "total_cloud_cover_max", "total_cloud_cover_min",
]
required_columns = ["Date", "State", "Consumption"] + climate_features
missing_columns = [col for col in required_columns if col not in df.columns]
if missing_columns:
    raise ValueError(f"Missing columns in dataset: {missing_columns}")

# 4. Historical consumption features (separate for each state)
grouped_consumption = df.groupby("State")["Consumption"]
df["Consumption_Lag_1"] = grouped_consumption.shift(1)
df["Consumption_Lag_7"] = grouped_consumption.shift(7)
df["Consumption_Rolling_Mean_7"] = (
    df.groupby("State")["Consumption"]
    .transform(lambda s: s.shift(1).rolling(window=7, min_periods=7).mean())
)

# 5. Date features
df["Month"] = df["Date"].dt.month
df["DayOfWeek"] = df["Date"].dt.dayofweek
df["DayOfYear"] = df["Date"].dt.dayofyear
df["Month_Sin"] = np.sin(2 * np.pi * df["Month"] / 12)
df["Month_Cos"] = np.cos(2 * np.pi * df["Month"] / 12)
df["DayOfYear_Sin"] = np.sin(2 * np.pi * df["DayOfYear"] / 365.25)
df["DayOfYear_Cos"] = np.cos(2 * np.pi * df["DayOfYear"] / 365.25)
df["DayOfWeek_Sin"] = np.sin(2 * np.pi * df["DayOfWeek"] / 7)
df["DayOfWeek_Cos"] = np.cos(2 * np.pi * df["DayOfWeek"] / 7)

lag_features = [
    "Consumption_Lag_1", "Consumption_Lag_7", "Consumption_Rolling_Mean_7"
]
date_features = [
    "Month_Sin", "Month_Cos", "DayOfYear_Sin", "DayOfYear_Cos",
    "DayOfWeek_Sin", "DayOfWeek_Cos"
]
features = ["State"] + climate_features + lag_features + date_features
target = "Consumption"

df = df.dropna(subset=features + [target]).copy()
if df["State"].nunique() != 28:
    print("WARNING: after cleaning, modeling data contains", df["State"].nunique(),
          "states, not all 28. Check source data coverage.")

# 6. Chronological train/test split
unique_dates = np.sort(df["Date"].unique())
if len(unique_dates) < 2:
    raise ValueError("Not enough unique dates for chronological train/test split.")
split_index = int(len(unique_dates) * 0.8)
split_index = min(max(split_index, 1), len(unique_dates) - 1)
split_date = pd.Timestamp(unique_dates[split_index])

train_df = df[df["Date"] < split_date].copy()
test_df = df[df["Date"] >= split_date].copy()
if train_df.empty or test_df.empty:
    raise ValueError("Training or test set is empty; check date coverage.")

X_train, y_train = train_df[features], train_df[target]
X_test, y_test = test_df[features], test_df[target]

print("\nTraining records:", len(X_train))
print("Testing records:", len(X_test))
print("Training states:", train_df["State"].nunique())
print("Testing states:", test_df["State"].nunique())
print("Training ends before:", split_date.date())
print("Testing starts from:", test_df["Date"].min().date())

# 7. Preprocessing
preprocessor = ColumnTransformer(transformers=[
    ("state", OneHotEncoder(handle_unknown="ignore"), ["State"]),
    ("numeric", "passthrough", climate_features + lag_features + date_features),
])

# 8. Model
model = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("regressor", RandomForestRegressor(
        n_estimators=100, max_depth=16, min_samples_leaf=3,
        random_state=42, n_jobs=2
    )),
])

# 9. Train
print("\nTraining Random Forest on the 28-state dataset...")
model.fit(X_train, y_train)
print("Training completed!")

# 10. Predict
predictions = model.predict(X_test)

# 11. Evaluate
mae = mean_absolute_error(y_test, predictions)
rmse = np.sqrt(mean_squared_error(y_test, predictions))
print("\n========== 28-STATE MODEL RESULTS ==========")
print(f"MAE:  {mae:.3f}")
print(f"RMSE: {rmse:.3f}")

baseline_predictions = test_df["Consumption_Lag_1"]
baseline_mae = mean_absolute_error(y_test, baseline_predictions)
baseline_rmse = np.sqrt(mean_squared_error(y_test, baseline_predictions))
print("\n========== BASELINE RESULTS ==========")
print(f"Baseline MAE:  {baseline_mae:.3f}")
print(f"Baseline RMSE: {baseline_rmse:.3f}")

# 12. Save predictions
results = pd.DataFrame({
    "Date": test_df["Date"].values,
    "State": test_df["State"].values,
    "Actual": y_test.values,
    "Predicted": predictions,
    "Previous_Consumption": baseline_predictions.values,
})
results["Absolute_Error"] = (results["Actual"] - results["Predicted"]).abs()
print("\nFirst 10 predictions:")
print(results.head(10).round(2).to_string(index=False))
results.to_csv(os.path.join(output_dir, "model_predictions.csv"), index=False)

# 13. State-wise evaluation
state_performance = results.groupby("State").agg(
    MAE=("Absolute_Error", "mean"),
    Actual_Mean=("Actual", "mean"),
    Predicted_Mean=("Predicted", "mean"),
    Records=("Actual", "count"),
).sort_values("MAE", ascending=False)
print("\n========== STATE-WISE PERFORMANCE ==========")
print(state_performance.round(2).to_string())
state_performance.to_csv(os.path.join(output_dir, "state_model_performance.csv"))

# 14. Save model and feature list
joblib.dump(model, os.path.join(output_dir, "electricity_model.pkl"))
joblib.dump(features, os.path.join(output_dir, "model_feature_names.pkl"))

print("\nState-wise performance saved.")
print("Predictions saved to Backend/data/model_predictions.csv")
print("Model saved to Backend/data/electricity_model.pkl")
print("\nAll tasks completed!")
