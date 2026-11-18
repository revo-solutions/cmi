import type { DoseState, Medication } from '../medications/doses';
import { formatDelay, type MedicationReport, type Report } from './report';

// The disclaimer docs/escopo.md requires at the foot of the regularity report, word for word.
export const reportFootnote =
  'Registros feitos pela própria pessoa no aplicativo. Um registro indica que a dose foi marcada como tomada, não comprova a ingestão.';

const cell: Record<DoseState, { mark: string; label: string }> = {
  taken: { mark: '✓', label: 'registrada' },
  unconfirmed: { mark: '○', label: 'sem confirmação' },
  paused: { mark: '–', label: 'lembrete pausado' },
  pending: { mark: '…', label: 'ainda no prazo' },
};

function escape(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// "18/11/2026"
export function formatDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

// No repeated page footer: Android's print draws a fixed element once, over the next page's content.
function page(title: string, personName: string | null, body: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { margin: 16mm 14mm; }
  body { font-family: -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1F1A1E; font-size: 12pt; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 4pt; color: #4E1F41; }
  h2 { font-size: 14pt; margin: 18pt 0 6pt; break-after: avoid; }
  p { margin: 0 0 6pt; }
  .muted { color: #4A4248; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 8pt; }
  th, td { border: 1px solid #8C838A; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #F4E1EE; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .grid td, .grid th { text-align: center; padding: 2pt 4pt; font-size: 10pt; }
  .grid td:first-child, .grid th:first-child { text-align: left; white-space: nowrap; }
  .paused { background: #EEEEEE; }
  .footnote { margin-top: 12pt; padding-top: 6pt; border-top: 1px solid #8C838A; break-inside: avoid; }
</style>
</head>
<body>
<h1>${escape(title)}</h1>
${personName ? `<p><strong>${escape(personName)}</strong></p>` : ''}
${body}
</body>
</html>`;
}

function timesOf(medication: Medication) {
  return medication.paused ? `${medication.times.join(', ')} (lembretes pausados)` : medication.times.join(', ');
}

// The free list: what the person takes now, to show a doctor or at an emergency room.
export function medicationListHtml(medications: Medication[], personName: string | null, today: string) {
  const rows = medications.map((medication) => `<tr>
  <td>${escape(medication.name)}</td><td>${escape(medication.dose ?? '')}</td><td>${escape(timesOf(medication))}</td>
</tr>`).join('');
  return page('Remédios em uso', personName, `
<p class="muted">Lista de ${formatDate(today)}, feita no aplicativo Central Melhor Idade.</p>
<table>
  <thead><tr><th>Remédio</th><th>Dose</th><th>Horários</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`);
}

const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

function dayLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')} ${weekday.format(new Date(year, month - 1, day)).replace('.', '')}`;
}

export function regularityHtml(report: Report, current: Medication[], personName: string | null) {
  const legend = Object.values(cell).map(({ mark, label }) => `${mark} ${label}`).join(' · ');
  const summary = report.medications.map(({ medication, expected, taken, unconfirmed, typicalDelay }) => `<tr>
  <td>${escape(medication.name)}${medication.deleted ? ' (removido)' : ''}</td>
  <td>${taken} de ${expected}</td><td>${unconfirmed}</td><td>${formatDelay(typicalDelay)}</td>
</tr>`).join('');
  const grids = report.medications.map(({ medication, times, days }) => `
<h2>${escape(medication.name)}${medication.dose ? `, ${escape(medication.dose)}` : ''}</h2>
<table class="grid">
  <thead><tr><th>Dia</th>${times.map((time) => `<th>${time}</th>`).join('')}</tr></thead>
  <tbody>${scheduledDays(days).map(({ date, states }) => `<tr><td>${dayLabel(date)}</td>${times.map((time) => {
    const state = states[time];
    return state ? `<td class="${state === 'paused' ? 'paused' : ''}">${cell[state].mark}</td>` : '<td></td>';
  }).join('')}</tr>`).join('')}</tbody>
</table>`).join('');

  return page('Relatório de regularidade', personName, `
<p class="muted">De ${formatDate(report.from)} a ${formatDate(report.to)}.</p>
<h2>Remédios em uso</h2>
<table>
  <thead><tr><th>Remédio</th><th>Dose</th><th>Horários</th></tr></thead>
  <tbody>${current.map((medication) => `<tr><td>${escape(medication.name)}</td><td>${escape(medication.dose ?? '')}</td><td>${escape(timesOf(medication))}</td></tr>`).join('')}</tbody>
</table>
<h2>Doses no período</h2>
<p class="muted">Contadas sobre as doses previstas, sem os dias com lembrete pausado e sem as que ainda estão no prazo.
O atraso típico é a mediana do atraso das doses registradas.</p>
<table>
  <thead><tr><th>Remédio</th><th>Registradas</th><th>Sem confirmação</th><th>Atraso típico</th></tr></thead>
  <tbody>${summary}</tbody>
</table>
<p class="muted">${legend}</p>
${grids}
<p class="muted footnote">${escape(reportFootnote)}</p>`);
}

// From the medication's first dose in the period to its last, so one added or removed midway has no empty rows.
export function scheduledDays(days: MedicationReport['days']) {
  const scheduled = (day: MedicationReport['days'][number]) => Object.keys(day.states).length > 0;
  return days.slice(days.findIndex(scheduled), days.findLastIndex(scheduled) + 1);
}
