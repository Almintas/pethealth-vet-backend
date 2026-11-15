import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/pethealth_vet_dev';
const CLINIC_NAME = 'PetHealth Vet Demo Clinic';

const client = await MongoClient.connect(URI);
const db = client.db();

const profile = await db.collection('veterinarian_profiles').findOne({});
if (!profile) {
  console.error('No veterinarian profile found. Register a vet user first.');
  process.exit(1);
}

const now = new Date();

// Demo convenience: the seeded vet must be approved to use the clinic.
await db
  .collection('users')
  .updateOne(
    { _id: profile.userId },
    { $set: { approvalStatus: 'APPROVED', updatedAt: now } },
  );
let clinic = await db.collection('clinics').findOne({ name: CLINIC_NAME });

if (!clinic) {
  const { insertedId } = await db.collection('clinics').insertOne({
    name: CLINIC_NAME,
    email: 'demo@pethealth.vet',
    createdAt: now,
    updatedAt: now,
  });
  clinic = { _id: insertedId, name: CLINIC_NAME };
  console.log('Created clinic:', insertedId.toString());
} else {
  console.log('Clinic already exists:', clinic._id.toString());
}

const existing = await db.collection('clinic_memberships').findOne({
  veterinarianProfileId: profile._id,
  clinicId: clinic._id,
});

if (!existing) {
  await db.collection('clinic_memberships').insertOne({
    veterinarianProfileId: profile._id,
    clinicId: clinic._id,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
  console.log('Created ACTIVE membership for profile', profile._id.toString());
} else if (existing.status !== 'ACTIVE') {
  await db.collection('clinic_memberships').updateOne(
    { _id: existing._id },
    { $set: { status: 'ACTIVE', updatedAt: now } },
  );
  console.log('Reactivated membership');
} else {
  console.log('Membership already ACTIVE');
}

const user = await db.collection('users').findOne({ _id: profile.userId });
console.log(
  JSON.stringify(
    {
      vetEmail: user?.email,
      veterinarianProfileId: profile._id.toString(),
      clinicId: clinic._id.toString(),
      clinicName: clinic.name,
    },
    null,
    2,
  ),
);

await client.close();
