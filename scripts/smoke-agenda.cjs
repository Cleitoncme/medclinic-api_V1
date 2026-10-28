const assert = require('node:assert/strict');
module.exports = async function ({
  urls,
  jwt,
  jwtSecret,
  doctor,
  secondDoctor,
  appointment,
  appointmentInput,
  appointmentRequest,
  query,
  doctorToken,
}) {
  const token = (id, roles) => jwt.sign({ id, roles }, jwtSecret, { expiresIn: '1h' });
  const admin = token(doctor.user.id, ['admin']);
  const secretary = token(doctor.user.id, ['secretary']);
  const other = token(secondDoctor.user.id, ['doctor']);
  async function request(path, auth = admin, status, server = 0) {
    return fetch(urls[server] + '/api/v1/' + path + (status === undefined ? '' : '/status'), {
      method: status === undefined ? 'GET' : 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(auth ? { authorization: 'Bearer ' + auth } : {}),
      },
      ...(status === undefined ? {} : { body: JSON.stringify({ status }) }),
    });
  }
  async function body(path, auth = admin) {
    const r = await request(path, auth);
    assert.equal(r.status, 200, await r.clone().text());
    return r.json();
  }
  const path = 'appointments/' + appointment.id;
  for (const p of [
    'appointments',
    path,
    'doctors/' + doctor.id + '/calendar?from=2026-10-13&to=2026-10-13',
  ])
    assert.equal((await request(p, null)).status, 401);
  assert.equal((await request(path, null, 'cancelled')).status, 401);
  assert.equal((await request(path, other)).status, 403);
  assert.equal((await body(path, doctorToken)).id, appointment.id);
  assert.equal((await request('appointments/2147483647')).status, 404);
  assert.equal((await request('appointments/2147483647', admin, 'cancelled')).status, 404);
  assert.equal((await request(path, admin, 'invalid')).status, 400);
  assert.equal((await request(path, admin, 'done')).status, 422);
  assert.equal((await request(path, other, 'cancelled')).status, 403);
  assert.equal((await request(path, secretary, 'in_progress')).status, 403);
  const own = await body('appointments?pageSize=100', doctorToken);
  assert.ok(own.data.length > 0);
  assert.ok(own.data.every((a) => a.doctorId === doctor.id));
  assert.equal((await body('appointments?doctorId=' + secondDoctor.id, doctorToken)).meta.total, 0);
  const filter =
    'appointments?doctorId=' +
    doctor.id +
    '&patientId=' +
    appointment.patientId +
    '&status=scheduled&from=2026-10-13&to=2026-10-13&pageSize=1';
  const first = await body(filter);
  const next = await body(filter + '&page=2');
  assert.equal(first.meta.total, 2);
  assert.equal(first.data.length, 1);
  assert.equal(next.data.length, 1);
  assert.notEqual(first.data[0].id, next.data[0].id);
  assert.equal((await body('appointments?to=2026-10-12')).meta.total, 0);
  assert.equal((await body('appointments?from=2026-10-14')).meta.total, 0);
  for (const q of ['from=2026-02-30', 'status=no', 'doctorId=0', 'from=2026-10-14&to=2026-10-13'])
    assert.equal((await request('appointments?' + q)).status, 400);
  const calendar = 'doctors/' + doctor.id + '/calendar';
  assert.equal((await request(calendar + '?from=2026-10-01&to=2026-11-01')).status, 400);
  assert.equal((await request(calendar)).status, 400);
  assert.equal(
    (await request('doctors/2147483647/calendar?from=2026-10-13&to=2026-10-13')).status,
    404,
  );
  const before = await body(calendar + '?from=2026-10-01&to=2026-10-31');
  assert.ok(before.appointments.some((a) => a.id === appointment.id));
  assert.equal(before.workSchedule.shifts[0].slotDurationMinutes, 20);
  assert.equal((await request(path, secretary, 'cancelled')).status, 200);
  assert.equal(query('SELECT status FROM appointments WHERE id=' + appointment.id), 'cancelled');
  assert.equal((await request(path, admin, 'scheduled')).status, 422);
  const after = await body(calendar + '?from=2026-10-13&to=2026-10-13');
  assert.ok(!after.appointments.some((a) => a.id === appointment.id));
  const recreated = await appointmentRequest(appointmentInput);
  assert.equal(recreated.status, 201);
  const replacement = await recreated.json();
  const replacementPath = 'appointments/' + replacement.id;
  const race = await Promise.all(
    [0, 1].map((server) => request(replacementPath, doctorToken, 'in_progress', server)),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 422]);
  assert.equal((await request(replacementPath, secretary, 'cancelled')).status, 403);
  assert.equal((await request(replacementPath, doctorToken, 'done')).status, 200);
  assert.equal((await request(replacementPath, admin, 'cancelled')).status, 422);
  const done = await body(replacementPath);
  assert.equal(done.startsAt, replacement.startsAt);
  assert.equal(done.endsAt, replacement.endsAt);
  // Boundary fixtures are isolated to this temporary database, independent of working shifts.
  const ids = query(
    'INSERT INTO appointments (doctor_id,patient_id,starts_at,ends_at,status) VALUES (' +
      doctor.id +
      ',' +
      appointment.patientId +
      ",'2026-10-14T02:59:00Z','2026-10-14T03:00:00Z','scheduled'),(" +
      doctor.id +
      ',' +
      appointment.patientId +
      ",'2026-10-14T03:00:00Z','2026-10-14T03:01:00Z','scheduled') RETURNING id",
  )
    .split(/\s+/)
    .filter((x) => /^\d+$/.test(x))
    .slice(0, 2)
    .map(Number);
  const day = await body(calendar + '?from=2026-10-13&to=2026-10-13');
  assert.ok(day.appointments.some((a) => a.id === ids[0]));
  assert.ok(!day.appointments.some((a) => a.id === ids[1]));
  assert.equal((await request('appointments/' + ids[0], admin, 'in_progress')).status, 200);
  assert.equal((await request('appointments/' + ids[0], admin, 'cancelled')).status, 200);
  console.log(
    'OK: agenda, filtros combinados, paginacao, posse, limites locais, transicoes, cancelamento e corrida de status 200/422.',
  );
};
