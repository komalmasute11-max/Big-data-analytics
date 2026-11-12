
from pathlib import Path
import pandas as pd

# =========================================================
# 1. FILE PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

PUBLIC_DIR = BASE_DIR / "public"
BACKEND_DATA_DIR = BASE_DIR / "backend" / "data"

ELECTRICITY_FILE = (
    BACKEND_DATA_DIR / "corrected_daily_energy_met_MU_2014_2024 (1).csv"
)

OUTPUT_FILE = BACKEND_DATA_DIR / "merged_climate_electricity.csv"
CONFLICT_FILE = BACKEND_DATA_DIR / "electricity_conflicts_to_review.csv"

BACKEND_DATA_DIR.mkdir(parents=True, exist_ok=True)


# =========================================================
# 2. LOAD AND CLEAN ELECTRICITY DATA
# =========================================================

print("\n========== ELECTRICITY DATA ==========")

if not ELECTRICITY_FILE.exists():
    raise FileNotFoundError(
        f"Electricity file not found:\n{ELECTRICITY_FILE}"
    )

electricity = pd.read_csv(ELECTRICITY_FILE)

# Clean column names and remove duplicate column names
electricity.columns = electricity.columns.astype(str).str.strip()
electricity = electricity.loc[
    :, ~electricity.columns.duplicated()
].copy()

if "Date" not in electricity.columns:
    raise ValueError(
        "Column 'Date' not found in electricity CSV."
    )

# Parse dates
electricity["Date"] = pd.to_datetime(
    electricity["Date"], errors="coerce"
).dt.normalize()

invalid_dates = electricity["Date"].isna().sum()
electricity = electricity.dropna(subset=["Date"]).copy()

print("Invalid date rows removed:", invalid_dates)

# Remove exact duplicate rows
before = len(electricity)
electricity = electricity.drop_duplicates().copy()

print("Exact duplicate rows removed:", before - len(electricity))
print("Electricity rows after deduplication:", len(electricity))

# Exclude non-state consumption columns
excluded_columns = {
    "Date",
    "Total",
    "AMNSIL",
    "Damodar Valley Corporation",
}

state_columns = [
    col for col in electricity.columns
    if col not in excluded_columns
]

if not state_columns:
    raise ValueError("No state-wise electricity columns were found.")

print("State/region columns found:", len(state_columns))

# Convert wide format to long format
electricity_long = electricity.melt(
    id_vars=["Date"],
    value_vars=state_columns,
    var_name="State",
    value_name="Consumption",
)

electricity_long["State"] = (
    electricity_long["State"].astype(str).str.strip()
)

electricity_long["Consumption"] = pd.to_numeric(
    electricity_long["Consumption"], errors="coerce"
)

# Remove missing electricity consumption values
missing_consumption = electricity_long["Consumption"].isna().sum()

electricity_long = electricity_long.dropna(
    subset=["Consumption"]
).copy()

print("Missing consumption records removed:", missing_consumption)

# Remove exact duplicate Date-State-Consumption records
electricity_long = electricity_long.drop_duplicates(
    subset=["Date", "State", "Consumption"]
).copy()


# =========================================================
# 3. FIND CONFLICTING ELECTRICITY RECORDS
# =========================================================

value_counts = electricity_long.groupby(
    ["Date", "State"]
)["Consumption"].nunique()

conflicting_keys = value_counts[value_counts > 1].index

if len(conflicting_keys) > 0:
    conflict_mask = pd.MultiIndex.from_frame(
        electricity_long[["Date", "State"]]
    ).isin(conflicting_keys)

    conflicts = electricity_long.loc[conflict_mask].copy()
    conflicts = conflicts.sort_values(["Date", "State"])

    conflicts.to_csv(CONFLICT_FILE, index=False)

    print("\nWARNING: Conflicting electricity records found.")
    print("Conflicting Date-State combinations:", len(conflicting_keys))
    print("Conflict report saved to:", CONFLICT_FILE)
    print("\nSample conflicts:")
    print(conflicts.head(10).to_string(index=False))

    # Exclude ambiguous Date-State combinations without guessing values
    electricity_long = electricity_long.loc[
        ~conflict_mask
    ].copy()

    print(
        "Ambiguous Date-State combinations excluded:",
        len(conflicting_keys),
    )

