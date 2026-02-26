import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import TeacherPanel from './components/TeacherPanel';
import StudentView from './components/StudentView';
import JoinScreen from './components/JoinScreen';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<JoinScreen />} />
          <Route path="/teacher" element={<TeacherPanel />} />
          <Route path="/student" element={<StudentView />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
