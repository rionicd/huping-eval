import React, { useState } from 'react';

export default function Evaluation({ teachers, role, onResetRole, onEnterAdmin }) {
  // 根据身份决定允许展示的 Tab 页签
  const tabs = role === '教师' 
    ? ['校级干部', '中层干部', '普通教师']
    : role === '校级干部' 
      ? ['中层干部', '普通教师']
      : ['校级干部', '普通教师']; // 中层干部只评校干和教师

  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [scores, setScores] = useState({}); // { [teacherId]: Number }
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 下拉选择改变分值
  const handleInputChange = (teacherId, valStr) => {
    if (valStr === '') {
      setScores(prev => {
        const copy = { ...prev };
        delete copy[teacherId];
        return copy;
      });
      return;
    }

    const val = parseInt(valStr, 10);
    if (isNaN(val)) return;
    setScores(prev => ({ ...prev, [teacherId]: val }));
  };

  // 根据当前打分人身份过滤需要被评价的教师总名单
  const getEligibleTeachers = () => {
    if (role === '教师') {
      return teachers;
    } else if (role === '校级干部') {
      return teachers.filter(t => t.type !== '校级干部');
    } else if (role === '中层干部') {
      return teachers.filter(t => t.type !== '中层干部');
    }
    return [];
  };

  const eligibleTeachers = getEligibleTeachers();

  const getTeachersByTab = (tabType) => {
    return eligibleTeachers.filter(t => t.type === tabType);
  };

  // 计算填报进度 (只算当前身份有权限评价的人)
  const totalCount = eligibleTeachers.length;
  const completedCount = eligibleTeachers.filter(t => scores[t.id] !== undefined && scores[t.id] !== '').length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 校验特定 Tab 的填报状态
  const getTabStatus = (tabType) => {
    const list = getTeachersByTab(tabType);
    if (list.length === 0) return 'empty';
    const tabCompleted = list.filter(t => {
      const v = scores[t.id];
      return v !== undefined && v >= 85 && v <= 99;
    }).length;

    if (tabCompleted === list.length) return 'done';
    if (tabCompleted > 0) return 'dirty';
    return 'empty';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    // 1. 完整性校验与定位 (在符合打分人身份的名单里找漏填者)
    const uncompletedTeachers = eligibleTeachers.filter(t => {
      const val = scores[t.id];
      return val === undefined || val === '' || isNaN(val) || val < 85 || val > 99;
    });

    if (uncompletedTeachers.length > 0) {
      const target = uncompletedTeachers[0];
      setActiveTab(target.type);
      
      setErrorMessage(`⚠️ 测评未完成或数据有误！当前身份下共有 ${uncompletedTeachers.length} 位教师打分不正确，已自动切换到 [${target.type}]。`);
      
      setTimeout(() => {
        const el = document.getElementById(`row-${target.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
          setTimeout(() => {
            el.style.backgroundColor = '';
          }, 2000);
        }
      }, 200);
      return;
    }

    // 2. 格式与范围双重核对
    const invalidList = eligibleTeachers.filter(t => {
      const val = scores[t.id];
      return val < 85 || val > 99;
    });

    if (invalidList.length > 0) {
      setErrorMessage("❌ 打分区间错误，分值必须介于 85 至 99 之间！已拒绝提交。");
      return;
    }

    // 3. 提交到后端 (携带 role 身份)
    setSubmitting(true);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role, scores })
      });

      if (res.ok) {
        setSubmitted(true);
        setScores({}); // 成功后清空表单
      } else {
        const errData = await res.json();
        setErrorMessage(`❌ 提交失败: ${errData.message}`);
      }
    } catch (err) {
      setErrorMessage("❌ 网络错误，无法提交测评，请检查网络！");
    } finally {
      setSubmitting(false);
    }
  };

  // 提交成功屏
  if (submitted) {
    return (
      <div className="login-container">
        <div className="login-card glass-panel" style={{ padding: '3rem 2rem' }}>
          <div className="logo-icon" style={{ fontSize: '4rem', color: '#10b981' }}>🎉</div>
          <h1 className="login-title" style={{ color: '#34d399', fontSize: '2rem' }}>提交成功</h1>
          <p className="login-desc" style={{ marginTop: '1rem', lineHeight: '1.6' }}>
            您的打分卷已安全提交入库并进入汇总系统。<br />
            感谢您的积极参与，祝您工作顺利！
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '2rem' }}>
            <button 
              type="button" 
              className="btn btn-primary" 
              style={{ width: '100%', minHeight: '48px' }}
              onClick={() => setSubmitted(false)}
            >
              录入下一份评议卷
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%' }}
              onClick={onResetRole}
            >
              🔄 切换身份
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 教师名单为空时
  if (teachers.length === 0) {
    return (
      <div className="login-container">
        <div className="login-card glass-panel" style={{ padding: '3rem 2rem' }}>
          <div className="logo-icon">📝</div>
          <h1 className="login-title">教师互评系统</h1>
          <p className="login-desc" style={{ marginBlockEnd: '2rem' }}>
            暂未配置教师打分数据。请联系管理员登录后台导入。
          </p>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ width: '100%' }}
            onClick={onEnterAdmin}
          >
            管理员入口
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* 顶部标题区，显示身份与退出 */}
      <header className="eval-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.6rem' }}>
            {role === '教师' ? '👨‍🏫' : role === '校级干部' ? '👑' : '💼'}
          </span>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: '1.05rem', fontWeight: '800' }}>教师民主测评</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              身份：<strong style={{ color: '#a855f7' }}>{role}</strong> (评 {totalCount} 人)
            </p>
          </div>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem' }} 
          onClick={onResetRole}
        >
          🔄 重新选身份
        </button>
      </header>

      {/* 打分页面主内容区 */}
      <main className="main-content">
        {/* 说明卡片 */}
        <section className="progress-card glass-panel" style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <p><strong>💡 身份限制与评分区间：</strong></p>
          <p>1. 当前身份：<strong>{role}</strong>。您只需要为 <strong>{tabs.join('、')}</strong> 打分（共 {totalCount} 人）。</p>
          <p>2. 打分区间为：<strong>85 分至 99 分</strong>。</p>
        </section>

        {/* 填报总进度条 */}
        <section className="progress-card glass-panel" style={{ marginTop: '-0.75rem' }}>
          <div className="progress-info">
            <span>📋 全卷填报完成进度</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{completedCount} / {totalCount} 人 ({progressPercent}%)</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </section>

        {/* 页签 */}
        <nav className="tabs-container" aria-label="被评干部及教师页签">
          {tabs.map(tab => {
            const list = getTeachersByTab(tab);
            const status = getTabStatus(tab);
            const isActive = activeTab === tab;

            let indicator = '';
            if (status === 'done') indicator = '🟢';
            else if (status === 'dirty') indicator = '🟡';
            else indicator = '⚪';

            return (
              <button
                key={tab}
                className={`tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {indicator} {tab}
                <span className="tab-badge">{list.length}人</span>
              </button>
            );
          })}
        </nav>

        {/* 表单单页 */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section className="glass-panel" style={{ padding: '1.25rem 1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
              📋 正在评议：{activeTab} ({getTeachersByTab(activeTab).length} 人)
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {getTeachersByTab(activeTab).map((teacher, index) => {
                const currentScore = scores[teacher.id];
                const isOutOfRange = currentScore !== undefined && (currentScore < 85 || currentScore > 99);
                const isFilled = currentScore !== undefined && currentScore !== '';

                return (
                  <div 
                    key={teacher.id} 
                    id={`row-${teacher.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      borderRadius: '12px',
                      background: isOutOfRange ? 'rgba(239, 68, 68, 0.08)' : isFilled ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                      border: isOutOfRange ? '1px solid rgba(239, 68, 68, 0.3)' : isFilled ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--panel-border)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '1rem', fontWeight: '600' }}>{teacher.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        {index + 1}号 / {teacher.type}
                      </span>
                    </div>

                    {/* 85-99 滚轮选择器 */}
                    <div style={{ position: 'relative' }}>
                      <select
                        value={currentScore || ''}
                        onChange={(e) => handleInputChange(teacher.id, e.target.value)}
                        style={{
                          width: '110px',
                          height: '42px',
                          padding: '0 24px 0 12px',
                          borderRadius: '10px',
                          border: isOutOfRange ? '2px solid #ef4444' : isFilled ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.15)',
                          background: 'rgba(0, 0, 0, 0.3)',
                          color: '#ffffff',
                          fontWeight: '600',
                          fontSize: '1rem',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        <option value="" style={{ background: '#181930', color: 'var(--text-secondary)' }}>-- 打分 --</option>
                        {Array.from({ length: 15 }, (_, i) => 99 - i).map(score => (
                          <option key={score} value={score} style={{ background: '#181930', color: '#ffffff' }}>
                            {score} 分
                          </option>
                        ))}
                      </select>
                      <div style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '0.7rem',
                        color: 'var(--text-secondary)',
                        pointerEvents: 'none'
                      }}>
                        ▼
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 错误提示栏 */}
          {errorMessage && (
            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)', color: '#f87171', fontSize: '0.9rem' }}>
              {errorMessage}
            </div>
          )}

          {/* 统一提交按钮 */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', minHeight: '52px', fontSize: '1.1rem', marginBottom: '2rem' }}
            disabled={submitting}
          >
            {submitting ? '正在提交测评卷...' : `确认并提交整卷测评 (${completedCount}/${totalCount})`}
          </button>
        </form>

        {/* 底部管理员入口 */}
        <footer style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '3rem' }}>
          <button 
            type="button" 
            className="btn-link" 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
            onClick={onEnterAdmin}
          >
            管理后台入口
          </button>
        </footer>
      </main>
    </div>
  );
}
