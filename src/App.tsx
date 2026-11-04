import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import SetupPage from './pages/SetupPage';
import EventsPage from './pages/EventsPage';
import JudgingPage from './pages/JudgingPage';
import RankingPage from './pages/RankingPage';
import ExportPage from './pages/ExportPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/su-kien" replace />} />
        <Route path="/thiet-lap" element={<SetupPage />} />
        <Route path="/su-kien" element={<EventsPage />} />
        <Route path="/cham-diem" element={<JudgingPage />} />
        <Route path="/xep-hang" element={<RankingPage />} />
        <Route path="/xuat" element={<ExportPage />} />
        <Route path="*" element={<Navigate to="/su-kien" replace />} />
      </Route>
    </Routes>
  );
}
