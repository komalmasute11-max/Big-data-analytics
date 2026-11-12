
import { useEffect, useState } from "react";
import Papa from "papaparse";

function StateDetails({ selectedState }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setStats(null);
    setError("");

    Papa.parse(`/${selectedState}.csv`, {
      download: true,
      header: true,
      skipEmptyLines: true,

      complete: (results) => {
        const data = results.data.filter(
          (row) =>
            row["2m_temperature_mean"] &&
            row["2m_temperature_max"] &&
            row["2m_temperature_min"]
        );

        if (data.length === 0) {
          setError("Is state ka valid climate data nahi mila.");
          return;
        }

        const avgTemp =
          data.reduce(
            (sum, row) =>
              sum + Number(row["2m_temperature_mean"]) - 273.15,
            0
          ) / data.length;

        const maxTemp = Math.max(
          ...data.map(
            (row) => Number(row["2m_temperature_max"]) - 273.15
          )
        );

        const minTemp = Math.min(
          ...data.map(
            (row) => Number(row["2m_temperature_min"]) - 273.15
          )
        );

        const avgSolar =
          data.reduce(
            (sum, row) =>
              sum +
              Number(row["surface_solar_radiation_downwards_mean"] || 0),
            0
          ) / data.length;

        const avgCloud =
          data.reduce(
            (sum, row) =>
              sum + Number(row["total_cloud_cover_mean"] || 0),
            0
          ) / data.length;

        setStats({
          avgTemp: avgTemp.toFixed(2),
          maxTemp: maxTemp.toFixed(2),
          minTemp: minTemp.toFixed(2),
          avgSolar: avgSolar.toFixed(2),
          avgCloud: avgCloud.toFixed(2),
        });
      },

      error: () => {
        setError(`${selectedState}.csv file load nahi hui.`);
      },
    });
  }, [selectedState]);

  return (
    <div className="details-card">
      <h2>Climate Information</h2>

      <p>
        State: <strong>{selectedState}</strong>
      </p>

      {error && <p>{error}</p>}
      {!stats && !error && <p>Loading climate data...</p>}

      {stats && (
        <>
          <p>Average Temperature: <strong>{stats.avgTemp} °C</strong></p>
          <p>Maximum Temperature: <strong>{stats.maxTemp} °C</strong></p>
          <p>Minimum Temperature: <strong>{stats.minTemp} °C</strong></p>
          <p>Average Solar Radiation: <strong>{stats.avgSolar}</strong></p>
          <p>Average Cloud Cover: <strong>{(Number(stats.avgCloud) * 100).toFixed(2)}%</strong></p>
        </>
      )}
    </div>
  );
}

export default StateDetails;