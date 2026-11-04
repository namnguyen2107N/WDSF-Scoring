import { describe, expect, it } from 'vitest';
import {
  detectDelimiter,
  parseAthleteImport,
  parseDelimited,
  parseJudgeImport,
} from './csv';

describe('parseDelimited', () => {
  it('đọc CSV có dấu ngoặc kép và dấu phẩy trong ô', () => {
    const rows = parseDelimited(
      'SBD,Tên,Ghi chú\r\n101,"Nguyễn Văn A","Thi đấu, lần đầu"\r\n',
      ',',
    );
    expect(rows).toEqual([
      ['SBD', 'Tên', 'Ghi chú'],
      ['101', 'Nguyễn Văn A', 'Thi đấu, lần đầu'],
    ]);
  });

  it('nhận diện dấu phân tách Tab từ dữ liệu Excel', () => {
    expect(detectDelimiter('SBD\tTên\n101\tA')).toBe('\t');
    expect(detectDelimiter('SBD;Tên\n101;A')).toBe(';');
  });
});

describe('parseAthleteImport', () => {
  it('nhập danh sách solo, couple, đội từ bảng có tiêu đề', () => {
    const result = parseAthleteImport(
      [
        'SBD\tLoại\tTên\tNam\tNữ\tĐội\tĐơn vị\tNhóm tuổi',
        '501\tSolo\tNguyễn Văn A\t\t\t\t\tTrẻ',
        '502\tCouple\t\tMinh Quân\tThu Trang\t\t\tThanh niên',
        '503\tĐội\t\t\t\tĐội Mặt Trời\tCLB Hà Nội\tMở',
      ].join('\n'),
    );
    expect(result.usedHeader).toBe(true);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({
      bib: '501',
      kind: 'solo',
      name: 'Nguyễn Văn A',
      ageGroup: 'Trẻ',
    });
    expect(result.rows[1]).toMatchObject({
      bib: '502',
      kind: 'couple',
      male: 'Minh Quân',
      female: 'Thu Trang',
    });
    expect(result.rows[2]).toMatchObject({
      bib: '503',
      kind: 'team',
      teamName: 'Đội Mặt Trời',
      unit: 'CLB Hà Nội',
    });
    expect(result.issues).toHaveLength(0);
  });

  it('nhập không có tiêu đề theo thứ tự SBD, Tên, Nhóm tuổi', () => {
    const result = parseAthleteImport('601\tTrần Thị B\tThanh niên');
    expect(result.usedHeader).toBe(false);
    expect(result.rows[0]).toMatchObject({
      bib: '601',
      kind: 'solo',
      name: 'Trần Thị B',
      ageGroup: 'Thanh niên',
    });
  });

  it('báo lỗi dòng thiếu tên và SBD trùng', () => {
    const result = parseAthleteImport(
      [
        'SBD,Loại,Tên,Nam,Nữ,Đội,Đơn vị,Nhóm tuổi',
        '701,Solo,,,',
        '702,Solo,Hợp lệ',
        '702,Solo,Trùng SBD',
      ].join('\n'),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
    expect(result.issues.some((issue) => issue.message.includes('thiếu tên'))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes('trùng'))).toBe(true);
  });

  it('nhận diện tiêu đề tiếng Việt có dấu và dấu chấm phẩy', () => {
    const result = parseAthleteImport(
      ['Số báo danh;Họ tên;Nhóm tuổi', '801;Lê Văn C;Trung niên'].join('\n'),
    );
    expect(result.rows[0]).toMatchObject({
      bib: '801',
      name: 'Lê Văn C',
      ageGroup: 'Trung niên',
    });
  });
});

describe('parseJudgeImport', () => {
  it('nhập mã và tên giám khảo từ Excel/CSV', () => {
    const result = parseJudgeImport('Mã\tHọ tên\nA\tNguyễn Thu Hằng\nB\tTrần Quốc Bảo');
    expect(result.rows).toEqual([
      { code: 'A', name: 'Nguyễn Thu Hằng' },
      { code: 'B', name: 'Trần Quốc Bảo' },
    ]);
    expect(result.issues).toHaveLength(0);
  });

  it('báo mã trùng và dòng thiếu tên', () => {
    const result = parseJudgeImport('A,Giám khảo A\nA,Giám khảo B\nC');
    expect(result.rows).toHaveLength(1);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
