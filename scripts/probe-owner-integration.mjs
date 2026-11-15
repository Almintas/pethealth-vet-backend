const ownerUrl = process.env.OWNER_GRAPHQL_URL ?? 'http://localhost:3000/graphql';
const secret =
  process.env.OWNER_SERVICE_SECRET ?? 'dev-owner-service-secret-change-me';

async function main() {
  try {
    const health = await fetch(ownerUrl.replace('/graphql', '/health').replace('3000', '3000'));
    console.log('health probe url', ownerUrl.replace('/graphql', ''));
  } catch {
    // ignore
  }

  const res = await fetch(ownerUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-pethealth-service-secret': secret,
    },
    body: JSON.stringify({
      query: '{ __typename }',
    }),
  });
  console.log('HTTP status', res.status);
  const body = await res.text();
  console.log('Body', body.slice(0, 500));

  const mutation = `
    mutation InternalRegisterPetForVet($input: InternalRegisterPetForVetInput!) {
      internalRegisterPetForVet(input: $input) { id name }
    }
  `;
  const res2 = await fetch(ownerUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-pethealth-service-secret': secret,
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          owner: {
            email: 'probe-integration@test.pethealth',
            firstName: 'Probe',
            lastName: 'Test',
          },
          name: 'ProbePet',
          species: 'Cat',
        },
      },
    }),
  });
  console.log('Register HTTP status', res2.status);
  console.log('Register body', await res2.text());
}

main().catch((error) => {
  console.error('FAILED', error.cause ?? error.message);
  process.exit(1);
});
