import React, { useState, useEffect } from 'react';
import Evaluation from './Evaluation.jsx';
import Admin from './Admin.jsx';

export default function App() {
  const [view, setView] = useState('evaluation'); // 'evaluation' | 'admin'
  const [role, setRole] = useState(null); // null | '校级干部' | '中层干部' | '教师'
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 获取教师名单
  const fetchTeachers = async () => {
    try {
      const res = await fetch('/api/teachers');
      if (res.ok) {
        const data = await res.json();
        setTeachers(data);
      }
    } catch (error) {
      console.error("加载教师名单失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();

    const checkHash = () => {
      if (window.location.hash === '#admin') {
        setView('admin');
      } else {
        setView('evaluation');
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleLogoutAdmin = () => {
    setView('evaluation');
    setRole(null); // 退出管理员，重置身份选择
    if (window.location.hash === '#admin') {
      window.location.hash = '';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1rem', color: '#94a3b8' }}>
        <div className="logo-icon" style={{ fontSize: '3rem' }}>📝</div>
        <div style={{ fontSize: '1.1rem', fontWeight: '500' }}>正在努力加载系统，请稍候...</div>
      </div>
    );
  }

  // 管理员后台视图
  if (view === 'admin') {
    return (
      <Admin 
        onLogout={handleLogoutAdmin} 
        onRefreshTeachers={fetchTeachers} 
      />
    );
  }

  // 前台评议，如果还没选择身份，先显示“选择身份”界面
  if (!role) {
    return (
      <div className="login-container">
        <div className="login-card glass-panel" style={{ maxWidth: '400px', padding: '2.5rem 1.5rem' }}>
          <h1 className="login-title" style={{ fontSize: '1.4rem', marginBottom: '2rem', textAlign: 'center' }}>请选择您的身份</h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button 
              type="button"
              className="btn btn-secondary"
              style={{
                padding: '1rem',
                borderRadius: '10px',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                textAlign: 'center',
                width: '100%',
                minHeight: '50px'
              }}
              onClick={() => setRole('教师')}
            >
              教师
            </button>

            <button 
              type="button"
              className="btn btn-secondary"
              style={{
                padding: '1rem',
                borderRadius: '10px',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                textAlign: 'center',
                width: '100%',
                minHeight: '50px'
              }}
              onClick={() => setRole('中层干部')}
            >
              中层干部
            </button>

            <button 
              type="button"
              className="btn btn-secondary"
              style={{
                padding: '1rem',
                borderRadius: '10px',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                textAlign: 'center',
                width: '100%',
                minHeight: '50px'
              }}
              onClick={() => setRole('校级干部')}
            >
              校级干部
            </button>
          </div>

          <footer style={{ marginTop: '2rem', textAlign: 'center' }}>
            <button 
              type="button" 
              className="btn-link" 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
              onClick={() => { window.location.hash = '#admin'; setView('admin'); }}
            >
              管理员通道
            </button>
          </footer>
        </div>
      </div>
    );
  }

  // 已选择身份，渲染打分表单
  return (
    <Evaluation 
      teachers={teachers} 
      role={role}
      onResetRole={() => setRole(null)}
      onEnterAdmin={() => {
        window.location.hash = '#admin';
        setView('admin');
      }} 
    />
  );
}
