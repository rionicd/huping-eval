import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5050;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

let writeQueue = Promise.resolve();

// 初始化数据库
async function initDb() {
  try {
    await fs.access(DB_FILE);
  } catch {
    const defaultData = {
      config: {
        adminPassword: "admin",
        minScore: 85,
        maxScore: 99
      },
      teachers: [],
      submissions: [] // 匿名提交记录
    };
    await fs.writeFile(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

// 读取数据库
async function readDb() {
  await initDb();
  const data = await fs.readFile(DB_FILE, 'utf-8');
  return JSON.parse(data);
}

// 写入数据库
async function writeDb(data) {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

// 初始化
await initDb();

// ================= API 路由 =================

// 1. 获取教师列表
app.get('/api/teachers', async (req, res) => {
  try {
    const db = await readDb();
    res.json(db.teachers);
  } catch (error) {
    res.status(500).json({ message: "获取教师列表失败", error: error.message });
  }
});

// 2. 匿名提交整卷测评打分 (带校验，不全或有错误直接全卷作废)
app.post('/api/submissions', async (req, res) => {
  const { role, scores } = req.body;
  
  if (!role || !["校级干部", "中层干部", "教师"].includes(role)) {
    return res.status(400).json({ message: "无效的评议人身份" });
  }

  if (!scores || typeof scores !== 'object') {
    return res.status(400).json({ message: "无效的打分数据" });
  }

  try {
    const db = await readDb();
    const teachers = db.teachers;
    const { minScore = 85, maxScore = 99 } = db.config || {};

    // 根据评议人身份决定期望被评分教师列表
    let expectedTeachers = [];
    if (role === "教师") {
      expectedTeachers = teachers; // 普通教师评议全员 30 人
    } else if (role === "校级干部") {
      expectedTeachers = teachers.filter(t => t.type !== "校级干部"); // 校级干部评中层和普通教师 20 人
    } else if (role === "中层干部") {
      expectedTeachers = teachers.filter(t => t.type !== "中层干部"); // 中层干部评校级和普通教师 20 人
    }

    const submittedIds = Object.keys(scores);
    const expectedIds = expectedTeachers.map(t => t.id);

    // 校验1：打分完整性与匹配性
    const isComplete = expectedIds.length > 0 && 
                       expectedIds.every(id => submittedIds.includes(id)) && 
                       submittedIds.length === expectedIds.length;

    if (!isComplete) {
      return res.status(400).json({ message: "打分不全或提交了无关范围教师的评分！整卷已作废。" });
    }

    // 校验2：打分范围有效性（所有人分数都必须在 85 到 99 之间）
    for (const teacherId of expectedIds) {
      const val = parseInt(scores[teacherId], 10);
      if (isNaN(val) || val < minScore || val > maxScore) {
        return res.status(400).json({ 
          message: `打分值错误！分数必须在 ${minScore}-${maxScore} 分之间，整卷已作废。` 
        });
      }
    }

    // 通过全部校验后，保存本次有效提交
    const newSubmission = {
      id: `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      role,
      scores
    };

    db.submissions.push(newSubmission);
    await writeDb(db);

    res.json({ success: true, submissionId: newSubmission.id });
  } catch (error) {
    res.status(500).json({ message: "提交测评失败", error: error.message });
  }
});

// 3. 管理员密码验证
app.post('/api/admin/verify', async (req, res) => {
  const { password } = req.body;
  try {
    const db = await readDb();
    if (db.config.adminPassword === password) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: "密码错误" });
    }
  } catch (error) {
    res.status(500).json({ message: "服务器错误", error: error.message });
  }
});

// 4. 管理员获取当前回收统计进度
app.get('/api/admin/progress', async (req, res) => {
  try {
    const db = await readDb();
    res.json({
      totalSubmissions: db.submissions.length,
      totalTeachers: db.teachers.length
    });
  } catch (error) {
    res.status(500).json({ message: "获取进度失败", error: error.message });
  }
});

// 5. 管理员导入教师名单 (覆盖导入)
app.post('/api/admin/teachers/import', async (req, res) => {
  const { teachers } = req.body; // Array: [{ name, type }]
  if (!Array.isArray(teachers)) {
    return res.status(400).json({ message: "名单格式不正确" });
  }

  try {
    const db = await readDb();
    
    // 生成带 ID 的教师列表
    const newTeachers = teachers.map((t, idx) => ({
      id: `t_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
      name: t.name.trim(),
      type: t.type.trim() // "校级干部" | "中层干部" | "普通教师"
    }));

    db.teachers = newTeachers;
    db.submissions = []; // 每次导入新名单，自动清空打分数据

    await writeDb(db);
    res.json({ success: true, count: newTeachers.length });
  } catch (error) {
    res.status(500).json({ message: "导入名单失败", error: error.message });
  }
});

// 6. 管理员重置评分数据 (保留名单，清空答卷)
app.post('/api/admin/reset', async (req, res) => {
  try {
    const db = await readDb();
    db.submissions = [];
    await writeDb(db);
    res.json({ success: true, message: "所有已交打分卷已清空" });
  } catch (error) {
    res.status(500).json({ message: "重置数据失败", error: error.message });
  }
});

// 6.5. 管理员获取教师名单导入 CSV 模板
app.get('/api/admin/template', (req, res) => {
  try {
    const csvContent = "\ufeff姓名,身份类型\n陈校长,校级干部\n李主任,中层干部\n张老师,普通教师\n";
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent('教师名单导入模板')}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ message: "获取模板失败", error: error.message });
  }
});

