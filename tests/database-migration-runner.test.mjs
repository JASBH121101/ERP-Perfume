import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMigrationPlan,
  classifyDatabaseState,
  classifyLedgerLineage,
  verifyLedgerChecksum,
  verifyPostApplyLedger,
  validateConnectionTarget,
  validateOperatorApproval,
  validateHistoricalBaselineAudit
} from "../scripts/migrate-db.mjs";
import { createHash } from "node:crypto";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function gitBlobSha1(bytes) {
  return createHash("sha1").update(Buffer.from("blob " + bytes.length + "\0")).update(bytes).digest("hex");
}

test("post-apply ledger verifier accepts the exact expected source set", () => {
  const initialLedgerRows = [
    { version: "0001", filename: "0001_initial.sql", checksum: "legacy-source-checksum" }
  ];
  const plannedMigrations = [
    { version: "0002", filename: "0002_additive.sql", sha256: "sha256-source-checksum" }
  ];
  const finalLedgerRows = [
    { version: "0001", filename: "0001_initial.sql", checksum: "legacy-source-checksum" },
    { version: "0002", filename: "0002_additive.sql", checksum: "sha256-source-checksum" }
  ];
  assert.equal(verifyPostApplyLedger({ initialLedgerRows, plannedMigrations, finalLedgerRows }), true);
});

test("post-apply ledger verifier rejects missing, extra, duplicate and altered rows", () => {
  const initialLedgerRows = [
    { version: "0001", filename: "0001_initial.sql", checksum: "legacy-source-checksum" }
  ];
  const plannedMigrations = [
    { version: "0002", filename: "0002_additive.sql", sha256: "sha256-source-checksum" }
  ];
  const valid = [
    { version: "0001", filename: "0001_initial.sql", checksum: "legacy-source-checksum" },
    { version: "0002", filename: "0002_additive.sql", checksum: "sha256-source-checksum" }
  ];

  assert.throws(() => verifyPostApplyLedger({
    initialLedgerRows, plannedMigrations, finalLedgerRows: valid.slice(0, 1)
  }), /row count mismatch/i);
  assert.throws(() => verifyPostApplyLedger({
    initialLedgerRows, plannedMigrations, finalLedgerRows: [...valid, {
      version: "0003", filename: "0003_unplanned.sql", checksum: "extra"
    }]
  }), /row count mismatch/i);
  assert.throws(() => verifyPostApplyLedger({
    initialLedgerRows, plannedMigrations, finalLedgerRows: [...valid, valid[1]]
  }), /duplicate version 0002/i);
  assert.throws(() => verifyPostApplyLedger({
    initialLedgerRows, plannedMigrations, finalLedgerRows: [
      valid[0], { ...valid[1], filename: "renamed.sql" }
    ]
  }), /filename mismatch/i);
  assert.throws(() => verifyPostApplyLedger({
    initialLedgerRows, plannedMigrations, finalLedgerRows: [
      valid[0], { ...valid[1], checksum: "wrong-checksum" }
    ]
  }), /checksum mismatch/i);
});

test("fresh database requires no pre-existing application tables or ledger rows", () => {
  assert.equal(classifyDatabaseState({
    ledgerExists: false,
    ledgerRows: [],
    applicationTableCount: 0
  }), "fresh");
  assert.throws(() => classifyDatabaseState({
    ledgerExists: false,
    ledgerRows: [],
    applicationTableCount: 3
  }), /baseline/i);
});

test("an empty ledger is not accepted when application tables already exist", () => {
  assert.throws(() => classifyDatabaseState({
    ledgerExists: true,
    ledgerRows: [],
    applicationTableCount: 38
  }), /empty/i);
});

test("migration plan includes every source on a clean install", () => {
  const migrations = [
    { version: "0001", filename: "0001_initial.sql" },
    { version: "0002", filename: "0002_next.sql" }
  ];
  assert.deepEqual(buildMigrationPlan({ migrations, ledgerRows: [], freshInstall: true }), migrations);
});

test("migration plan skips exact ledgered versions and leaves only pending sources", () => {
  const migrations = [
    { version: "0001", filename: "0001_initial.sql" },
    { version: "0002", filename: "0002_next.sql" }
  ];
  const ledgerRows = [{
    version: "0001",
    filename: "0001_initial.sql",
    checksum: "sha"
  }];
  assert.deepEqual(
    buildMigrationPlan({ migrations, ledgerRows, freshInstall: false }).map(item => item.version),
    ["0002"]
  );
});

test("migration plan rejects unknown or renamed ledger entries", () => {
  const migrations = [{ version: "0001", filename: "0001_initial.sql" }];
  assert.throws(() => buildMigrationPlan({
    migrations,
    ledgerRows: [{ version: "0009", filename: "0009_missing.sql" }],
    freshInstall: false
  }), /untracked/i);
  assert.throws(() => buildMigrationPlan({
    migrations,
    ledgerRows: [{ version: "0001", filename: "renamed.sql" }],
    freshInstall: false
  }), /filename mismatch/i);
});

