const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

const image = process.argv[2] || 'medclinic-api-v1:publicacao';
const prefix = `medclinic-smoke-${process.pid}-${Date.now()}`;
const network = `${prefix}-network`;
const database = `${prefix}-db`;
const apps = [`${prefix}-api-1`, `${prefix}-api-2`];
const started = [];
let networkCreated = false;
const jwtSecret = randomUUID();
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

async function waitFor(check, message) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      if (await check()) return;
    } catch {
      /* Service is starting. */
    }
    await delay(500);
  }
  throw new Error(message);
}
async function login(url) {
  return fetch(`${url}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smoke.test', password: 'test-only-password' }),
    signal: AbortSignal.timeout(5000),
  });
}
async function main() {
  try {
    docker('network', 'create', network);
    networkCreated = true;
    docker(
      'run',
      '--rm',
      '-d',
      '--name',
      database,
      '--network',
      network,
      '--network-alias',
      'smoke-db',
      '-e',
      'POSTGRES_PASSWORD=test-only',
      '-e',
      'POSTGRES_DB=medclinic',
      'postgres:16-alpine',
    );
    started.push(database);
    await waitFor(
      () =>
        docker('exec', database, 'pg_isready', '-U', 'postgres', '-d', 'medclinic').includes(
          'accepting connections',
        ),
      'PostgreSQL não iniciou.',
    );
    // Starting two replicas exercises the migration/seed advisory lock.
    for (const name of apps) {
      docker(
        'run',
        '--rm',
        '-d',
        '--name',
        name,
        '--network',
        network,
        '-p',
        '127.0.0.1::8080',
        '-e',
        'PORT=8080',
        '-e',
        'DATABASE_HOST=smoke-db',
        '-e',
        'DATABASE_PORT=5432',
        '-e',
        'DATABASE_NAME=medclinic',
        '-e',
        'DATABASE_USER=postgres',
        '-e',
        'DATABASE_PASSWORD=test-only',
        '-e',
        'DATABASE_SSL=false',
        '-e',
        `JWT_SECRET=${jwtSecret}`,
        '-e',
        'SEED_ADMIN_ON_START=true',
        '-e',
        'ADMIN_NAME=Smoke Admin',
        '-e',
        'ADMIN_EMAIL=admin@smoke.test',
        '-e',
        'ADMIN_PASSWORD=test-only-password',
        image,
      );
      started.push(name);
    }
    const urls = apps.map((name) => `http://${docker('port', name, '8080/tcp')}`);
    for (const url of urls) {
      await waitFor(
        async () => (await fetch(`${url}/api/v1/health`, { signal: AbortSignal.timeout(2000) })).ok,
        'API não iniciou.',
      );
      const response = await login(url);
      assert.equal(response.status, 200);
      const { accessToken } = await response.json();
      const me = await fetch(`${url}/api/v1/users/me`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      assert.equal(me.status, 200);
      const body = await me.json();
      assert.deepEqual(body.roles, ['admin']);
      assert.equal(body.passwordHash, undefined);
    }
    assert.equal(
      docker(
        'exec',
        database,
        'psql',
        '-U',
        'postgres',
        '-d',
        'medclinic',
        '-tAc',
        'SELECT count(*) FROM migrations',
      ),
      '7',
    );
    assert.equal(
      docker(
        'exec',
        database,
        'psql',
        '-U',
        'postgres',
        '-d',
        'medclinic',
        '-tAc',
        'SELECT count(*) FROM users',
      ),
      '1',
    );
    docker(
      'exec',
      apps[0],
      'node',
      '-e',
      "const assert=require('node:assert/strict');const fs=require('node:fs');assert.notEqual(process.getuid(),0);for(const x of ['typescript','vitest'])assert.throws(()=>require.resolve(x));for(const x of ['.env','tests','src'])assert.equal(fs.existsSync(x),false);",
    );

    const jwt = require('jsonwebtoken');
    const patientToken = (roles) =>
      jwt.sign({ id: 'smoke-user', roles }, jwtSecret, { expiresIn: '1h' });
    async function patientRequest(method, path = '', body, roles = ['admin'], server = 0) {
      return fetch(urls[server] + '/api/v1/patients' + path, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(roles ? { authorization: 'Bearer ' + patientToken(roles) } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }
    const creation = await patientRequest(
      'POST',
      '',
      { name: ' Carlos Silva ', cpf: '00123456789' },
      ['secretary'],
    );
    assert.equal(creation.status, 201);
    const created = await creation.json();
    assert.equal(typeof created.id, 'number');
    assert.equal(created.cpf, '00123456789');
    assert.equal(created.name, 'Carlos Silva');
    assert.ok(created.createdAt.endsWith('Z'));
    assert.equal(
      (await patientRequest('POST', '', { name: 'Blocked', cpf: '11111111111' }, ['doctor']))
        .status,
      403,
    );
    assert.equal((await patientRequest('GET', '', undefined, null)).status, 401);
    assert.equal(
      (await patientRequest('GET', '/' + created.id, undefined, ['doctor'], 1)).status,
      200,
    );
    const found = await patientRequest('GET', '?name=SiLvA&page=1&pageSize=1', undefined, [
      'doctor',
    ]);
    assert.equal(found.status, 200);
    const listing = await found.json();
    assert.equal(listing.data.length, 1);
    assert.deepEqual(listing.meta, { total: 1, page: 1, pageSize: 1, totalPages: 1 });
    const literalName = 'Literal 100%_\\ value';
    assert.equal(
      (await patientRequest('POST', '', { name: literalName, cpf: '11111111111' })).status,
      201,
    );
    const literal = await patientRequest('GET', '?name=' + encodeURIComponent('%_\\'));
    assert.equal((await literal.json()).meta.total, 1);
    const injection = await patientRequest('GET', '?name=' + encodeURIComponent("' OR 1=1 --"));
    assert.equal((await injection.json()).meta.total, 0);
    const parallel = await Promise.all(
      [0, 1].map((server) =>
        patientRequest('POST', '', { name: 'Parallel', cpf: '22222222222' }, ['secretary'], server),
      ),
    );
    assert.deepEqual(parallel.map((r) => r.status).sort(), [201, 409]);
    assert.equal((await parallel.find((r) => r.status === 409).json()).error, 'CPF_JA_CADASTRADO');
    const nextPage = await patientRequest('GET', '?page=2&pageSize=1');
    const nextBody = await nextPage.json();
    assert.equal(nextBody.meta.total, 3);
    assert.equal(nextBody.data.length, 1);
    assert.notEqual(nextBody.data[0].id, created.id);
    const rename = await patientRequest('PATCH', '/' + created.id, { name: 'Atualizado' }, [
      'secretary',
    ]);
    assert.equal(rename.status, 200);
    assert.equal((await rename.json()).cpf, created.cpf);
    assert.equal(
      (await patientRequest('DELETE', '/' + created.id, undefined, ['secretary'])).status,
      403,
    );
    const removal = await patientRequest('DELETE', '/' + created.id);
    assert.equal(removal.status, 204);
    assert.equal(await removal.text(), '');
    assert.equal((await patientRequest('GET', '/' + created.id)).status, 404);
    assert.equal((await patientRequest('PATCH', '/' + created.id, { name: 'Revive' })).status, 404);
    assert.equal((await patientRequest('DELETE', '/' + created.id)).status, 404);
    assert.equal(
      (await patientRequest('POST', '', { name: 'Reserved', cpf: created.cpf })).status,
      409,
    );
    const active = await patientRequest('GET', '');
    assert.equal((await active.json()).meta.total, 2);
    assert.equal(
      docker(
        'exec',
        database,
        'psql',
        '-U',
        'postgres',
        '-d',
        'medclinic',
        '-tAc',
        'SELECT count(*) FROM patients WHERE deleted_at IS NOT NULL',
      ),
      '1',
    );
    console.log(
      'OK: pacientes CRUD, CPF com zeros, filtro literal sem injecao, paginacao, permissoes, soft delete e CPF concorrente 201/409.',
    );

    async function doctorRequest(method, path = '', body, roles = ['admin'], server = 0) {
      return fetch(urls[server] + '/api/v1/doctors' + path, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(roles ? { authorization: 'Bearer ' + patientToken(roles) } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }
    const doctorInput = {
      name: ' Helena %_\\ ',
      email: 'helena@smoke.test',
      password: 'Doctor-test-123',
      crm: 'CRM-SC-1',
    };
    assert.equal((await doctorRequest('POST', '', doctorInput, null)).status, 401);
    for (const roles of [['secretary'], ['doctor']])
      assert.equal((await doctorRequest('POST', '', doctorInput, roles)).status, 403);
    const doctorResponse = await doctorRequest('POST', '', doctorInput);
    assert.equal(doctorResponse.status, 201);
    const doctor = await doctorResponse.json();
    assert.deepEqual(doctor.user.roles, ['doctor']);
    assert.equal(doctor.user.passwordHash, undefined);
    assert.equal(doctor.user.password, undefined);
    const doctorLogin = await fetch(urls[0] + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: doctorInput.email, password: doctorInput.password }),
    });
    assert.equal(doctorLogin.status, 200);
    const doctorToken = (await doctorLogin.json()).accessToken;
    const doctorMe = await fetch(urls[0] + '/api/v1/users/me', {
      headers: { authorization: 'Bearer ' + doctorToken },
    });
    assert.deepEqual((await doctorMe.json()).roles, ['doctor']);
    const duplicate = await doctorRequest('POST', '', {
      ...doctorInput,
      email: 'rollback@smoke.test',
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error, 'CRM_JA_CADASTRADO');
    const rollbackLogin = await fetch(urls[1] + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'rollback@smoke.test', password: doctorInput.password }),
    });
    assert.equal(rollbackLogin.status, 401);
    const duplicateEmail = await doctorRequest('POST', '', { ...doctorInput, crm: 'CRM-SC-2' });
    assert.equal(duplicateEmail.status, 409);
    assert.equal((await duplicateEmail.json()).error, 'EMAIL_JA_CADASTRADO');
    for (const roles of [['admin'], ['secretary'], ['doctor']]) {
      const found = await doctorRequest('GET', '/' + doctor.id, undefined, roles, 1);
      assert.equal(found.status, 200);
      assert.deepEqual(await found.json(), doctor);
    }
    assert.equal((await doctorRequest('GET', '/2147483647')).status, 404);
    assert.equal((await doctorRequest('GET', '/0')).status, 400);
    assert.equal((await doctorRequest('GET', '', undefined, null)).status, 401);
    const filtered = await doctorRequest('GET', '?name=' + encodeURIComponent('%_\\'));
    assert.equal((await filtered.json()).meta.total, 1);
    assert.equal((await (await doctorRequest('GET', '?name=HELENA')).json()).meta.total, 1);
    const race = await Promise.all(
      [0, 1].map((server) =>
        doctorRequest(
          'POST',
          '',
          { ...doctorInput, email: 'race' + server + '@smoke.test', crm: 'CRM-RACE' },
          ['admin'],
          server,
        ),
      ),
    );
    assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
    const raceEmail = await Promise.all(
      [0, 1].map((server) =>
        doctorRequest(
          'POST',
          '',
          { ...doctorInput, email: 'same@smoke.test', crm: 'CRM-EMAIL-' + server },
          ['admin'],
          server,
        ),
      ),
    );
    assert.deepEqual(raceEmail.map((r) => r.status).sort(), [201, 409]);
    const page = await doctorRequest('GET', '?page=2&pageSize=1');
    const pageBody = await page.json();
    assert.equal(pageBody.meta.total, 3);
    assert.equal(pageBody.data.length, 1);
    assert.equal(
      docker(
        'exec',
        database,
        'psql',
        '-U',
        'postgres',
        '-d',
        'medclinic',
        '-tAc',
        "SELECT count(*) FROM users WHERE email = 'rollback@smoke.test'",
      ),
      '0',
    );
    assert.equal(
      docker(
        'exec',
        database,
        'psql',
        '-U',
        'postgres',
        '-d',
        'medclinic',
        '-tAc',
        'SELECT count(*) FROM doctors',
      ),
      '3',
    );
    console.log(
      'OK: medicos, login real, permissoes, filtros, paginacao, rollback de usuario e concorrencia de CRM/email.',
    );
    const schedulePath = '/' + doctor.id + '/work-schedule';
    const shifts = [
      { weekDay: 2, startTime: '08:00', endTime: '12:00', slotDurationMinutes: 30 },
      { weekDay: 2, startTime: '12:00', endTime: '18:00', slotDurationMinutes: 20 },
    ];
    assert.deepEqual(await (await doctorRequest('GET', schedulePath)).json(), { shifts: [] });
    for (const method of ['GET', 'PUT'])
      assert.equal(
        (await doctorRequest(method, schedulePath, method === 'PUT' ? { shifts } : undefined, null))
          .status,
        401,
      );
    for (const roles of [['doctor'], ['secretary']]) {
      assert.equal((await doctorRequest('PUT', schedulePath, { shifts }, roles)).status, 403);
      assert.equal((await doctorRequest('GET', schedulePath, undefined, roles)).status, 200);
    }
    const savedSchedule = await doctorRequest('PUT', schedulePath, { shifts });
    assert.equal(savedSchedule.status, 200);
    assert.deepEqual(await savedSchedule.json(), { shifts });
    assert.deepEqual(
      await (await doctorRequest('GET', schedulePath, undefined, ['doctor'], 1)).json(),
      { shifts },
    );
    const invalidSchedule = await doctorRequest('PUT', schedulePath, {
      shifts: [shifts[0], shifts[0]],
    });
    assert.equal(invalidSchedule.status, 400);
    assert.equal((await invalidSchedule.json()).error, 'DADOS_INVALIDOS');
    assert.deepEqual(await (await doctorRequest('GET', schedulePath)).json(), { shifts });
    for (const method of ['GET', 'PUT'])
      assert.equal(
        (
          await doctorRequest(
            method,
            '/2147483647/work-schedule',
            method === 'PUT' ? { shifts } : undefined,
          )
        ).status,
        404,
      );
    const alternatives = [{ shifts: [shifts[0]] }, { shifts: [shifts[1]] }];
    const concurrent = await Promise.all(
      alternatives.map((body, index) => doctorRequest('PUT', schedulePath, body, ['admin'], index)),
    );
    assert.deepEqual(
      concurrent.map((r) => r.status),
      [200, 200],
    );
    const finalSchedule = await (await doctorRequest('GET', schedulePath)).json();
    assert.ok(
      alternatives.some((body) => require('node:util').isDeepStrictEqual(body, finalSchedule)),
    );
    assert.equal((await doctorRequest('PUT', schedulePath, { shifts: [] })).status, 200);
    assert.deepEqual(await (await doctorRequest('GET', schedulePath)).json(), { shifts: [] });
    console.log(
      'OK: escalas, RBAC, formato, sobreposicao, preservacao apos erro e substituicao concorrente atomica.',
    );
    async function appointmentRequest(body, roles = ['admin'], server = 0) {
      return fetch(urls[server] + '/api/v1/appointments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(roles ? { authorization: 'Bearer ' + patientToken(roles) } : {}),
        },
        body: JSON.stringify(body),
      });
    }
    const patients = [];
    for (let i = 0; i < 4; i++) {
      const response = await patientRequest('POST', '', {
        name: 'Agenda ' + i,
        cpf: '5555555555' + i,
      });
      assert.equal(response.status, 201);
      patients.push(await response.json());
    }
    const doctors = await (await doctorRequest('GET', '?pageSize=100')).json();
    const secondDoctor = doctors.data.find((d) => d.id !== doctor.id);
    const agenda = {
      shifts: [{ weekDay: 2, startTime: '08:00', endTime: '12:00', slotDurationMinutes: 30 }],
    };
    for (const id of [doctor.id, secondDoctor.id])
      assert.equal((await doctorRequest('PUT', '/' + id + '/work-schedule', agenda)).status, 200);
    const appointmentInput = {
      doctorId: doctor.id,
      patientId: patients[0].id,
      startsAt: '2026-10-13T08:00:00-03:00',
    };
    assert.equal((await appointmentRequest(appointmentInput, null)).status, 401);
    assert.equal((await appointmentRequest(appointmentInput, ['doctor'])).status, 403);
    const first = await appointmentRequest(
      { ...appointmentInput, endsAt: '2030-01-01', status: 'done' },
      ['secretary'],
    );
    assert.equal(first.status, 201);
    const appointment = await first.json();
    assert.equal(appointment.startsAt, '2026-10-13T11:00:00.000Z');
    assert.equal(appointment.endsAt, '2026-10-13T11:30:00.000Z');
    assert.equal(appointment.status, 'scheduled');
    async function appointmentError(body, status, code) {
      const response = await appointmentRequest(body);
      assert.equal(response.status, status);
      assert.equal((await response.json()).error, code);
    }
    await appointmentError(
      { ...appointmentInput, doctorId: 2147483647 },
      404,
      'RECURSO_NAO_ENCONTRADO',
    );
    await appointmentError(
      { ...appointmentInput, patientId: created.id },
      404,
      'RECURSO_NAO_ENCONTRADO',
    );
    await appointmentError(
      { ...appointmentInput, startsAt: '2026-10-13T08:00:00' },
      400,
      'DADOS_INVALIDOS',
    );
    await appointmentError(
      { ...appointmentInput, startsAt: '2026-10-13T08:20:00-03:00' },
      422,
      'HORARIO_FORA_DA_ESCALA',
    );
    await appointmentError(appointmentInput, 409, 'HORARIO_INDISPONIVEL');
    await appointmentError(
      { ...appointmentInput, doctorId: secondDoctor.id },
      409,
      'PACIENTE_INDISPONIVEL',
    );
    assert.equal(
      (await appointmentRequest({ ...appointmentInput, startsAt: '2026-10-13T08:30:00-03:00' }))
        .status,
      201,
    );
    const races = await Promise.all(
      [0, 1].map((i) =>
        appointmentRequest(
          {
            ...appointmentInput,
            patientId: patients[i + 1].id,
            startsAt: '2026-10-13T09:00:00-03:00',
          },
          ['secretary'],
          i,
        ),
      ),
    );
    assert.deepEqual(races.map((r) => r.status).sort(), [201, 409]);
    assert.equal((await races.find((r) => r.status === 409).json()).error, 'HORARIO_INDISPONIVEL');
    const patientRace = await Promise.all(
      [doctor.id, secondDoctor.id].map((doctorId, i) =>
        appointmentRequest(
          {
            ...appointmentInput,
            doctorId,
            patientId: patients[3].id,
            startsAt: '2026-10-13T10:00:00-03:00',
          },
          ['admin'],
          i,
        ),
      ),
    );
    assert.deepEqual(patientRace.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      (await patientRace.find((r) => r.status === 409).json()).error,
      'PACIENTE_INDISPONIVEL',
    );
    const query = (sql) =>
      docker('exec', database, 'psql', '-U', 'postgres', '-d', 'medclinic', '-tAc', sql);
    const beforeSchedule = query(
      'SELECT starts_at,ends_at FROM appointments WHERE id=' + appointment.id,
    );
    const shorter = { shifts: [{ ...agenda.shifts[0], slotDurationMinutes: 20 }] };
    assert.equal((await doctorRequest('PUT', schedulePath, shorter)).status, 200);
    await appointmentError(
      { ...appointmentInput, patientId: patients[2].id, startsAt: '2026-10-13T08:20:00-03:00' },
      409,
      'HORARIO_INDISPONIVEL',
    );
    assert.equal(
      query('SELECT starts_at,ends_at FROM appointments WHERE id=' + appointment.id),
      beforeSchedule,
    );
    await require('./smoke-agenda.cjs')({
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
    });
    assert.equal((await appointmentRequest(appointmentInput)).status, 409);
    console.log(
      'OK: agendamentos, fuso, grade, RBAC, conflitos de intervalos, cancelamento e escala sem alterar consulta; corridas medico/paciente 201/409 em duas replicas.',
    );
    await require('./smoke-prontuario.cjs')({
      urls,
      jwt,
      jwtSecret,
      doctor,
      secondDoctor,
      patients,
      doctorToken,
      query,
    });
    docker('restart', apps[0]);
    await waitFor(
      async () => (await login(`http://${docker('port', apps[0], '8080/tcp')}`)).ok,
      'Reinício não preservou o administrador.',
    );
    assert.equal(
      docker(
        'exec',
        database,
        'psql',
        '-U',
        'postgres',
        '-d',
        'medclinic',
        '-tAc',
        'SELECT count(*) FROM users',
      ),
      '4',
    );
    console.log(
      'OK: duas réplicas, migrations únicas, seed idempotente, PORT=8080, health/login/me e reinício.',
    );
    console.log('OK: processo sem root; imagem sem .env, fontes, testes, TypeScript ou Vitest.');
  } finally {
    for (const name of started.reverse()) {
      try {
        docker('stop', '--time', '5', name);
      } catch {
        /* Already stopped. */
      }
    }
    if (networkCreated) {
      try {
        docker('network', 'rm', network);
      } catch {
        /* Report failures below. */
      }
    }
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
