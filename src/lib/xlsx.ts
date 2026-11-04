import * as XLSX from 'xlsx';
import type { AppState } from '../types';
import { DANCE_INFO, STATUS_INFO, categoryInfo } from './constants';
import { buildEventReport, type EventReport } from './report';
import { normalizeText, inputDateValue } from './utils';

function athleteLabel(
  state: AppState,
  athleteId: string,
): { bib: string; name: string } {
  const athlete = state.athletes.find((item) => item.id === athleteId);
  if (!athlete) return { bib: '', name: athleteId };
  return {
    bib: athlete.bib,
    name:
      athlete.kind === 'couple'
        ? `${athlete.male ?? ''} / ${athlete.female ?? ''}`.trim()
        : athlete.teamName ?? athlete.name ?? '',
  };
}

function addSheet(
  workbook: XLSX.WorkBook,
  name: string,
  rows: (string | number | boolean | null)[][],
): void {
  if (rows.length === 0) return;
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const widths = rows[0].map((_, column) => {
    const lengths = rows
      .slice(0, 300)
      .map((row) => String(row[column] ?? '').length);
    return { wch: Math.min(48, Math.max(10, ...lengths) + 2) };
  });
  sheet['!cols'] = widths;
  XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
}

function statusText(event: EventReport['event']): string {
  return STATUS_INFO[event.status].label;
}

