const PDFDocument = require('pdfkit');
function buildReportPDF(res, { patient, doctor, caregiver, stats, symptoms, observations, alerts, notes, period }) {
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=report-${patient.id}-${Date.now()}.pdf`);
  doc.pipe(res);
  doc.fontSize(20).text('Parkinson Care Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Patient: ${patient.fullName} | Period: ${period}`);
  if (doctor) doc.text(`Doctor: ${doctor.fullName} (${doctor.email})`);
  if (caregiver) doc.text(`Caregiver: ${caregiver.fullName} (${caregiver.email})`);
  doc.moveDown();
  doc.fontSize(14).text('Progress Summary');
  doc.fontSize(11).text(`Exercise completion: ${stats.exercise.completionPct}% (${stats.exercise.completed}/${stats.exercise.total})`);
  doc.text(`Medication adherence: ${stats.meds.adherencePct}% (${stats.meds.taken}/${stats.meds.total})`);
  doc.moveDown().fontSize(14).text('Symptom averages');
  doc.fontSize(11).text(JSON.stringify(stats.symptoms.avg || {}, null, 2));
  doc.moveDown().fontSize(14).text('Observations');
  doc.fontSize(10).text((observations || []).slice(0, 20).map((o) => `${new Date(o.loggedAt).toLocaleString()} - ${o.notes || o.mood || ''}`).join('\n') || 'None');
  doc.moveDown().fontSize(14).text('Alerts');
  doc.fontSize(10).text((alerts || []).map((a) => `[${a.severity}] ${a.message}`).join('\n') || 'None');
  doc.moveDown().fontSize(14).text('Doctor notes');
  doc.fontSize(10).text((notes || []).map((n) => n.note).join('\n') || 'None');
  doc.end();
}
module.exports = { buildReportPDF };
