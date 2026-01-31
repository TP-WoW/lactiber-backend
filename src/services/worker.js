"use strict";

require("dotenv").config();
const sql = require("mssql");
const os = require("os");
const crypto = require("crypto");
const pLimit = require("p-limit").default;
const cronParser = require("cron-parser");
const { DateTime } = require("luxon");

const usePino = (() => {
  try {
    return require("pino")();
  } catch {
    return null;
  }
})();
const log = usePino || console;

// -----------------------------
// Config
// -----------------------------
const config = {
  sql: {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
      encrypt: String(process.env.SQL_ENCRYPT).toLowerCase() === "true",
      trustServerCertificate: true,
    },
    pool: {
      max: Number(process.env.SQL_POOL_MAX || 10),
      min: 0,
      idleTimeoutMillis: 30000,
    },
  },

  pollingMs: Number(process.env.POLLING_MS || 5000),
  batchSize: Number(process.env.BATCH_SIZE || 5),
  leaseSeconds: Number(process.env.LEASE_SECONDS || 120),
  concurrency: Number(process.env.CONCURRENCY || 3),
  jobTimeoutMs: Number(process.env.JOB_TIMEOUT_MS || 120000),

  allowList: new Set(
    (process.env.ALLOWLIST || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ),

  claimProc: "dbo.usp_ClaimDueTriggers",
  reportProc: "dbo.usp_ReportTriggerRunResult",
};

const workerId =
  process.env.WORKER_ID ||
  `${os.hostname()}-${process.pid}-${crypto.randomBytes(3).toString("hex")}`;

const limit = pLimit(config.concurrency);

let pool;
let timer;

// -----------------------------
// Helpers
// -----------------------------
function nowUtc() {
  return new Date();
}

