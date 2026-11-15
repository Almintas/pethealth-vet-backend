/**
 * Operator tool for vet account approval.
 *
 *   node scripts/approve-veterinarian.mjs --list
 *   node scripts/approve-veterinarian.mjs vet@clinic.lt
 *   node scripts/approve-veterinarian.mjs vet@clinic.lt --reject
 *
 * Verify the veterinarian's licence number (shown by --list) against the
 * official register before approving. Uses MONGODB_URI from the environment.
 */
import { MongoClient } from 'mongodb';

const URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/pethealth_vet_dev';
const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const reject = args.includes('--reject');
const email = args
  .find((arg) => !arg.startsWith('--'))
  ?.trim()
  .toLowerCase();

if (!listOnly && !email) {
  console.error(
    'Usage: node scripts/approve-veterinarian.mjs <email> [--reject] | --list',
  );
  process.exit(1);
}

const client = await MongoClient.connect(URI);
const db = client.db();

try {
  if (listOnly) {
    const users = await db
      .collection('users')
      .find({ approvalStatus: { $ne: 'APPROVED' } })
      .project({ email: 1, role: 1, approvalStatus: 1, createdAt: 1 })
      .toArray();
    const profiles = await db
      .collection('veterinarian_profiles')
      .find({ userId: { $in: users.map((user) => user._id) } })
      .toArray();
    const profileByUser = new Map(
      profiles.map((profile) => [profile.userId.toString(), profile]),
    );
    console.table(
      users.map((user) => {
        const profile = profileByUser.get(user._id.toString());
        return {
          email: user.email,
          name: profile ? `${profile.firstName} ${profile.lastName}` : '',
          licenseNumber: profile?.licenseNumber ?? '',
          status: user.approvalStatus ?? 'PENDING (legacy)',
          registered: user.createdAt?.toISOString?.() ?? '',
        };
      }),
    );
  } else {
    const status = reject ? 'REJECTED' : 'APPROVED';
    const result = await db
      .collection('users')
      .updateOne(
        { email },
        { $set: { approvalStatus: status, updatedAt: new Date() } },
      );
    if (result.matchedCount === 0) {
      console.error(`No vet account found for ${email}`);
      process.exitCode = 1;
    } else {
      console.log(`${email} → ${status}`);
    }
  }
} finally {
  await client.close();
}
