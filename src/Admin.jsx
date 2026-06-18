import React, { useState, useEffect } from 'react';

export default function Admin({ onLogout, onRefreshTeachers }) {
  const [password, setPassword] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  const [importText, setImportText] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('admin_verified') === 'true') {
      setIsVerified(true);
      fetchProgress();
    }
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        setIsVerified(true);
        sessionStorage.setItem('admin_verified', 'true');
        fetchProgress();
      } else {
        setErrorMsg('密码错误，请重新输入');
      }
    } catch (err) {
      setErrorMsg('连接后端失败');
    }
  };

  const fetchProgress = async () => {
    setLoadingProgress(true);
    try {
      const res = await fetch('/api/admin/progress');
      if (res.ok) {
        const data = await res.json();
        setSubmissionCount(data.totalSubmissions);
        setTeacherCount(data.totalTeachers);
      }
    } catch (err) {
      console.error("加载统计数据失败:", err);
    } finally {
      setLoadingProgress(false);
    }
  };

  // 批量导入
  const handleImport = async () => {
    if (!importText.trim()) {
      alert("请输入教师名单！");
      return;
    }

    const lines = importText.split('\n');
    const parsedTeachers = [];
    const validTypes = ["校级干部", "中层干部", "普通教师"];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let parts = line.split(/[,\t，]/);
      if (parts.length < 2) {
        alert(`第 ${i + 1} 行格式错误。正确格式: 姓名,身份类型\n(例如: 张三,普通教师)`);
        return;
      }

      const name = parts[0].trim();
      const type = parts[1].trim();

      if (!name) {
        alert(`第 ${i + 1} 行姓名不能为空`);
        return;
      }

      if (!validTypes.includes(type)) {
        alert(`第 ${i + 1} 行类型 [${type}] 不合法。合法类型有: ${validTypes.join(", ")}`);
        return;
      }

      parsedTeachers.push({ name, type });
    }

    if (parsedTeachers.length === 0) {
      alert("未解析出有效的教师数据");
      return;
    }

    if (!confirm(`确定要覆盖导入这 ${parsedTeachers.length} 位教师名单吗？\n注意：这会彻底清空之前所有已交的打分数据！`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/teachers/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ teachers: parsedTeachers })
      });

      if (res.ok) {
        alert("导入名单成功，评分数据已重置。");
        setImportText('');
        onRefreshTeachers();
        fetchProgress();
      } else {
        alert("导入失败，请检查数据格式。");
      }
    } catch (err) {
      alert("网络请求失败");
    }
  };

  // 一键生成测试用的 30 人名单 (各类型 10 人)
  const generateMockData = () => {
    let mockStr = '';
    // 10名校级干部
    for (let i = 1; i <= 10; i++) {
      mockStr += `校级干部_${i},校级干部\n`;
    }
    // 10名中层干部
    for (let i = 1; i <= 10; i++) {
      mockStr += `中层干部_${i},中层干部\n`;
    }
    // 10名普通教师
    for (let i = 1; i <= 10; i++) {
      mockStr += `普通教师_${i},普通教师\n`;
    }
    setImportText(mockStr.trim());
  };

  const handleResetRatings = async () => {
    if (!confirm("⚠️ 警告：确定要清空所有人当前的评分数据吗？\n名单会保留，但所有已交答卷都将被彻底删除！")) {
      return;
    }

    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      if (res.ok) {
        alert("已清空所有已交答卷。");
        fetchProgress();
      } else {
        alert("重置失败");
      }
    } catch (err) {
      alert("网络请求失败");
    }
  };

  const handleDownloadCsv = (type) => {
    const downloadUrl = `/api/admin/export/${encodeURIComponent(type)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${type}评议统计表.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/api/admin/template';
    link.download = '教师名单导入模板.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSystemUrl = () => {
    return window.location.origin;
  };

  // 未登录时
  if (!isVerified) {
    return (
      <div className="login-container">
        <div className="login-card glass-panel" style={{ maxWidth: '400px' }}>
          <div className="logo-icon" style={{ animation: 'none' }}>🔐</div>
          <h1 className="login-title">管理员后台</h1>
          <p className="login-desc">输入管理口令进入控制台</p>

          <form onSubmit={handleVerify}>
            <div className="form-group">
              <label htmlFor="admin-pass" className="form-label">管理口令：</label>
              <input
                type="password"
                id="admin-pass"
                className="search-input"
                placeholder="请输入管理员密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            {errorMsg && (
              <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'left' }}>
                ❌ {errorMsg}
              </p>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              进入后台
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%', marginTop: '0.75rem' }} 
              onClick={onLogout}
            >
              返回打分页面
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* 顶部导航 */}
      <nav className="admin-navbar">
        <div className="admin-title-area">
          <span style={{ fontSize: '1.2rem', fontWeight: '800' }}>🏫 教师互评管理后台</span>
          <span className="admin-badge">管理员控制台</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={fetchProgress}>
            🔄 刷新数据
          </button>
          <button className="btn btn-danger" onClick={onLogout}>
            退出后台
          </button>
        </div>
      </nav>

      {/* 后台主要部分 */}
      <main className="admin-main">
        {/* 左侧：回收进度与控制 */}
        <section className="admin-sidebar">
          {/* 二维码 */}
          <div className="qr-card glass-panel">
            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-secondary)' }}>📱 扫码打分二维码</h2>
            <div className="qr-placeholder">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getSystemUrl())}`}
                alt="扫码打分" 
                style={{ width: '150px', height: '150px' }}
              />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              让老师用微信或浏览器扫描此二维码：
            </p>
            <a 
              href={getSystemUrl()} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ fontSize: '0.85rem', color: '#6366f1', textDecoration: 'underline', wordBreak: 'break-all' }}
            >
              {getSystemUrl()}
            </a>
          </div>

          {/* 进度概览面板 */}
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', textAlign: 'left' }}>📈 回收进度统计</h2>
            {loadingProgress ? (
              <p style={{ color: 'var(--text-muted)' }}>加载统计中...</p>
            ) : (
              <div style={{ padding: '1rem 0' }}>
                <div style={{ fontSize: '3rem', fontWeight: '800', background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>
                  {submissionCount}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  已成功回收有效答卷
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  当前系统内教师总数：{teacherCount} 人
                </div>
              </div>
            )}
          </div>

          {/* 系统操作 */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', color: '#f87171' }}>⚠️ 系统维护</h2>
            <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleResetRatings}>
              🗑️ 清空所有已交答卷
            </button>
          </div>
        </section>

        {/* 右侧：统计报表与名单导入 */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* 数据导出 */}
          <div className="admin-content-card glass-panel">
            <h2 className="panel-title">📊 评议报表统计导出</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              直接导出汇总表，CSV 中已自动计算平均得分、最高分、最低分以及各分值（85-99分）的得票频数：
            </p>
            
            <div className="export-grid">
              <div className="export-card glass-panel">
                <span className="export-card-icon">👑</span>
                <span className="export-card-title">1. 校级干部民主评议表</span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  10位校级干部评分汇总统计
                </p>
                <button className="btn btn-primary" onClick={() => handleDownloadCsv('校级干部')}>
                  📥 导出表格
                </button>
              </div>

              <div className="export-card glass-panel">
                <span className="export-card-icon">💼</span>
                <span className="export-card-title">2. 中层干部民主评议表</span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  10位中层干部评分汇总统计
                </p>
                <button className="btn btn-primary" onClick={() => handleDownloadCsv('中层干部')}>
                  📥 导出表格
                </button>
              </div>

              <div className="export-card glass-panel">
                <span className="export-card-icon">👨‍🏫</span>
                <span className="export-card-title">3. 教师测评表</span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  10位普通教师评分汇总统计
                </p>
                <button className="btn btn-primary" onClick={() => handleDownloadCsv('普通教师')}>
                  📥 导出表格
                </button>
              </div>
            </div>
          </div>

          {/* 名单导入 */}
          <div className="admin-content-card glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="panel-title" style={{ margin: 0 }}>👥 导入全校教师名单</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                  onClick={handleDownloadTemplate}
                >
                  📥 下载 CSV 导入模板
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                  onClick={generateMockData}
                >
                  🪄 自动填入 30 人测试数据
                </button>
              </div>
            </div>

            <div className="import-tips">
              <strong>💡 名单导入格式要求：</strong><br />
              请在下方输入名单，每行一个教师，格式为：<strong>姓名,身份类型</strong>。可以用逗号或 Tab 键分隔。身份类型必须是以下三种之一：
              <ul>
                <li><strong>校级干部</strong> (如：校长、副校长，建议 10 人)</li>
                <li><strong>中层干部</strong> (如：教导主任、处室主任，建议 10 人)</li>
                <li><strong>普通教师</strong> (所有参与互评的普通老师，建议 10 人)</li>
              </ul>
              示例：<br />
              <code>
                刘校长,校级干部<br />
                王主任,中层干部<br />
                张老师,普通教师
              </code>
            </div>

            <textarea
              className="import-textarea"
              placeholder="在这里粘贴或输入您的教师名单，或者点击右上方按钮生成测试数据..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />

            <button className="btn btn-primary" style={{ width: '100%', minHeight: '48px' }} onClick={handleImport}>
              🚀 一键覆盖导入并重置评分数据
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