export function buildResultsWorkbook(
  state: AppState,
  eventId?: string,
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const events = eventId
    ? state.events.filter((event) => event.id === eventId)
    : state.events;
  const reports = events.map((event) => buildEventReport(event, state));

  addSheet(workbook, 'Thông tin giải', [
    ['Hệ thống chấm điểm WDSF – Báo cáo kết quả'],
    ['Tên giải', state.settings.competitionName],
    ['Địa điểm', state.settings.venue],
    ['Ngày thi', state.settings.eventDate],
    ['Chủ tịch hội đồng', state.settings.president],
    ['Ban thư ký', state.settings.secretary],
    ['Số giám khảo', state.judges.length],
    ['Số VĐV/đội', state.athletes.length],
    ['Số sự kiện', events.length],
    ['Xuất lúc', new Date().toLocaleString('vi-VN')],
    [],
    ['Giám khảo', 'Mã', 'Họ tên'],
    ...state.judges.map((judge) => ['', judge.code, judge.name]),
  ]);

  addSheet(workbook, 'Tổng hợp sự kiện', [
    [
      'STT',
      'Nội dung',
      'Sự kiện',
      'Các điệu',
      'Trạng thái',
      'Số VĐV',
      'Số GK',
      'Đủ điểm',
      'Hạng 1',
      'Hạng 2',
      'Hạng 3',
      'Ghi chú',
    ],
    ...reports.map((report, index) => {
      const top = report.rows.slice(0, 3).map((row) => {
        const athlete = athleteLabel(state, row.athleteId);
        return `${athlete.bib} ${athlete.name} (${row.total})`;
      });
      return [
        index + 1,
        categoryInfo(report.event.category).label,
        report.event.name,
        report.event.dances.map((dance) => DANCE_INFO[dance].short).join(' · '),
        statusText(report.event),
        report.event.athleteIds.length,
        state.judges.length,
        report.complete ? 'Có' : 'Không',
        top[0] ?? '',
        top[1] ?? '',
        top[2] ?? '',
        report.tieCount > 0
          ? `${report.tieCount} trường hợp hòa cần xử lý`
          : report.kind === 'semifinal'
            ? 'Đang bán kết'
            : '',
      ];
    }),
  ]);

  const finalRows: (string | number | boolean | null)[][] = [];
  for (const report of reports) {
    if (report.kind !== 'final') continue;
    for (const row of report.final?.overall.rows ?? []) {
      const athlete = athleteLabel(state, row.athleteId);
      finalRows.push([
        report.event.name,
        categoryInfo(report.event.category).label,
        row.place,
        athlete.bib,
        athlete.name,
        report.event.dances
          .map((dance) => `${DANCE_INFO[dance].short}: ${row.dancePlaces[dance] ?? '—'}`)
          .join(' · '),
        row.total,
        row.rawSum,
        row.tied ? 'Có' : '',
        report.complete ? '' : 'Tạm tính – chưa đủ điểm',
      ]);
    }
  }
  addSheet(workbook, 'Kết quả chung kết', [
    [
      'Sự kiện',
      'Nội dung',
      'Hạng',
      'SBD',
      'VĐV / Đội',
      'Các điệu',
      'Tổng hạng',
      'Tổng hạng thô',
      'Hòa',
      'Ghi chú',
    ],
    ...finalRows,
  ]);

  addSheet(workbook, 'Đồng diễn', [
    [
      'Sự kiện',
      'Hạng',
      'SBD',
      'Đội',
      'Đơn vị',
      'Tổng điểm',
      'Tổng gốc',
      'Hòa',
      ...state.judges.map((judge) => `GK ${judge.code}`),
    ],
    ...reports
      .filter((report) => report.kind === 'group')
      .flatMap((report) =>
        (report.group?.rows ?? []).map((row) => {
          const athlete = state.athletes.find((a) => a.id === row.athleteId);
          return [
            report.event.name,
            row.place,
            athlete?.bib ?? '',
            athlete?.teamName ?? '',
            athlete?.unit ?? '',
            row.total,
            row.rawTotal,
            row.tied ? 'Có' : '',
            ...row.judgeScores.map((score) => score.total ?? ''),
          ];
        }),
      ),
  ]);

  addSheet(workbook, 'Bán kết', [
    [
      'Sự kiện',
      'Hạng',
      'SBD',
      'VĐV',
      'Lượt chọn',
      'Tổng hạng',
      'Vào chung kết',
      'Hòa ranh giới',
      'Chi tiết theo điệu',
    ],
    ...reports
      .filter((report) => report.semifinal)
      .flatMap((report) =>
        (report.semifinal?.result.rows ?? []).map((row) => {
          const athlete = athleteLabel(state, row.athleteId);
          return [
            report.event.name,
            row.position,
            athlete.bib,
            athlete.name,
            row.selections,
            row.rankSum,
            row.qualified ? 'Có' : '',
            row.tiedAtCutoff ? 'Có' : '',
            report.event.dances
              .map((dance) => {
                const cell = row.perDance[dance];
                return `${DANCE_INFO[dance].short}: ${cell.selected ? cell.rank : '—'}`;
              })
              .join(' · '),
          ];
        }),
      ),
  ]);

  const detailRows: (string | number | boolean | null)[][] = [
    ['Sự kiện', 'Vòng', 'Điệu', 'Giám khảo', 'SBD', 'VĐV / Đội', 'Thứ tự / Hạng'],
  ];
  for (const report of reports) {
    if (report.kind === 'final' && report.event.final) {
      for (const dance of report.event.dances) {
        for (const judge of state.judges) {
          const slots = report.event.final.marks[dance]?.[judge.id] ?? [];
          slots.forEach((athleteId, index) => {
            if (!athleteId) return;
            const athlete = athleteLabel(state, athleteId);
            detailRows.push([
              report.event.name,
              'Chung kết',
              DANCE_INFO[dance].name,
              `${judge.code} – ${judge.name}`,
              athlete.bib,
              athlete.name,
              index + 1,
            ]);
          });
        }
      }
    }
    if (report.semifinal && report.event.semifinal) {
      for (const dance of report.event.dances) {
        for (const judge of state.judges) {
          const slots = report.event.semifinal.marks[dance]?.[judge.id] ?? [];
          slots.forEach((athleteId, index) => {
            if (!athleteId) return;
            const athlete = athleteLabel(state, athleteId);
            detailRows.push([
              report.event.name,
              'Bán kết',
              DANCE_INFO[dance].name,
              `${judge.code} – ${judge.name}`,
              athlete.bib,
              athlete.name,
              index + 1,
            ]);
          });
        }
      }
    }
  }
  addSheet(workbook, 'Chi tiết giám khảo', detailRows);

  addSheet(workbook, 'Điểm đồng diễn', [
    [
      'Sự kiện',
      'Giám khảo',
      'SBD',
      'Đội',
      ...state.settings.criteria.map((criterion) => criterion.name),
      'Tổng giám khảo',
      'Bị bỏ',
    ],
    ...reports
      .filter((report) => report.kind === 'group')
      .flatMap((report) =>
        state.judges.flatMap((judge) =>
          (report.group?.rows ?? []).map((row) => {
            const athlete = state.athletes.find((a) => a.id === row.athleteId);
            const score = row.judgeScores.find((item) => item.judgeId === judge.id);
            return [
              report.event.name,
              `${judge.code} – ${judge.name}`,
              athlete?.bib ?? '',
              athlete?.teamName ?? '',
              ...state.settings.criteria.map(
                (criterion) => score?.values[criterion.id] ?? '',
              ),
              score?.total ?? '',
              row.droppedJudgeIds.includes(judge.id) ? 'Có' : '',
            ];
          }),
        ),
      ),
  ]);

  addSheet(workbook, 'Giám khảo', [
    ['Mã', 'Họ tên'],
    ...state.judges.map((judge) => [judge.code, judge.name]),
  ]);

  addSheet(workbook, 'Vận động viên', [
    ['SBD', 'Loại', 'Tên / Đội', 'Nam', 'Nữ', 'Đơn vị', 'Nhóm tuổi'],
    ...state.athletes.map((athlete) => [
      athlete.bib,
      athlete.kind === 'solo' ? 'Solo' : athlete.kind === 'couple' ? 'Couple' : 'Đội',
      athlete.kind === 'couple'
        ? `${athlete.male ?? ''} / ${athlete.female ?? ''}`
        : athlete.teamName ?? athlete.name ?? '',
      athlete.male ?? '',
      athlete.female ?? '',
      athlete.unit ?? '',
      athlete.ageGroup ?? '',
    ]),
  ]);

  addSheet(workbook, 'Đăng ký', [
    ['Sự kiện', 'Nội dung', 'SBD', 'VĐV / Đội'],
    ...reports.flatMap((report) =>
      report.event.athleteIds.map((athleteId) => {
        const athlete = athleteLabel(state, athleteId);
        return [
          report.event.name,
          categoryInfo(report.event.category).label,
          athlete.bib,
          athlete.name,
        ];
      }),
    ),
  ]);

  return workbook;
}

export async function exportResultsWorkbook(
  state: AppState,
  eventId?: string,
): Promise<string> {
  const workbook = buildResultsWorkbook(state, eventId);
  const name = normalizeText(
    state.settings.competitionName || 'giai-khieu-vu',
  )
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const date = inputDateValue(new Date().toISOString());
  const filename = `${name || 'ket-qua'}-${date}.xlsx`;
  XLSX.writeFile(workbook, filename);
  return filename;
}
