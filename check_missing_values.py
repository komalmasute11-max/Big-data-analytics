
from pathlib import Path
import pandas as pd

# 1. File paths
BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "backend" / "data" / "merged_climate_electricity.csv"
REPORT_DIR = BASE_DIR / "backend" / "data" / "missing_value_reports"

REPORT_DIR.mkdir(parents=True, exist_ok=True)

# 2. Load merged dataset
df = pd.read_csv(DATA_FILE, parse_dates=["Date"])

print("\n========== DATASET INFORMATION ==========")
print("Total rows:", len(df))
print("Total columns:", len(df.columns))
print("States/regions:", df["State"].nunique())
print("Date range:", df["Date"].min(), "to", df["Date"].max())

# 3. Check missing values in each column
print("\n========== MISSING VALUES BY COLUMN ==========")

missing_by_column = df.isna().sum().reset_index()
missing_by_column.columns = ["Column", "Missing_Count"]
missing_by_column["Missing_Percentage"] = (
    missing_by_column["Missing_Count"] / len(df) * 100
).round(2)

missing_by_column = missing_by_column.sort_values(
    "Missing_Count", ascending=False
)

print(missing_by_column.to_string(index=False))

missing_by_column.to_csv(
    REPORT_DIR / "missing_by_column.csv", index=False
)

# 4. Identify climate columns
excluded_columns = {"Date", "State", "Consumption"}

climate_columns = [
    col for col in df.columns
    if col not in excluded_columns
]

# 5. Check missing values state-wise
print("\n========== MISSING VALUES BY STATE ==========")

missing_by_state = (
    df.groupby("State")[climate_columns]
    .apply(lambda group: group.isna().sum())
)

missing_by_state["Total_Missing"] = missing_by_state.sum(axis=1)
missing_by_state = missing_by_state.sort_values(
    "Total_Missing", ascending=False
)

print(missing_by_state.to_string())

missing_by_state.to_csv(
    REPORT_DIR / "missing_by_state.csv"
)

# 6. Find exact dates and columns with missing values
print("\n========== MISSING VALUES BY DATE AND STATE ==========")

missing_records = df[
    ["Date", "State"] + climate_columns
].melt(
    id_vars=["Date", "State"],
    var_name="Climate_Column",
    value_name="Value"
)

missing_records = missing_records[
    missing_records["Value"].isna()
].copy()

missing_records = missing_records[
    ["Date", "State", "Climate_Column"]
].sort_values(["State", "Date", "Climate_Column"])

print("Total missing climate cells:", len(missing_records))
print("\nFirst 20 missing records:")
print(missing_records.head(20).to_string(index=False))

missing_records.to_csv(
    REPORT_DIR / "missing_by_date_state.csv",
    index=False
)

# 7. Count missing dates for each state and climate column
missing_counts = (
    missing_records.groupby(["State", "Climate_Column"])
    .size()
    .reset_index(name="Missing_Count")
    .sort_values(
        ["Missing_Count", "State"],
        ascending=[False, True]
    )
)

missing_counts.to_csv(
    REPORT_DIR / "missing_counts_by_state_column.csv",
    index=False
)

# 8. Check rows that have at least one missing climate value
rows_with_missing = df[
    df[climate_columns].isna().any(axis=1)
].copy()

print("\n========== FINAL SUMMARY ==========")
print("Rows with at least one missing climate value:",
      len(rows_with_missing))
print("Rows without missing climate values:",
      len(df) - len(rows_with_missing))

print("\nReports saved in:")
print(REPORT_DIR)

print("\nGenerated files:")
print("1. missing_by_column.csv")
print("2. missing_by_state.csv")
print("3. missing_by_date_state.csv")
print("4. missing_counts_by_state_column.csv")

print("\nMissing-value check completed!")