// 7. 导出统计表接口 (直接返回 CSV，自动计算平均分/最高/最低及频数矩阵)
app.get('/api/admin/export/:type', async (req, res) => {
  const { type } = req.params; // "校级干部" | "中层干部" | "普通教师"
  
  if (!["校级干部", "中层干部", "普通教师"].includes(type)) {
    return res.status(400).json({ message: "未知的表格类型" });
  }

  try {
    const db = await readDb();
    const targetTeachers = db.teachers.filter(t => t.type === type);
    const submissions = db.submissions;
    const { minScore = 85, maxScore = 99 } = db.config || {};

    // 统计名
    let title = "";
    if (type === "校级干部") title = "校级干部民主评议统计表";
    else if (type === "中层干部") title = "中层干部民主评议统计表";
    else title = "教师测评统计表";

    // 频数分布的表头分数列表 (99 到 85 从高到低)
    const scoreRange = [];
    for (let s = maxScore; s >= minScore; s--) {
      scoreRange.push(s);
    }

    // 拼装 CSV 头部
    let csvContent = `\ufeff${title}\n`; // UTF-8 BOM 保证 Excel 不乱码
    
    let headers = ["序号", "被评教师姓名", "有效答卷数", "平均得分", "最高分", "最低分"];
    scoreRange.forEach(score => {
      headers.push(`${score}分得票数`);
    });
    csvContent += headers.join(",") + "\n";

    // 逐个教师统计
    targetTeachers.forEach((teacher, idx) => {
      // 提取针对该教师的打分集合 (已作废的问卷不会计入 submissions，所以全是合规的)
      const scoreList = submissions
        .map(sub => sub.scores[teacher.id])
        .filter(v => v !== undefined && v !== null)
        .map(Number);
      
      const votes = scoreList.length;
      
      // 平均分、最高分、最低分
      let avg = "0.00";
      let max = 0;
      let min = 0;

      if (votes > 0) {
        const sum = scoreList.reduce((acc, curr) => acc + curr, 0);
        avg = (sum / votes).toFixed(2);
        max = Math.max(...scoreList);
        min = Math.min(...scoreList);
      }

      // 各分数的得票频数统计
      const freqMap = {};
      scoreRange.forEach(s => { freqMap[s] = 0; });
      scoreList.forEach(s => {
        if (freqMap[s] !== undefined) {
          freqMap[s] += 1;
        }
      });

      // 组装行数据
      let row = [
        idx + 1,
        teacher.name,
        votes,
        avg,
        max,
        min
      ];
      scoreRange.forEach(s => {
        row.push(freqMap[s]);
      });

      csvContent += row.join(",") + "\n";
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.csv"`);
    res.status(200).send(csvContent);

  } catch (error) {
    res.status(500).json({ message: "导出 CSV 报表失败", error: error.message });
  }
});

// ================= 托管前端静态文件 =================

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Server] 服务已启动，运行在端口 ${PORT}`);
});
