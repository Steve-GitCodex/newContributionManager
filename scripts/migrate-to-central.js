#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { transformAll, toFirestoreDocuments, chunk } from './migrate/transform.js';

const LEGACY_NODES = ['contributionsData', 'blacklistData', 'specialGiving', 'users', 'budgets'];
const BATCH_LIMIT = 450;

function parseArgs(argv) {
    const args = { commit: false, force: false };
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--commit') args.commit = true;
        else if (token === '--force') args.force = true;
        else if (token.startsWith('--')) args[token.slice(2)] = argv[++i];
    }
    return args;
}

function requireArg(args, name) {
    if (!args[name]) {
        throw new Error(`Missing required argument --${name}`);
    }
    return args[name];
}

function connectSource(serviceAccountPath, databaseURL) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    const app = initializeApp({ credential: cert(serviceAccount), databaseURL }, 'source');
    return { app, projectId: serviceAccount.project_id, db: getDatabase(app) };
}

function connectTarget(serviceAccountPath) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    const app = initializeApp({ credential: cert(serviceAccount) }, 'target');
    return { app, projectId: serviceAccount.project_id, firestore: getFirestore(app) };
}

async function readLegacy(source) {
    const root = source.db.ref();
    const legacy = {};
    for (const node of LEGACY_NODES) {
        const snapshot = await root.child(node).once('value');
        legacy[node] = snapshot.val() || {};
    }
    return legacy;
}

async function assertTargetEmpty(target, slug, force) {
    const existing = await target.firestore
        .collection('organizations').doc(slug)
        .collection('contributions').limit(1).get();

    if (existing.empty) return;

    if (!force) {
        throw new Error(
            `Target organizations/${slug} already has contributions. Refusing to overwrite. ` +
            `Re-run with --force only if you intend to replace it.`
        );
    }
    console.warn(`WARNING: overwriting existing data at organizations/${slug}`);
}

async function writeDocuments(target, documents) {
    const batches = chunk(documents, BATCH_LIMIT);
    let written = 0;

    for (const [index, group] of batches.entries()) {
        const batch = target.firestore.batch();
        for (const { path, data } of group) {
            batch.set(target.firestore.doc(path), data);
        }
        await batch.commit();
        written += group.length;
        console.log(`  batch ${index + 1}/${batches.length} — ${written}/${documents.length} documents`);
    }
}

function report(stats, warnings) {
    console.log('\nTransform summary');
    for (const [key, value] of Object.entries(stats)) {
        console.log(`  ${key.padEnd(22)} ${value}`);
    }

    if (warnings.length === 0) {
        console.log('\nNo warnings — every source record was accounted for.');
        return;
    }

    console.log(`\n${warnings.length} warning(s) — these records were NOT migrated:`);
    for (const warning of warnings) {
        console.log(`  ${JSON.stringify(warning)}`);
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const slug = requireArg(args, 'slug');
    const sourceKey = requireArg(args, 'source-key');
    const sourceDb = requireArg(args, 'source-db');
    const targetKey = requireArg(args, 'target-key');

    const source = connectSource(sourceKey, sourceDb);
    const target = connectTarget(targetKey);

    try {
        console.log(`Reading legacy data from ${sourceDb}`);
        const legacy = await readLegacy(source);

        if (Object.keys(legacy.contributionsData).length === 0) {
            throw new Error('Source has no contributionsData — nothing to migrate. Check --source-db.');
        }

        const { payload, stats, warnings } = transformAll({
            ...legacy,
            sourceProjectId: source.projectId
        });

        report(stats, warnings);

        const documents = toFirestoreDocuments(payload, slug);
        console.log(`\n  ${documents.length} Firestore documents in ${chunk(documents, BATCH_LIMIT).length} batch(es)`);

        const outPath = args.out || 'migration-payload.json';
        writeFileSync(outPath, JSON.stringify(documents, null, 2));
        console.log(`  Documents written to ${outPath} for inspection.`);

        if (!args.commit) {
            console.log('\nDRY RUN — nothing was written. Re-run with --commit to apply.');
            return;
        }

        await assertTargetEmpty(target, slug, args.force);

        console.log(`\nWriting to Firestore in ${target.projectId} under organizations/${slug}`);
        await writeDocuments(target, documents);
        console.log('\nMigration committed.');
        console.log(`Next: point the app at organizations/${slug} and deploy the membership rules.`);
    } finally {
        await Promise.all([deleteApp(source.app), deleteApp(target.app)]);
    }
}

main().catch(error => {
    console.error(`\nMigration failed: ${error.message}`);
    process.exit(1);
});
