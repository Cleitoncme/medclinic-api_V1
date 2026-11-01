const assert = require('node:assert/strict');
module.exports = async function ({
  urls,
  jwt,
  jwtSecret,
  doctor,
  secondDoctor,
  patients,
  doctorToken,
  query,
}) {
  const token = (id, roles) => jwt.sign({ id, roles }, jwtSecret, { expiresIn: '1h' });
  const admin = token(doctor.user.id, ['admin']);
  const secretary = token(doctor.user.id, ['secretary']);
  const other = token(secondDoctor.user.id, ['doctor']);
  const mixed = token(doctor.user.id, ['admin', 'doctor']);
  const path = '/api/v1/patients/' + patients[0].id + '/medical-records';
  async function request(url = path, auth = doctorToken, payload, server = 0) {
    return fetch(urls[server] + url, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        ...(auth ? { authorization: 'Bearer ' + auth } : {}),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
  }
  assert.equal((await request(path, null)).status, 401);
  assert.equal((await request(path, null, { text: 'a' })).status, 401);
  assert.equal((await request(path, secretary)).status, 403);
  assert.equal((await request(path, secretary, { text: 'a' })).status, 403);
  assert.equal((await request(path, admin, { text: 'a' })).status, 403);
  assert.equal((await request(path, other)).status, 403);
  assert.equal((await request(path, other, { text: 'a' })).status, 403);
  assert.equal((await request(path, doctorToken, { text: '  ' })).status, 400);
  assert.equal((await request('/api/v1/patients/2147483647/medical-records', admin)).status, 404);
  assert.equal(
    (await request('/api/v1/patients/2147483647/medical-records', doctorToken, { text: 'a' }))
      .status,
    404,
  );
  const first = await request(path, doctorToken, {
    text: ' Primeiro registro ',
    doctorId: secondDoctor.id,
  });
  assert.equal(first.status, 201, await first.clone().text());
  const saved = await first.json();
  assert.equal(saved.doctorId, doctor.id);
  assert.equal(saved.patientId, patients[0].id);
  assert.equal(saved.text, 'Primeiro registro');
  assert.ok(saved.createdAt.endsWith('Z'));
  const second = await request(path, mixed, { text: 'Segundo registro' }, 1);
  assert.equal(second.status, 201);
  const firstPage = await request(path + '?pageSize=1', admin);
  assert.equal(firstPage.status, 200);
  const list = await firstPage.json();
  assert.equal(list.meta.total, 2);
  assert.equal(list.data[0].text, 'Segundo registro');
  const page2 = await (await request(path + '?pageSize=1&page=2', doctorToken)).json();
  assert.equal(page2.data[0].id, saved.id);
  assert.equal((await request(path + '?pageSize=101', admin)).status, 400);
  // Isolated fixtures explicitly prove scheduled and cancelled do not grant access.
  const patientId = patients[1].id;
  query('DELETE FROM appointments WHERE patient_id=' + patientId);
  query(
    'INSERT INTO appointments (doctor_id,patient_id,starts_at,ends_at,status) VALUES (' +
      doctor.id +
      ',' +
      patientId +
      ",'2026-10-20T11:00:00Z','2026-10-20T11:30:00Z','scheduled')",
  );
  const otherPath = '/api/v1/patients/' + patientId + '/medical-records';
  assert.equal((await request(otherPath, doctorToken)).status, 403);
  assert.equal((await request(otherPath, doctorToken, { text: 'a' })).status, 403);
  query(
    "UPDATE appointments SET status='cancelled' WHERE doctor_id=" +
      doctor.id +
      ' AND patient_id=' +
      patientId,
  );
  assert.equal((await request(otherPath, doctorToken)).status, 403);
  query(
    "UPDATE appointments SET status='in_progress' WHERE doctor_id=" +
      doctor.id +
      ' AND patient_id=' +
      patientId,
  );
  assert.equal((await request(otherPath, doctorToken, { text: 'Em atendimento' })).status, 201);
  assert.equal((await request(otherPath, doctorToken)).status, 200);
  console.log(
    'OK: prontuario com vinculo in_progress/done, autoria, papeis, paginacao e estados sem vinculo.',
  );
};
