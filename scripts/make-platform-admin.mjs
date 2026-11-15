/**
 * Grants the PetHealth platform admin role to an existing vet-side account,
 * so it can approve or reject veterinarians in the app (Administravimas page).
 * Platform admins have no access to clinics or patient data.
 *
 *   node scripts/make-platform-admin.mjs admin@pethealth.lt
 *
 * Register the account in the vet app first. Uses MONGODB_URI.
 */
import { MongoClient } from 'mongodb';

const URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/pethealth_vet_dev';
const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error('Usage: node scripts/make-platform-admin.mjs <email>');
  process.exit(1);
}

const client = await MongoClient.connect(URI);
try {
  const result = await client
    .db()
    .collection('users')
    .updateOne(
      { email },
      {
        $set: {
          role: 'PLATFORM_ADMIN',
          approvalStatus: 'APPROVED',
          updatedAt: new Date(),
        },
      },
    );
  if (result.matchedCount === 0) {
    console.error(
      `No account found for ${email}. Register it in the vet app first.`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `${email} is now a platform admin. Sign out and back in to see the admin page.`,
    );
  }
} finally {
  await client.close();
}
