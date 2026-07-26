import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AppLayout from './components/AppLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ArticleDetail from './pages/ArticleDetail';
import ArticleEditor from './pages/ArticleEditor';
import Profile from './pages/Profile';
import Favorites from './pages/Favorites';
import MyArticles from './pages/MyArticles';
import AdminDashboard from './pages/admin/Dashboard';
import AdminArticles from './pages/admin/ArticleManage';
import AdminCategories from './pages/admin/CategoryManage';
import AdminTags from './pages/admin/TagManage';
import AdminComments from './pages/admin/CommentManage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { token, fetchProfile } = useAuthStore();

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token, fetchProfile]);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/articles/:slug" element={<ArticleDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/write" element={<ArticleEditor />} />
          <Route path="/edit/:id" element={<ArticleEditor />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/my-articles" element={<MyArticles />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/articles" element={<AdminArticles />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/tags" element={<AdminTags />} />
          <Route path="/admin/comments" element={<AdminComments />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
