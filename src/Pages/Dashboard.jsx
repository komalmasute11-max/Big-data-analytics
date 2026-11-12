
import "../styles/Dashboard.css";
import EnergyChart from "../components/EnergyChart";

export default function Dashboard() {
  return (
    <div className="dashboard">
      <h1 className="heading">
        State-wise Energy Consumption Analysis
      </h1>

      <div className="cards">
        <div className="card">
          <h3>Total States</h3>
          <p>36</p>
        </div>

        <div className="card">
          <h3>Total Consumption</h3>
          <p>1,25,000 MU</p>
        </div>

        <div className="card">
          <h3>Highest State</h3>
          <p>Maharashtra</p>
        </div>

        <div className="card">
          <h3>Year</h3>
          <p>2025</p>
        </div>
      </div>

      <EnergyChart />
    </div>
  );
}

