import { useEffect, useState } from "react";
import Papa from "papaparse";

function RandomForestLivePrediction() {
  const [data, setData] = useState([]);
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState("Punjab");
  const [selectedDate, setSelectedDate] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Papa.parse("/merged_climate_electricity.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data
          .filter((row) => row.State && row.Date && row.Consumption)
          .map((row) => ({
            ...row,
            Date: row.Date.slice(0, 10),
            Consumption: Number(row.Consumption),
          }))
          .filter(
            (row) =>
              Number.isFinite(row.Consumption) &&
              row.Date &&
              !Number.isNaN(Date.parse(row.Date))
          );

        rows.sort(
          (a, b) =>
            a.State.localeCompare(b.State) ||
            a.Date.localeCompare(b.Date)
        );

        setData(rows);

        const uniqueStates = [...new Set(rows.map((row) => row.State))];
        setStates(uniqueStates);

        if (uniqueStates.includes("Punjab")) {
          setSelectedState("Punjab");
        } else if (uniqueStates.length > 0) {
          setSelectedState(uniqueStates[0]);
        }
      },
      error: () => setError("CSV file load nahi ho payi."),
    });
  }, []);

  const stateRows = data.filter(
    (row) => row.State === selectedState
  );

  const validRows = stateRows.filter((row, index) => {
    if (index < 7) return false;

    const currentDate = new Date(row.Date + "T00:00:00");
    const previousDate = new Date(stateRows[index - 1].Date + "T00:00:00");

    const difference =
      (currentDate - previousDate) / (1000 * 60 * 60 * 24);

    return difference === 1;
  });

  useEffect(() => {
    if (validRows.length > 0) {
      setSelectedDate(validRows[validRows.length - 1].Date);
    } else {
      setSelectedDate("");
    }

    setPrediction(null);
    setError("");
  }, [selectedState, data.length]);

  async function handlePredict() {
    setLoading(true);
    setPrediction(null);
    setError("");

    try {
      const index = stateRows.findIndex(
        (row) => row.Date === selectedDate
      );

      if (index < 7) {
        throw new Error(
          "Selected date ke liye 7 previous records available nahi hain."
        );
      }

      const current = stateRows[index];
      const previousSeven = stateRows.slice(index - 7, index);

      const climateFeatures = [
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
      ];

      const payload = {
        state: current.State,
        date: current.Date,
        Consumption_Lag_1: Number(previousSeven[6].Consumption),
        Consumption_Lag_7: Number(previousSeven[0].Consumption),
        Consumption_Rolling_Mean_7:
          previousSeven.reduce(
            (sum, row) => sum + row.Consumption,
            0
          ) / 7,
      };

      for (const feature of climateFeatures) {
        const value = Number(current[feature]);

        if (
          current[feature] === "" ||
          current[feature] == null ||
          !Number.isFinite(value)
        ) {
          throw new Error(`Climate data missing hai: ${feature}`);
        }

        payload[feature] = value;
      }

      const response = await fetch(
        "http://127.0.0.1:5001/predict",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Prediction failed.");
      }

      setPrediction(result.predicted_consumption);
    } catch (err) {
      setError(err.message || "Kuch error aa gaya.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: "#0d1524",
        border: "1px solid #1c293c",
        borderRadius: "12px",
        padding: "24px",
        margin: "24px 0",
        color: "#e5e7eb",
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        Random Forest Electricity Prediction
      </h2>

      <p style={{ color: "#9ca3af" }}>
        Select a state and historical date to test the trained model
        using recorded climate data and previous electricity consumption.
      </p>

      {data.length === 0 && !error && (
        <p>Loading dataset...</p>
      )}

      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginTop: "20px",
        }}
      >
        <label>
          <div style={{ marginBottom: "8px" }}>Select State</div>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            style={selectStyle}
          >
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div style={{ marginBottom: "8px" }}>Select Date</div>
          <select
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setPrediction(null);
              setError("");
            }}
            style={selectStyle}
          >
            {validRows.map((row) => (
              <option key={row.Date} value={row.Date}>
                {row.Date}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        onClick={handlePredict}
        disabled={loading || !selectedDate}
        style={{
          marginTop: "20px",
          padding: "11px 20px",
          borderRadius: "8px",
          border: "none",
          background: "#3b82f6",
          color: "white",
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "Predicting..." : "Predict Consumption"}
      </button>

      {prediction !== null && (
        <div style={{ marginTop: "20px" }}>
          <p>State: {selectedState}</p>
          <p>Date: {selectedDate}</p>
          <h3>
            Predicted Consumption:{" "}
            {Number(prediction).toFixed(2)} MU
          </h3>
        </div>
      )}

      {error && (
        <p style={{ color: "#f87171", marginTop: "16px" }}>
          {error}
        </p>
      )}

      <p style={{ color: "#9ca3af", fontSize: "13px", marginTop: "20px" }}>
        Note: This is a historical-date model test, not a future forecast.
      </p>
    </div>
  );
}

const selectStyle = {
  display: "block",
  minWidth: "200px",
  padding: "10px",
  borderRadius: "6px",
  background: "#172235",
  color: "#e5e7eb",
  border: "1px solid #334155",
};

export default RandomForestLivePrediction;
