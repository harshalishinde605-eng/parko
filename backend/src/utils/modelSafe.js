// Resilient access to recently-added Prisma models.
// Background: the production host reuses a cached node_modules, so its
// generated Prisma Client can predate newer models/columns. These helpers
// try the typed client first and fall back to parameterized raw SQL,
// returning rows in the SAME camelCase shape either way. Never throws
// for a missing model — callers decide what empty means.
function isStaleClientError(e) {
  return e instanceof TypeError || /unknown argument|unknown model|Cannot read properties of undefined/i.test(String((e && e.message) || e));
}

function mapAssessment(r) {
  return mapAssessmentSafe(r);
}

// walkSpeed mapping above has an operator-precedence trap; normalize safely.
function numOrNull(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function mapAssessmentSafe(r) {
  if (!r) return null;
  return {
    id: r.id, patientId: r.patientId || r.patient_id, therapistId: r.therapistId || r.therapist_id,
    assessmentDate: r.assessmentDate || r.assessment_date, assessmentType: r.assessmentType || r.assessment_type,
    tug: numOrNull(r.tug), walkSpeed: numOrNull(r.walkSpeed ?? r.walk_speed),
    sitToStand: r.sitToStand ?? r.sit_to_stand ?? null,
    balanceScore: r.balanceScore ?? r.balance_score ?? null, balanceMax: r.balanceMax ?? r.balance_max ?? 28,
    problems: r.problems || [], observations: r.observations || null, notes: r.notes || null,
    reviewDate: r.reviewDate || r.review_date || null, createdAt: r.createdAt || r.created_at, updatedAt: r.updatedAt || r.updated_at,
  };
}

function mapGoal(r) {  if (!r) return null;
  return {
    id: r.id, patientId: r.patientId || r.patient_id, therapistId: r.therapistId || r.therapist_id,
    title: r.title, description: r.description || null, status: r.status,
    target: r.target || null, reviewDate: r.reviewDate || r.review_date || null,
    createdAt: r.createdAt || r.created_at, updatedAt: r.updatedAt || r.updated_at,
  };
}

async function createAssessmentSafe(prisma, data) {
  try {
    if (!prisma.physioAssessment) throw new TypeError('no model');
    return await prisma.physioAssessment.create({ data });
  } catch (e) {
    if (!isStaleClientError(e)) throw e;
    const id = `tmp_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`;
    await prisma.$executeRawUnsafe(
      'INSERT INTO physio_assessments (id, patient_id, therapist_id, assessment_date, assessment_type, tug, walk_speed, sit_to_stand, balance_score, balance_max, problems, observations, notes, review_date, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())',
      id, data.patientId, data.therapistId, data.assessmentDate || new Date(), data.assessmentType || 'initial',
      data.tug ?? null, data.walkSpeed ?? null, data.sitToStand ?? null, data.balanceScore ?? null, data.balanceMax ?? 28,
      data.problems || [], data.observations || null, data.notes || null, data.reviewDate || null
    );
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM physio_assessments WHERE id = $1', id);
    return mapAssessment(rows[0]);
  }
}

async function listAssessmentsSafe(prisma, patientId) {
  try {
    if (!prisma.physioAssessment) throw new TypeError('no model');
    return await prisma.physioAssessment.findMany({ where: { patientId }, orderBy: { assessmentDate: 'desc' } });
  } catch (e) {
    if (!isStaleClientError(e)) throw e;
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM physio_assessments WHERE patient_id = $1 ORDER BY assessment_date DESC', patientId);
    return rows.map(mapAssessment);
  }
}

async function createGoalSafe(prisma, data) {
  try {
    if (!prisma.rehabGoal) throw new TypeError('no model');
    return await prisma.rehabGoal.create({ data });
  } catch (e) {
    if (!isStaleClientError(e)) throw e;
    const id = `tmp_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`;
    await prisma.$executeRawUnsafe(
      'INSERT INTO rehab_goals (id, patient_id, therapist_id, title, description, status, target, review_date, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())',
      id, data.patientId, data.therapistId, data.title, data.description || null, data.status || 'active', data.target || null, data.reviewDate || null
    );
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM rehab_goals WHERE id = $1', id);
    return mapGoal(rows[0]);
  }
}

async function listGoalsSafe(prisma, patientId) {
  try {
    if (!prisma.rehabGoal) throw new TypeError('no model');
    return await prisma.rehabGoal.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
  } catch (e) {
    if (!isStaleClientError(e)) throw e;
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM rehab_goals WHERE patient_id = $1 ORDER BY created_at DESC', patientId);
    return rows.map(mapGoal);
  }
}

async function updateGoalSafe(prisma, id, data) {
  try {
    if (!prisma.rehabGoal) throw new TypeError('no model');
    return await prisma.rehabGoal.update({ where: { id }, data });
  } catch (e) {
    if (!isStaleClientError(e)) throw e;
    const sets = [];
    const vals = [];
    let i = 1;
    const col = { title: 'title', description: 'description', status: 'status', target: 'target', reviewDate: 'review_date' };
    for (const [k, c] of Object.entries(col)) {
      if (data[k] !== undefined) { sets.push(`${c} = $${i++}`); vals.push(data[k]); }
    }
    sets.push('updated_at = NOW()');
    vals.push(id);
    await prisma.$executeRawUnsafe(`UPDATE rehab_goals SET ${sets.join(', ')} WHERE id = $${i}`, ...vals);
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM rehab_goals WHERE id = $1', id);
    if (!rows[0]) { const err = new Error('Goal not found'); err.status = 404; throw err; }
    return mapGoal(rows[0]);
  }
}

async function findGoalSafe(prisma, id) {
  try {
    if (!prisma.rehabGoal) throw new TypeError('no model');
    return await prisma.rehabGoal.findUnique({ where: { id } });
  } catch (e) {
    if (!isStaleClientError(e)) throw e;
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM rehab_goals WHERE id = $1', id);
    return mapGoal(rows[0] || null);
  }
}

function mapAppointment(r) {
  if (!r) return null;
  return {
    id: r.id, patientId: r.patientId || r.patient_id, doctorId: r.doctorId || r.doctor_id,
    title: r.title, scheduledAt: r.scheduledAt || r.scheduled_at, status: r.status,
    notes: r.notes || null, createdAt: r.createdAt || r.created_at, updatedAt: r.updatedAt || r.updated_at,
  };
}

async function createAppointmentSafe(prisma, data) {
  try {
    if (!prisma.appointment) throw new TypeError('no model');
    return await prisma.appointment.create({ data });
  } catch (e) {
    if (!isStaleClientError(e)) throw e;
    const id = `tmp_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`;
    await prisma.$executeRawUnsafe(
      'INSERT INTO appointments (id, patient_id, doctor_id, title, scheduled_at, status, notes, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())',
      id, data.patientId, data.doctorId, data.title || 'Follow-up', data.scheduledAt, data.status || 'scheduled', data.notes || null
    );
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM appointments WHERE id = $1', id);
    return mapAppointment(rows[0]);
  }
}

async function listAppointmentsSafe(prisma, where) {
  try {
    if (!prisma.appointment) throw new TypeError('no model');
    return await prisma.appointment.findMany({ where, orderBy: { scheduledAt: 'asc' } });
  } catch (e) {
    if (!isStaleClientError(e)) throw e;
    const conds = [];
    const vals = [];
    let i = 1;
    if (where.patientId) {
      if (typeof where.patientId === 'object' && where.patientId.in) { conds.push(`patient_id = ANY($${i++})`); vals.push(where.patientId.in); }
      else { conds.push(`patient_id = $${i++}`); vals.push(where.patientId); }
    }
    if (where.doctorId) { conds.push(`doctor_id = $${i++}`); vals.push(where.doctorId); }
    if (where.status) {
      if (typeof where.status === 'string') { conds.push(`status = $${i++}`); vals.push(where.status); }
      else if (where.status.in) { conds.push(`status = ANY($${i++})`); vals.push(where.status.in); }
    }
    if (where.scheduledAt?.gte) { conds.push(`scheduled_at >= $${i++}`); vals.push(where.scheduledAt.gte); }
    if (where.scheduledAt?.lte) { conds.push(`scheduled_at <= $${i++}`); vals.push(where.scheduledAt.lte); }
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM appointments${conds.length ? ' WHERE ' + conds.join(' AND ') : ''} ORDER BY scheduled_at ASC`, ...vals
    );
    return rows.map(mapAppointment);
  }
}

async function updateAppointmentSafe(prisma, id, data) {
  try {
    if (!prisma.appointment) throw new TypeError('no model');
    return await prisma.appointment.update({ where: { id }, data });
  } catch (e) {
    if (!isStaleClientError(e)) throw e;
    const sets = [];
    const vals = [];
    let i = 1;
    const col = { title: 'title', scheduledAt: 'scheduled_at', status: 'status', notes: 'notes' };
    for (const [k, c] of Object.entries(col)) {
      if (data[k] !== undefined) { sets.push(`${c} = $${i++}`); vals.push(data[k]); }
    }
    sets.push('updated_at = NOW()');
    vals.push(id);
    await prisma.$executeRawUnsafe(`UPDATE appointments SET ${sets.join(', ')} WHERE id = $${i}`, ...vals);
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM appointments WHERE id = $1', id);
    if (!rows[0]) { const err = new Error('Appointment not found'); err.status = 404; throw err; }
    return mapAppointment(rows[0]);
  }
}

async function findAppointmentSafe(prisma, id) {
  try {
    if (!prisma.appointment) throw new TypeError('no model');
    return await prisma.appointment.findUnique({ where: { id } });
  } catch (e) {
    if (!isStaleClientError(e)) throw e;
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM appointments WHERE id = $1', id);
    return mapAppointment(rows[0] || null);
  }
}

module.exports = { createAssessmentSafe, listAssessmentsSafe, createGoalSafe, listGoalsSafe, updateGoalSafe, findGoalSafe, numOrNull, createAppointmentSafe, listAppointmentsSafe, updateAppointmentSafe, findAppointmentSafe };
