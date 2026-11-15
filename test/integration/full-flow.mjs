/**
 * End-to-end check across BOTH running APIs (owner pethealth-backend and this
 * clinic API). Exercises the flows that unit tests cannot: vet approval,
 * clinic setup, owner consent by share code, clinical data reaching the
 * owner, the activity log, access revocation and clinic team invitations.
 *
 *   OWNER_GRAPHQL_URL=http://localhost:3000/graphql \
 *   VET_GRAPHQL_URL=http://localhost:3001/graphql \
 *   MONGODB_URI=<clinic database> \
 *   node test/integration/full-flow.mjs
 *
 * MONGODB_URI (the clinic database) is used only to grant the platform admin
 * role, the same way an operator would with scripts/make-platform-admin.mjs.
 * Every run uses fresh, unique accounts.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OWNER = process.env.OWNER_GRAPHQL_URL ?? 'http://localhost:3000/graphql';
const VET = process.env.VET_GRAPHQL_URL ?? 'http://localhost:3001/graphql';
const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const PASSWORD = 'Integration-Pass-123';
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let failures = 0;
let stepNumber = 0;

async function request(url, query, variables = {}, token) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, ...body };
}

async function ok(url, query, variables, token) {
  const result = await request(url, query, variables, token);
  if (result.errors?.length || !result.data) {
    throw new Error(
      `Expected success, got: ${JSON.stringify(result.errors ?? result)}`,
    );
  }
  return result.data;
}

async function fails(url, query, variables, token, pattern) {
  const result = await request(url, query, variables, token);
  const messages = (result.errors ?? []).map((error) => error.message).join(' | ');
  if (!result.errors?.length) {
    throw new Error(`Expected an error, got data: ${JSON.stringify(result.data)}`);
  }
  if (pattern && !pattern.test(messages)) {
    throw new Error(`Expected error matching ${pattern}, got: ${messages}`);
  }
  return messages;
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function step(name, fn) {
  stepNumber += 1;
  const label = `${String(stepNumber).padStart(2, '0')}. ${name}`;
  try {
    const value = await fn();
    console.log(`  ok  ${label}`);
    return value;
  } catch (error) {
    failures += 1;
    console.error(`  FAIL ${label}\n       ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

async function waitForApi(url, name) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const result = await request(url, '{ __typename }');
      if (result.data) {
        return;
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${name} did not start at ${url}`);
}

const VET_AUTH = `accessToken user { id email role approvalStatus }`;

async function main() {
  await waitForApi(OWNER, 'Owner API');
  await waitForApi(VET, 'Clinic API');
  console.log(`Running full flow (run id ${RUN})`);

  // --- Vet registration and platform approval -----------------------------
  const vetEmail = `vet-${RUN}@ci.test`;
  const vet = await step('vet registers and is pending approval', async () => {
    const data = await ok(
      VET,
      `mutation ($input: RegisterVeterinarianInput!) { registerVeterinarian(input: $input) { ${VET_AUTH} } }`,
      {
        input: {
          email: vetEmail,
          password: PASSWORD,
          firstName: 'Ona',
          lastName: 'Vet',
          licenseNumber: `VET-${RUN}`,
        },
      },
    );
    expect(data.registerVeterinarian.user.approvalStatus === 'PENDING', 'new vet should be PENDING');
    return { token: data.registerVeterinarian.accessToken, id: data.registerVeterinarian.user.id };
  });

  await step('pending vet cannot create a clinic', () =>
    fails(
      VET,
      `mutation { createClinic(input: { name: "Too early" }) { id } }`,
      {},
      vet.token,
      /awaiting approval/i,
    ),
  );

  const adminEmail = `admin-${RUN}@ci.test`;
  const adminToken = await step('platform admin account is set up', async () => {
    await ok(
      VET,
      `mutation ($input: RegisterVeterinarianInput!) { registerVeterinarian(input: $input) { accessToken } }`,
      {
        input: {
          email: adminEmail,
          password: PASSWORD,
          firstName: 'Platform',
          lastName: 'Admin',
          licenseNumber: 'ADMIN',
        },
      },
    );
    execFileSync(process.execPath, [join(repoRoot, 'scripts/make-platform-admin.mjs'), adminEmail], {
      env: process.env,
      stdio: 'pipe',
    });
    const data = await ok(
      VET,
      `mutation ($input: LoginInput!) { login(input: $input) { ${VET_AUTH} } }`,
      { input: { email: adminEmail, password: PASSWORD } },
    );
    expect(data.login.user.role === 'PLATFORM_ADMIN', 'admin role not granted');
    return data.login.accessToken;
  });

  await step('admin sees the pending vet and approves them', async () => {
    const list = await ok(
      VET,
      `{ adminVeterinarians(status: PENDING) { userId email licenseNumber } }`,
      {},
      adminToken,
    );
    const entry = list.adminVeterinarians.find((account) => account.email === vetEmail);
    expect(entry, 'pending vet missing from admin list');
    expect(entry.licenseNumber === `VET-${RUN}`, 'licence number not shown to admin');
    const approved = await ok(
      VET,
      `mutation ($userId: ID!) { approveVeterinarian(userId: $userId) { approvalStatus } }`,
      { userId: entry.userId },
      adminToken,
    );
    expect(approved.approveVeterinarian.approvalStatus === 'APPROVED', 'not approved');
    const me = await ok(VET, `{ me { approvalStatus } }`, {}, vet.token);
    expect(me.me.approvalStatus === 'APPROVED', 'approval not visible to the vet');
  });

  await step('platform admin has no clinical access', () =>
    fails(VET, `{ myPatients { id } }`, {}, adminToken, /access denied/i),
  );

  // --- Clinic -------------------------------------------------------------
  const clinicId = await step('approved vet creates a clinic and is its admin', async () => {
    const data = await ok(
      VET,
      `mutation { createClinic(input: { name: "CI Clinic ${RUN}", phone: "+37060000000" }) { id myRole } }`,
      {},
      vet.token,
    );
    expect(data.createClinic.myRole === 'ADMIN', `expected ADMIN, got ${data.createClinic.myRole}`);
    return data.createClinic.id;
  });

  // --- Owner and consent ----------------------------------------------------
  const ownerEmail = `owner-${RUN}@ci.test`;
  const ownerToken = await step('owner registers and signs in', async () => {
    await ok(
      OWNER,
      `mutation ($input: RegisterInput!) { register(input: $input) { id } }`,
      { input: { email: ownerEmail, password: PASSWORD, firstName: 'Jane', lastName: 'Owner' } },
    );
    const data = await ok(
      OWNER,
      `mutation ($input: LoginInput!) { login(input: $input) { accessToken } }`,
      { input: { email: ownerEmail, password: PASSWORD } },
    );
    return data.login.accessToken;
  });

  const petId = await step('owner adds a pet', async () => {
    const data = await ok(
      OWNER,
      `mutation { createPet(input: { name: "Luna", species: "Cat" }) { id } }`,
      {},
      ownerToken,
    );
    return data.createPet.id;
  });

  await step('clinic cannot see the pet before consent', () =>
    fails(VET, `query ($id: ID!) { patient(id: $id) { id } }`, { id: petId }, vet.token),
  );

  const code = await step('owner creates a one-time share code', async () => {
    const data = await ok(
      OWNER,
      `mutation ($petId: ID!) { createPetShareCode(petId: $petId) { code expiresAt } }`,
      { petId },
      ownerToken,
    );
    expect(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(data.createPetShareCode.code), 'unexpected code format');
    return data.createPetShareCode.code;
  });

  await step('clinic redeems the code and gets the pet', async () => {
    const data = await ok(
      VET,
      `mutation ($input: ClaimPatientByShareCodeInput!) { claimPatientByShareCode(input: $input) { id name owner { email } } }`,
      { input: { clinicId, code: code.toLowerCase().replace('-', '') } },
      vet.token,
    );
    expect(data.claimPatientByShareCode.id === petId, 'wrong pet returned');
    expect(data.claimPatientByShareCode.owner.email === ownerEmail, 'wrong owner');
  });

  await step('the same code cannot be used again', () =>
    fails(
      VET,
      `mutation ($input: ClaimPatientByShareCodeInput!) { claimPatientByShareCode(input: $input) { id } }`,
      { input: { clinicId, code } },
      vet.token,
      /invalid or has expired/i,
    ),
  );

  await step('clinic cannot change the owner’s sign-in email', () =>
    fails(
      VET,
      `mutation ($id: ID!, $input: UpdatePatientInput!) { updatePatient(id: $id, input: $input) { id } }`,
      {
        id: petId,
        input: {
          name: 'Luna',
          species: 'Cat',
          owner: { firstName: 'Jane', lastName: 'Owner', email: `attacker-${RUN}@ci.test` },
        },
      },
      vet.token,
      /manages their own account/i,
    ),
  );

  // --- Clinical data reaches the owner --------------------------------------
  await step('clinic records a vaccination', async () => {
    await ok(
      VET,
      `mutation ($input: CreateVetVaccinationInput!) { createVetVaccination(input: $input) { id } }`,
      {
        input: {
          clinicId,
          petId,
          vaccineName: 'Rabies',
          administeredAt: new Date().toISOString(),
        },
      },
      vet.token,
    );
    await ok(VET, `query ($id: ID!) { patient(id: $id) { id } }`, { id: petId }, vet.token);
  });

  await step('owner sees the vaccination with the clinic name', async () => {
    const data = await ok(
      OWNER,
      `query ($petId: ID!) { vaccinations(petId: $petId) { vaccineName clinicName veterinarianName } }`,
      { petId },
      ownerToken,
    );
    const rabies = data.vaccinations.find((v) => v.vaccineName === 'Rabies');
    expect(rabies, 'vaccination missing on the owner side');
    expect(rabies.clinicName === `CI Clinic ${RUN}`, `clinic name was ${rabies.clinicName}`);
    expect(rabies.veterinarianName === 'Ona Vet', `vet name was ${rabies.veterinarianName}`);
  });

  await step('owner sees clinic access and the activity log', async () => {
    const access = await ok(
      OWNER,
      `query ($petId: ID!) { petClinicAccess(petId: $petId) { clinicId clinicName } }`,
      { petId },
      ownerToken,
    );
    expect(
      access.petClinicAccess.some((entry) => entry.clinicId === clinicId),
      'clinic missing from owner access list',
    );
    const log = await ok(
      OWNER,
      `query ($petId: ID!) { petActivityLog(petId: $petId) { action entityType actorName clinicName summary } }`,
      { petId },
      ownerToken,
    );
    const has = (action, entityType) =>
      log.petActivityLog.some((e) => e.action === action && e.entityType === entityType);
    expect(has('ACCESS_GRANTED', 'PATIENT'), 'activity log lacks ACCESS_GRANTED');
    expect(has('CREATED', 'VACCINATION'), 'activity log lacks the vaccination');
    expect(has('VIEWED', 'PATIENT'), 'activity log lacks the view');
    expect(
      log.petActivityLog.every((e) => e.actorName === 'Ona Vet' && e.clinicName === `CI Clinic ${RUN}`),
      'activity log has wrong actor or clinic names',
    );
  });

  // --- Clinic team -------------------------------------------------------------
  const deskEmail = `desk-${RUN}@ci.test`;
  const inviteToken = await step('clinic admin invites a receptionist', async () => {
    const data = await ok(
      VET,
      `mutation ($input: CreateClinicInvitationInput!) { inviteClinicMember(input: $input) { inviteUrl emailSent } }`,
      { input: { clinicId, email: deskEmail, role: 'RECEPTIONIST' } },
      vet.token,
    );
    const token = new URL(data.inviteClinicMember.inviteUrl).searchParams.get('token');
    expect(token, 'invite URL has no token');
    const preview = await ok(
      VET,
      `query ($token: String!) { clinicInvitationPreview(token: $token) { state role email accountExists } }`,
      { token },
    );
    expect(preview.clinicInvitationPreview.state === 'VALID', 'invitation not valid');
    expect(preview.clinicInvitationPreview.email === deskEmail, 'wrong invited email');
    expect(preview.clinicInvitationPreview.accountExists === false, 'account should not exist yet');
    return token;
  });

  const deskToken = await step('receptionist creates an account from the invitation', async () => {
    const data = await ok(
      VET,
      `mutation ($input: RegisterWithInvitationInput!) { registerWithInvitation(input: $input) { ${VET_AUTH} } }`,
      { input: { token: inviteToken, password: PASSWORD, firstName: 'Rita', lastName: 'Desk' } },
    );
    expect(data.registerWithInvitation.user.role === 'RECEPTIONIST', 'wrong role');
    expect(data.registerWithInvitation.user.approvalStatus === 'APPROVED', 'receptionist should be approved');
    return data.registerWithInvitation.accessToken;
  });

  await step('the invitation cannot be used twice', () =>
    fails(
      VET,
      `mutation ($input: RegisterWithInvitationInput!) { registerWithInvitation(input: $input) { accessToken } }`,
      { input: { token: inviteToken, password: PASSWORD, firstName: 'X', lastName: 'Y' } },
      undefined,
      /invalid or has expired/i,
    ),
  );

  await step('receptionist works in the clinic but cannot manage the team', async () => {
    const clinics = await ok(VET, `{ myClinics { id myRole } }`, {}, deskToken);
    expect(
      clinics.myClinics.some((c) => c.id === clinicId && c.myRole === 'RECEPTIONIST'),
      'receptionist not in the clinic',
    );
    const patient = await ok(VET, `query ($id: ID!) { patient(id: $id) { name } }`, { id: petId }, deskToken);
    expect(patient.patient.name === 'Luna', 'receptionist cannot see the clinic patient');
    await fails(
      VET,
      `mutation ($input: CreateClinicInvitationInput!) { inviteClinicMember(input: $input) { inviteUrl } }`,
      { input: { clinicId, email: `x-${RUN}@ci.test`, role: 'VETERINARIAN' } },
      deskToken,
      /only clinic administrators/i,
    );
    const members = await ok(
      VET,
      `query ($clinicId: ID!) { clinicMembers(clinicId: $clinicId) { email role } }`,
      { clinicId },
      vet.token,
    );
    expect(members.clinicMembers.length === 2, `expected 2 members, got ${members.clinicMembers.length}`);
  });

  await step('the only clinic admin cannot be removed', async () => {
    const members = await ok(
      VET,
      `query ($clinicId: ID!) { clinicMembers(clinicId: $clinicId) { membershipId isMe role } }`,
      { clinicId },
      vet.token,
    );
    const me = members.clinicMembers.find((m) => m.isMe);
    await fails(
      VET,
      `mutation ($clinicId: ID!, $membershipId: ID!) { removeClinicMember(clinicId: $clinicId, membershipId: $membershipId) }`,
      { clinicId, membershipId: me.membershipId },
      vet.token,
      /at least one administrator/i,
    );
  });

  // --- Revocation -----------------------------------------------------------
  await step('owner revokes the clinic’s access', async () => {
    const data = await ok(
      OWNER,
      `mutation ($petId: ID!, $clinicId: ID!) { revokePetClinicAccess(petId: $petId, clinicId: $clinicId) }`,
      { petId, clinicId },
      ownerToken,
    );
    expect(data.revokePetClinicAccess === true, 'revoke returned false');
  });

  await step('clinic staff can no longer see the pet', async () => {
    await fails(VET, `query ($id: ID!) { patient(id: $id) { id } }`, { id: petId }, vet.token);
    await fails(VET, `query ($id: ID!) { patient(id: $id) { id } }`, { id: petId }, deskToken);
  });

  await step('the revocation appears in the owner’s activity log', async () => {
    const log = await ok(
      OWNER,
      `query ($petId: ID!) { petActivityLog(petId: $petId) { action actorType } }`,
      { petId },
      ownerToken,
    );
    expect(
      log.petActivityLog.some((e) => e.action === 'ACCESS_REVOKED' && e.actorType === 'OWNER'),
      'owner revocation missing from the activity log',
    );
  });

  console.log(`\nAll ${stepNumber} steps passed.`);
}

main().catch((error) => {
  if (failures === 0) {
    console.error(`\nIntegration run crashed: ${error instanceof Error ? error.stack : error}`);
  } else {
    console.error(`\nIntegration flow failed at step ${stepNumber}.`);
  }
  process.exit(1);
});