test("checksum verifier recognizes only explicit source provenance strategies", () => {
  const bytes = Buffer.from("SELECT 1;\n");
  const checksum = sha256(bytes);
  const gitChecksum = gitBlobSha1(bytes);
  const contentSha1 = createHash("sha1").update(bytes).digest("hex");
  assert.equal(verifyLedgerChecksum({
    migration: { sha256: checksum, database: { status: "applied_checksum_verified" } },
    ledgerChecksum: checksum,
    currentBytes: bytes
  }), true);
  assert.equal(verifyLedgerChecksum({
    migration: { sha256: checksum, database: { status: "applied_git_blob_verified" } },
    ledgerChecksum: gitChecksum,
    currentBytes: bytes
  }), true);
  assert.equal(verifyLedgerChecksum({
    migration: { sha256: checksum, database: { status: "applied_content_sha1_verified" } },
    ledgerChecksum: contentSha1,
    currentBytes: bytes
  }), true);
  assert.equal(verifyLedgerChecksum({
    migration: { sha256: checksum, database: { status: "applied_legacy_unverified" } },
    ledgerChecksum: contentSha1,
    currentBytes: bytes
  }), false);
  assert.equal(verifyLedgerChecksum({
    migration: { sha256: checksum, database: { status: "applied_checksum_verified" } },
    ledgerChecksum: "wrong",
    currentBytes: bytes
  }), false);
});


test("a clean-install SHA-256 ledger is resumable as a contiguous prefix", () => {
  const migrations = [
    { version: "0001", filename: "0001_initial.sql", sha256: "hash-a", database: { status: "pending" } },
    { version: "0002", filename: "0002_next.sql", sha256: "hash-b", database: { status: "pending" } }
  ];
  const result = classifyLedgerLineage({
    manifest: { snapshot: { ledgerVersions: ["0001", "0002"] }, migrations: [] },
    migrations,
    ledgerRows: [{ version: "0001", filename: "0001_initial.sql", checksum: "hash-a" }]
  });
  assert.equal(result.type, "clean-install");
  assert.deepEqual(result.blockers, []);
});

test("the existing Development snapshot remains blocked by unresolved history", () => {
  const migrations = [{ version: "0001", filename: "0001_initial.sql", sha256: "hash-a" }];
  const result = classifyLedgerLineage({
    manifest: {
      snapshot: { ledgerVersions: ["0001"] },
      migrations: [{
        version: "0001",
        database: { status: "applied_legacy_unverified" }
      }]
    },
    migrations,
    ledgerRows: [{ version: "0001", filename: "0001_initial.sql", checksum: "old-hash" }]
  });
  assert.equal(result.type, "development-snapshot");
  assert.equal(result.blockers.length, 1);
});

test("an unrelated ledger is rejected rather than guessed", () => {
  const result = classifyLedgerLineage({
    manifest: { snapshot: { ledgerVersions: ["0001"] }, migrations: [] },
    migrations: [{ version: "0001", filename: "0001_initial.sql", sha256: "hash-a" }],
    ledgerRows: [{ version: "0002", filename: "0002_other.sql", checksum: "hash-b" }]
  });
  assert.equal(result.type, "unrecognized");
  assert.equal(result.blockers.length, 1);
});


const migrationManifest = {
  snapshot: {
    branch: "development",
    branchId: "br-development-pinned",
    developmentEndpointHost: "ep-development-pinned.c-9.us-east-2.aws.neon.tech",
    productionEndpointHost: "ep-production-protected.c-9.us-east-2.aws.neon.tech"
  }
};

function validEnvironment(overrides = {}) {
  return {
    ERP_ENVIRONMENT: "development",
    ERP_MIGRATION_BRANCH: "development",
    ERP_MIGRATION_BRANCH_ID: "br-development-pinned",
    ERP_EXPECTED_NEON_ENDPOINT_HOST: "ep-development-pinned.c-9.us-east-2.aws.neon.tech",
    ERP_MIGRATIONS_APPROVED: "YES",
    ...overrides
  };
}

test("migration target accepts only the exact pinned Development endpoint", () => {
  const uri = "postgresql://erp_owner:test@ep-development-pinned.c-9.us-east-2.aws.neon.tech/erp_perfume";
  assert.equal(
    validateConnectionTarget(uri, migrationManifest, validEnvironment()).hostname,
    "ep-development-pinned.c-9.us-east-2.aws.neon.tech"
  );
});

test("migration target rejects the protected Production endpoint", () => {
  const uri = "postgresql://erp_owner:test@ep-production-protected.c-9.us-east-2.aws.neon.tech/erp_perfume";
  assert.throws(
    () => validateConnectionTarget(uri, migrationManifest, validEnvironment({
      ERP_EXPECTED_NEON_ENDPOINT_HOST: "ep-production-protected.c-9.us-east-2.aws.neon.tech"
    })),
    /Production.*blocked/i
  );
});

