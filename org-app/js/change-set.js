// What Firestore holds for the scopes this session loaded. Saving diffs against it,
// so an unloaded record produces neither a write nor a delete.

const ChangeSet = (function () {
    function canonicalize(value) {
        if (Array.isArray(value)) return value.map(canonicalize);
        if (value && typeof value === 'object') {
            return Object.keys(value).sort().map(key => [key, canonicalize(value[key])]);
        }
        return value;
    }

    function fingerprint(record) {
        const source = record || {};
        const keys = Object.keys(source).filter(key => key !== 'id').sort();
        return JSON.stringify(keys.map(key => [key, canonicalize(source[key])]));
    }

    function capture(records) {
        const baseline = {};
        for (const record of records || []) {
            if (record && record.id) baseline[record.id] = fingerprint(record);
        }
        return baseline;
    }

    function captureMap(recordsById) {
        const baseline = {};
        for (const id of Object.keys(recordsById || {})) {
            baseline[id] = fingerprint(recordsById[id]);
        }
        return baseline;
    }

    function diff(baseline, records) {
        const known = baseline || {};
        const writes = [];
        const present = new Set();

        for (const record of records || []) {
            if (!record || !record.id) continue;
            present.add(record.id);
            if (known[record.id] !== fingerprint(record)) writes.push(record);
        }

        return { writes, deletes: Object.keys(known).filter(id => !present.has(id)) };
    }

    return { capture, captureMap, diff };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChangeSet;
}