else:
    print("No conflicting electricity records found.")

    if CONFLICT_FILE.exists():
        CONFLICT_FILE.unlink()

# Verify unique Date-State keys
if electricity_long.duplicated(["Date", "State"]).any():
    raise ValueError(
        "Electricity data still contains duplicate Date-State keys."
    )

print("Valid electricity records:", len(electricity_long))
print(
    "Electricity date range:",
    electricity_long["Date"].min(),
    "to",
    electricity_long["Date"].max(),
)


# =========================================================
# 4. LOAD CLIMATE DATA
# =========================================================

print("\n========== CLIMATE DATA ==========")

if not PUBLIC_DIR.exists():
    raise FileNotFoundError(
        f"Public folder not found:\n{PUBLIC_DIR}"
    )

# UTCI columns are excluded because of the continuous missing-data gap.
weather_columns = [
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

climate_frames = []
climate_files_used = 0

for file_path in sorted(PUBLIC_DIR.glob("*.csv")):

    try:
        climate = pd.read_csv(file_path)
    except Exception as error:
        print(f"Skipping unreadable file {file_path.name}: {error}")
        continue

    climate.columns = climate.columns.astype(str).str.strip()

    # Find the Date column, regardless of capitalization
    date_column = next(
        (
            col for col in climate.columns
            if col.lower() == "date"
        ),
        None,
    )

    # Skip files without a Date column
    if date_column is None:
        continue

    available_weather_columns = [
        col for col in weather_columns
        if col in climate.columns
    ]

    if not available_weather_columns:
        continue

    # Parse dates
    climate = climate.rename(columns={date_column: "Date"})

    climate["Date"] = pd.to_datetime(
        climate["Date"], errors="coerce"
    ).dt.normalize()

    climate = climate.dropna(subset=["Date"]).copy()

    # State name comes from the filename
    climate["State"] = file_path.stem.strip()

    # Keep only required columns
    climate = climate[
        ["Date", "State"] + available_weather_columns
    ].copy()

    # Convert climate columns to numeric
    for col in available_weather_columns:
        climate[col] = pd.to_numeric(
            climate[col], errors="coerce"
        )

    # Convert temperature and dewpoint values from Kelvin to Celsius
    temperature_columns = [
        col for col in available_weather_columns
        if (
            "temperature" in col.lower()
            or "dewpoint_temperature" in col.lower()
        )
    ]

    for col in temperature_columns:
        valid_values = climate[col].dropna()

        if not valid_values.empty and valid_values.median() > 100:
            climate[col] = climate[col] - 273.15
            print(
                f"Converted Kelvin to Celsius: "
                f"{file_path.name} - {col}"
            )

    # Check duplicate Date-State records within each file
    duplicate_climate = climate.duplicated(
        subset=["Date", "State"], keep=False
    )

    if duplicate_climate.any():
        print(f"\nDuplicate climate records in {file_path.name}:")
        print(
            climate.loc[duplicate_climate]
            .sort_values(["Date", "State"])
            .head(10)
            .to_string(index=False)
        )

        raise ValueError(
            f"Duplicate Date-State records found in {file_path.name}. "
            "Resolve these before merging."
        )

    climate_frames.append(climate)
    climate_files_used += 1

    print(f"Loaded {file_path.name}: {len(climate)} records")

if not climate_frames:
    raise ValueError(
        "No climate CSV files were loaded. "
        "Check the public folder and climate column names."
    )

climate_data = pd.concat(
    climate_frames, ignore_index=True
)

# Check duplicate keys across all climate files
duplicate_climate = climate_data.duplicated(
    subset=["Date", "State"], keep=False
)

if duplicate_climate.any():
    print("\nDuplicate climate keys across files:")
    print(
        climate_data.loc[duplicate_climate]
        .sort_values(["Date", "State"])
        .head(20)
        .to_string(index=False)
    )

    raise ValueError(
        "Duplicate Date-State records exist across climate files. "
        "Check the filenames and state names."
    )

print("\nClimate files loaded:", climate_files_used)
print("Climate records before cleaning:", len(climate_data))
print(
    "Climate date range:",
    climate_data["Date"].min(),
    "to",
    climate_data["Date"].max(),
)


# =========================================================
# 5. CLEAN MISSING CLIMATE VALUES
# =========================================================

print("\n========== CLEANING CLIMATE DATA ==========")

climate_feature_columns = [
    col for col in climate_data.columns
    if col not in ["Date", "State"]
]

# Count missing values before cleaning
print("\nMissing climate values before cleaning:")
print(climate_data[climate_feature_columns].isna().sum().to_string())

rows_before_cleaning = len(climate_data)

# Remove records with missing values in any retained climate feature.
# No climate values are invented or interpolated.
climate_data = climate_data.dropna(
    subset=climate_feature_columns
).copy()

rows_removed = rows_before_cleaning - len(climate_data)

print("\nClimate rows before cleaning:", rows_before_cleaning)
print("Climate rows removed:", rows_removed)
print("Climate rows after cleaning:", len(climate_data))

print("\nMissing climate values after cleaning:")
print(climate_data[climate_feature_columns].isna().sum().to_string())

if climate_data.empty:
    raise ValueError(
        "No complete climate records remain after cleaning."
    )


# =========================================================
# 6. CHECK STATE NAMES
# =========================================================

print("\n========== STATE NAME CHECK ==========")

electricity_states = set(electricity_long["State"].unique())
climate_states = set(climate_data["State"].unique())

electricity_only = sorted(electricity_states - climate_states)
climate_only = sorted(climate_states - electricity_states)

print("States/regions in electricity but not climate:")
print(electricity_only)

print("\nStates/regions in climate but not electricity:")
print(climate_only)


# =========================================================
# 7. MERGE ELECTRICITY AND CLIMATE DATA
# =========================================================

print("\n========== MERGING DATA ==========")

merged_data = pd.merge(
    electricity_long,
    climate_data,
    on=["Date", "State"],
    how="inner",
    validate="one_to_one",
)

if merged_data.empty:
    raise ValueError(
        "The merged dataset is empty. "
        "Check date overlap and state-name mismatches."
    )

merged_data = merged_data.sort_values(
    ["State", "Date"]
).reset_index(drop=True)

# Verify final merge keys
if merged_data.duplicated(["Date", "State"]).any():
    raise ValueError(
        "The final dataset contains duplicate Date-State records."
    )

# Save merged dataset
merged_data.to_csv(OUTPUT_FILE, index=False)


# =========================================================
# 8. FINAL SUMMARY
# =========================================================

print("\n========== FINAL SUMMARY ==========")

print("Electricity records available:", len(electricity_long))
print("Climate records available after cleaning:", len(climate_data))
print("Merged records:", len(merged_data))
print("States/regions in merged dataset:", merged_data["State"].nunique())

print(
    "Merged date range:",
    merged_data["Date"].min(),
    "to",
    merged_data["Date"].max(),
)

print("\nMissing values in merged dataset:")
print(merged_data.isna().sum().to_string())

print("\nFirst 10 merged records:")
print(merged_data.head(10).to_string(index=False))

print("\nMerged dataset saved successfully:")
print(OUTPUT_FILE)

if CONFLICT_FILE.exists():
    print("\nPlease review conflicting electricity records here:")
    print(CONFLICT_FILE)
