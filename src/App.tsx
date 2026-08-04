import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import BatchDetails from "./pages/BatchDetails";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const isElectron = typeof window !== 'undefined' && (
  navigator.userAgent.toLowerCase().includes('electron') ||
  !!(window as any).electronAPI
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {isElectron ? (
        <HashRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/student" replace />} />
            <Route path="/student" element={<Login defaultRole="student" forceRole={true} />} />
            <Route path="/admin" element={<Login defaultRole="admin" />} />
            <Route path="/teacher" element={<Login defaultRole="teacher" forceRole={true} />} />
            <Route path="/rctstaff" element={<Login defaultRole="staff" forceRole={true} />} />
            <Route path="/rctstudent" element={<Login defaultRole="student" forceRole={true} />} />
            <Route path="/sastaff" element={<Login defaultRole="staff" forceRole={true} />} />
            <Route path="/sastudent" element={<Login defaultRole="student" forceRole={true} />} />
            <Route path="/login" element={<Login defaultRole="student" forceRole={true} />} />
            <Route path="/select-role" element={<Login />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/admin-dashboard/batches/:batchId" element={<BatchDetails />} />
            <Route path="/student-dashboard" element={<StudentDashboard />} />
            <Route path="/staff-dashboard" element={<StaffDashboard />} />
            <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      ) : (
        <HashRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/student" replace />} />
            <Route path="/student" element={<Login defaultRole="student" forceRole={true} />} />
            <Route path="/admin" element={<Login defaultRole="admin" />} />
            <Route path="/teacher" element={<Login defaultRole="teacher" forceRole={true} />} />
            <Route path="/rctstaff" element={<Login defaultRole="staff" forceRole={true} />} />
            <Route path="/rctstudent" element={<Login defaultRole="student" forceRole={true} />} />
            <Route path="/sastaff" element={<Login defaultRole="staff" forceRole={true} />} />
            <Route path="/sastudent" element={<Login defaultRole="student" forceRole={true} />} />
            <Route path="/login" element={<Login defaultRole="student" forceRole={true} />} />
            <Route path="/select-role" element={<Login />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/admin-dashboard/batches/:batchId" element={<BatchDetails />} />
            <Route path="/student-dashboard" element={<StudentDashboard />} />
            <Route path="/staff-dashboard" element={<StaffDashboard />} />
            <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      )}
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
