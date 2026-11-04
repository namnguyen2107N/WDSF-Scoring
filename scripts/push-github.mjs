import { execFileSync } from 'node:child_process';

const run = (args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  }).trim();

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

try {
  run(['rev-parse', '--is-inside-work-tree']);
} catch {
  fail('Thư mục hiện tại không phải là Git repository.');
}

let branch;
try {
  branch = run(['rev-parse', '--abbrev-ref', 'HEAD']);
} catch {
  fail('Không xác định được nhánh Git hiện tại.');
}

if (branch === 'HEAD') {
  fail('Bạn đang ở trạng thái detached HEAD. Hãy checkout một nhánh trước khi đẩy.');
}

const message =
  process.argv.slice(2).join(' ').trim() || 'chore: cap nhat du an';

let status = '';
try {
  status = run(['status', '--porcelain']);
} catch {
  fail('Không đọc được trạng thái Git.');
}

if (status) {
  console.log('📦 Có thay đổi chưa commit. Đang thêm và commit...');
  try {
    execFileSync('git', ['add', '-A'], { stdio: 'inherit' });
    execFileSync('git', ['commit', '-m', message], { stdio: 'inherit' });
  } catch {
    fail('Commit thất bại. Kiểm tra user.name / user.email của Git.');
  }
} else {
  console.log('ℹ️  Không có thay đổi chưa commit.');
}

let hasUpstream = true;
try {
  execFileSync('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
    stdio: 'ignore',
  });
} catch {
  hasUpstream = false;
}

console.log(
  hasUpstream
    ? `🚀 Đang đẩy nhánh ${branch} lên origin...`
    : `🚀 Đang đẩy nhánh ${branch} lên origin và thiết lập upstream...`,
);

try {
  if (hasUpstream) {
    execFileSync('git', ['push', 'origin', branch, '--quiet'], {
      stdio: 'inherit',
    });
  } else {
    execFileSync('git', ['push', '--quiet', '--set-upstream', 'origin', branch], {
      stdio: 'inherit',
    });
  }
} catch {
  console.error('\n❌ Đẩy lên GitHub thất bại.');
  console.error('   Kiểm tra: quyền truy cập repository, kết nối mạng và đăng nhập GitHub.');
  console.error('   Gợi ý: mở terminal và chạy lần lượt:');
  console.error('     git remote -v');
  console.error('     git push -u origin ' + branch);
  process.exit(1);
}

console.log(`\n✅ Đã đẩy nhánh "${branch}" lên GitHub thành công.`);
console.log('   Repository: https://github.com/namnguyen2107N/WDSF-Scoring');
