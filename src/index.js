import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // We'll create this later
import WorkoutTrackerApp from './App'; // Renaming App to WorkoutTrackerApp as per your code

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <WorkoutTrackerApp />
  </React.StrictMode>
); 