import React from 'react';
import Model from 'react-body-highlighter'; // Default import

const MuscleVisualizer = ({ exerciseToDisplay, type = 'anterior' }) => {
  if (!exerciseToDisplay || exerciseToDisplay.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#2E2E30]/20 rounded-lg">
        <p className="text-xs text-[#808080]">N/A</p>
      </div>
    );
  }

  // The data prop for react-body-highlighter expects an array of objects,
  // each with a `name` (exercise name, can be generic) and `muscles` (array of muscle slugs)
  const data = [
    {
      // name: "Current Exercise", // Not strictly needed if we only show one set of highlights
      muscles: exerciseToDisplay,
    },
  ];

  return (
    <div className="w-full h-full p-1 bg-[#3a3a3c]/30 rounded-lg flex items-center justify-center">
      <Model
        data={data}
        type={type} // 'anterior' or 'posterior'
        highlightedColors={['#C51D34']} // Single color for highlighted, matching our red
        bodyColor="#808080" // Body outline / un-highlighted parts
        style={{ width: '100%', height: '100%', padding: '0' }} // Ensure it fills the container
      />
    </div>
  );
};

export default MuscleVisualizer; 