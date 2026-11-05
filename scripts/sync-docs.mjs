import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve('dist');
const destDir = path.resolve('docs');

if (fs.existsSync(srcDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.cpSync(srcDir, destDir, { recursive: true });
  console.log('✅ Đã đồng bộ dist/ sang docs/ để hỗ trợ GitHub Pages cả hai chế độ (Actions & Branch deploy).');
} else {
  console.warn('⚠️ Thư mục dist/ chưa tồn tại.');
}
