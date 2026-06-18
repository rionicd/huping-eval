import ci from 'miniprogram-ci';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const project = new ci.Project({
    appid: 'wxf06cb4ac3d035efd',
    type: 'miniProgram',
    projectPath: path.join(__dirname, 'mp'),
    privateKeyPath: path.join(__dirname, 'private.wxf06cb4ac3d035efd.key'),
    ignores: ['node_modules/**/*', 'README.md'],
  });
  
  console.log('开始编译并上传小程序...');
  const uploadResult = await ci.upload({
    project,
    version: '1.0.0',
    desc: '教师互评系统原生小程序白蓝版',
    setting: {
      es6: true,
      minify: true,
      minifyJS: true,
      minifyWXML: true,
      minifyWXSS: true,
    },
    onProgressUpdate: (info) => {
      if (info && info.status) {
        console.log(`[CI] ${info.status}: ${info.message || ''}`);
      } else {
        console.log('[CI]', info);
      }
    },
  });
  console.log('=== 上传成功 ===');
  console.log('包大小信息:', JSON.stringify(uploadResult, null, 2));
})().catch(err => {
  console.error('=== 上传失败 ===');
  console.error(err);
  process.exit(1);
});