function toDateTime2Seconds(date) {
  // SQL DATETIME2(0): sin milisegundos
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

function isValidSqlName(name) {
  // Evitar caracteres raros en schema/proc
  return typeof name === "string" && /^[A-Za-z_][A-Za-z0-9_$]*$/.test(name);
}

function quoteName(name) {
  // QUOTENAME-like
  return `[${String(name).replace(/]/g, "]]")}]`;
}

function computeNextRunUtc(trigger, baseUtcDate) {
  const base = DateTime.fromJSDate(baseUtcDate, { zone: "utc" });

  // Once
  if (trigger.ScheduleType === 1) return null;

  // Interval
  if (trigger.ScheduleType === 2) {
    const interval = Number(trigger.IntervalSeconds || 0);
    if (!interval) return null;

    if (trigger.AlignToClock) {
      const epochSec = Math.floor(base.toSeconds());
      const nextSec = Math.ceil(epochSec / interval) * interval;
      return DateTime.fromSeconds(nextSec, { zone: "utc" }).toJSDate();
    }

    return base.plus({ seconds: interval }).toJSDate();
  }

  // Cron
  if (trigger.ScheduleType === 3) {
    const expr = String(trigger.CronExpression || "").trim();
    if (!expr) return null;

    const tz =
      (trigger.TimeZoneId && String(trigger.TimeZoneId).trim()) || "UTC";
    const baseInTz = base.setZone(tz);

    const it = cronParser.parseExpression(expr, {
      currentDate: baseInTz.toJSDate(),
      tz,
    });

    const next = it.next().toDate(); // “conceptualmente” en tz
    return DateTime.fromJSDate(next, { zone: tz }).toUTC().toJSDate();
  }

  // Manual u otros
  return null;
}

// Ejecuta un SP "job" usando una convención fija de parámetros
async function execJobProcedure(conn, schema, proc, paramsJson, correlationId) {
  const request = conn.request();
  request.timeout = config.jobTimeoutMs;

  request.input("ParamsJson", sql.NVarChar(sql.MAX), paramsJson ?? null);
  request.input("CorrelationId", sql.UniqueIdentifier, correlationId);

  const full = `${quoteName(schema)}.${quoteName(proc)}`;
  const query = `EXEC ${full} @ParamsJson=@ParamsJson, @CorrelationId=@CorrelationId;`;

  return request.query(query);
}

// -----------------------------
// DB operations
// -----------------------------
async function claimDueTriggers(conn) {
  const req = conn.request();
  req.input("WorkerId", sql.NVarChar(200), workerId);
  req.input("NowUtc", sql.DateTime2(0), toDateTime2Seconds(nowUtc()));
  req.input("MaxToClaim", sql.Int, config.batchSize);
  req.input("LeaseSeconds", sql.Int, config.leaseSeconds);
  const result = await req.execute(config.claimProc);
  return result.recordset || [];
}

async function reportResult(
  conn,
  triggerId,
  wasSuccessful,
  nextRunUtc,
  errorMessage,
  errorDetails,
) {
  const req = conn.request();
  req.input("TriggerId", sql.UniqueIdentifier, triggerId);
  req.input("WorkerId", sql.NVarChar(200), workerId);
  req.input("NowUtc", sql.DateTime2(0), toDateTime2Seconds(nowUtc()));
  req.input("WasSuccessful", sql.Bit, wasSuccessful ? 1 : 0);
  req.input(
    "NextRunAtUtc",
    sql.DateTime2(0),
    nextRunUtc ? toDateTime2Seconds(nextRunUtc) : null,
  );
  req.input("ErrorMessage", sql.NVarChar(2000), errorMessage || null);
  req.input("ErrorDetails", sql.NVarChar(sql.MAX), errorDetails || null);

  await req.execute(config.reportProc);
}

// -----------------------------
// Job processing
// -----------------------------
async function processTrigger(trigger) {
  const correlationId = crypto.randomUUID();
  const schema = trigger.ProcedureSchema || "dbo";
  const proc = trigger.ProcedureName;

  const key = `${schema}.${proc}`;

  // Validaciones y seguridad
  if (!isValidSqlName(schema) || !isValidSqlName(proc)) {
    await reportResult(
      pool,
      trigger.TriggerId,
      false,
      null,
      "Invalid procedure name/schema (validation failed)",
      `schema=${schema}, proc=${proc}`,
    );
    return;
  }

  // Allowlist: si está configurada, exigimos estar dentro
  if (config.allowList.size > 0 && !config.allowList.has(key)) {
    await reportResult(
      pool,
      trigger.TriggerId,
      false,
      null,
      "Procedure not allowed by allowlist",
      `Not in allowlist: ${key}`,
    );
    return;
  }

  const started = Date.now();

  try {
    await execJobProcedure(
      pool,
      schema,
      proc,
      trigger.ProcedureParamsJson,
      correlationId,
    );

    const nextRun = computeNextRunUtc(trigger, nowUtc());
    await reportResult(pool, trigger.TriggerId, true, nextRun, null, null);

    log.info?.({
      event: "job_success",
      triggerId: trigger.TriggerId,
      name: trigger.Name,
      proc: key,
      ms: Date.now() - started,
      nextRunAtUtc: nextRun ? nextRun.toISOString() : null,
      correlationId,
    }) ||
      log.log(
        `[OK] ${trigger.Name} -> ${key} (${Date.now() - started}ms) next=${nextRun?.toISOString() ?? "NULL"}`,
      );
  } catch (err) {
    const msg = err?.message || "Unknown error";
    const details = JSON.stringify(
      {
        name: err?.name,
        code: err?.code,
        number: err?.number,
        state: err?.state,
        class: err?.class,
        lineNumber: err?.lineNumber,
        stack: err?.stack,
      },
      null,
      2,
    );

    await reportResult(pool, trigger.TriggerId, false, null, msg, details);

    log.error?.({
      event: "job_failed",
      triggerId: trigger.TriggerId,
      name: trigger.Name,
      proc: key,
      ms: Date.now() - started,
      correlationId,
      error: msg,
    }) || log.error(`[FAIL] ${trigger.Name} -> ${key}: ${msg}`);
  }
}

// -----------------------------
// Main loop
// -----------------------------
async function tick() {
  try {
    const triggers = await claimDueTriggers(pool);

    if (!triggers.length) return;

    log.info?.({ event: "claimed", count: triggers.length }) ||
      log.log(`[CLAIM] ${triggers.length} triggers`);

    await Promise.all(triggers.map((t) => limit(() => processTrigger(t))));
  } catch (err) {
    log.error?.({ event: "tick_error", error: err?.message || String(err) }) ||
      log.error(`[tick error] ${err?.message || err}`);
  }
}

async function start() {
  log.info?.({ event: "start", workerId }) ||
    log.log(`Starting workerId=${workerId}`);

  pool = await sql.connect(config.sql);

  // Primer tick inmediato
  await tick();

  timer = setInterval(tick, config.pollingMs);

  const shutdown = async () => {
    log.info?.({ event: "shutdown" }) || log.log("Shutting down...");
    try {
      clearInterval(timer);
    } catch {}
    try {
      await pool.close();
    } catch {}
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  log.error?.({ event: "fatal", error: err?.message || String(err) }) ||
    log.error("Fatal start error:", err);
  process.exit(1);
});
