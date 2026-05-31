import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ChatList from './pages/ChatList';
import Chat from './pages/Chat';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth page */}
        <Route path="/login" element={<Login />} />
        
        {/* Secure Dashboard list */}
        <Route 
          path="/chat-list" 
          element={
            <ProtectedRoute>
              <ChatList />
            </ProtectedRoute>
          } 
        />
        
        {/* Secure Individual Chat */}
        <Route 
          path="/chat/:id" 
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } 
        />
        
        {/* Standard navigation fallbacks */}
        <Route path="*" element={<Navigate to="/chat-list" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
