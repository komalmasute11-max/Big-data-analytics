
import { useState } from "react";
import TrendChart from "../components/TrendChart";
import YearFilter from "../components/YearFilter";
import ActualVsPredicted from "../components/ActualVsPredicted";

function Trends() {
  const [selectedYear, setSelectedYear] = useState(2023);

  return (
    <div className="dashboard">
      <h1>Energy Trends</h1>

      <YearFilter
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
      />

      <TrendChart selectedYear={selectedYear} />

      <hr />

      <ActualVsPredicted />
    </div>
  );
}

export default Trends;
