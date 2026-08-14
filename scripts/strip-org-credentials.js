#!/usr/bin/env node
import { readFileSync } from 'fs';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const LEAKED_FIELDS = ['firebaseConfig'];

function parseArgs(argv) {
    const args = { commit: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--commit') args.commit = true;
        else if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
    }
    return args;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args['target-key']) throw new Error('Missing required argument --target-key');

    const serviceAccount = JSON.parse(readFileSync(args['target-key'], 'utf8'));
    const app = initializeApp({ credential: cert(serviceAccount) }, 'strip');
    const firestore = getFirestore(app);

    try {
        const snapshot = await firestore.collection('organizations').get();
        const affected = [];

        for (const document of snapshot.docs) {
            const present = LEAKED_FIELDS.filter(field => document.get(field) !== undefined);
            if (present.length > 0) affected.push({ id: document.id, fields: present });
        }

        if (affected.length === 0) {
            console.log('No organization document exposes credentials. Nothing to do.');
            return;
        }

        console.log('Organization documents exposing credentials:');
        for (const { id, fields } of affected) {
            console.log(`  ${id.padEnd(24)} ${fields.join(', ')}`);
        }

        if (!args.commit) {
            console.log('\nDRY RUN — nothing was changed. Re-run with --commit to remove these fields.');
            return;
        }

        for (const { id, fields } of affected) {
            const removals = Object.fromEntries(fields.map(field => [field, FieldValue.delete()]));
            await firestore.collection('organizations').doc(id).update(removals);
            console.log(`  removed from ${id}`);
        }
        console.log('\nCredentials stripped. The org documents are now safe to expose publicly.');
    } finally {
        await deleteApp(app);
    }
}

main().catch(error => {
    console.error(`\nFailed: ${error.message}`);
    process.exit(1);
});