test("migration target rejects a different Neon endpoint even when it is not a pooler", () => {
  const uri = "postgresql://erp_owner:test@other-project.c-9.us-east-2.aws.neon.tech/erp_perfume";
  assert.throws(
    () => validateConnectionTarget(uri, migrationManifest, validEnvironment()),
    /exactly match.*Development endpoint/i
  );
});

test("migration target rejects pooled endpoints for session advisory locks", () => {
  const uri = "postgresql://erp_owner:test@ep-development-pinned-pooler.c-9.us-east-2.aws.neon.tech/erp_perfume";
  assert.throws(
    () => validateConnectionTarget(uri, migrationManifest, validEnvironment({
      ERP_EXPECTED_NEON_ENDPOINT_HOST: "ep-development-pinned-pooler.c-9.us-east-2.aws.neon.tech"
    })),
    /pooled.*endpoint/i
  );
});

test("migration approval requires the pinned Development branch ID", () => {
  assert.throws(
    () => validateOperatorApproval(false, migrationManifest, validEnvironment({
      ERP_MIGRATION_BRANCH_ID: "br-production"
    })),
    /pinned Neon Development branch ID/i
  );
});

test("migration apply requires explicit approval even on the pinned Development branch", () => {
  assert.throws(
    () => validateOperatorApproval(true, migrationManifest, validEnvironment({
      ERP_MIGRATIONS_APPROVED: "NO"
    })),
    /ERP_MIGRATIONS_APPROVED=YES/i
  );
});

test("historical Development baseline requires all 47 checks and clean invariants", () => {
  const expected = [["0002",8],["0003",14],["0006",4],["0008",3],["0009",4],["0012",5],["0013",2],["0014",2],["0017",4],["0018",1]];
  const checks = expected.flatMap(([migration,count]) =>
    Array.from({length:count},(_,i)=>({migration,kind:"table",object:migration+"_"+i,present:true}))
  );
  const audit = {
    database:"erp_perfume", role:"erp_owner", checks,
    summary:expected.map(([migration,count])=>({migration,total:count,present:count,missing:0,status:"PASS"})),
    employees_missing_initial_history:0, unvalidated_constraints:0, invalid_or_unready_indexes:0
  };
  const manifest = {snapshot:{database:"erp_perfume",ledgerVersions:["0001","0002"]},
    migrations:[{version:"0020",database:{status:"pending"}}]};
  const report = validateHistoricalBaselineAudit({
    audit, manifest,
    ledgerRows:[{version:"0001"},{version:"0002"}]
  });
  assert.equal(report.status,"RECONCILIATION_EVIDENCE_PASSED_REVIEW_REQUIRED");
  assert.equal(report.objectChecks,47);
  assert.deepEqual(report.schemaPresentWithoutLedger,["0012","0013","0014"]);
  assert.deepEqual(report.pendingMigrations,["0020"]);
  assert.equal(report.readinessStatus,"BLOCKED");
  assert.equal(report.writesPerformed,false);
});

test("historical baseline rejects missing objects, nonzero invariants, duplicate checks and ledger drift", () => {
  const expected = [["0002",8],["0003",14],["0006",4],["0008",3],["0009",4],["0012",5],["0013",2],["0014",2],["0017",4],["0018",1]];
  const checks = expected.flatMap(([migration,count]) =>
    Array.from({length:count},(_,i)=>({migration,kind:"table",object:migration+"_"+i,present:true}))
  );
  const audit = {
    database:"erp_perfume", role:"erp_owner", checks,
    summary:expected.map(([migration,count])=>({migration,total:count,present:count,missing:0,status:"PASS"})),
    employees_missing_initial_history:0, unvalidated_constraints:0, invalid_or_unready_indexes:0
  };
  const manifest={snapshot:{database:"erp_perfume",ledgerVersions:["0001"]},migrations:[]};
  const args={audit,manifest,ledgerRows:[{version:"0001"}]};
  assert.throws(()=>validateHistoricalBaselineAudit({...args,audit:{...audit,checks:checks.slice(1)}}),/exactly 47/i);
  assert.throws(()=>validateHistoricalBaselineAudit({...args,audit:{...audit,unvalidated_constraints:1}}),/invariant failed/i);
  assert.throws(()=>validateHistoricalBaselineAudit({...args,audit:{...audit,checks:[...checks,checks[0]]}}),/exactly 47/i);
  assert.throws(()=>validateHistoricalBaselineAudit({...args,ledgerRows:[]}),/ledger does not exactly match/i);
  assert.throws(()=>validateHistoricalBaselineAudit({...args,ledgerRows:[{version:"0001"},{version:"0012"}]}),/ledger does not exactly match/i);
});
