
import StateSelector from "../components/StateSelector";
import StateDetails from "../components/StateDetails";
import { useState } from "react";

function StateAnalysis() {
  const [selectedState, setSelectedState] = useState("Punjab");

  return (
    <>
    

      <div className="dashboard">
        <h1>State Analysis</h1>

        <StateSelector
          selectedState={selectedState}
          setSelectedState={setSelectedState}
        />

        <StateDetails
          selectedState={selectedState}
        />
      </div>
    </>
  );
}

export default StateAnalysis;