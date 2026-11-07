"use client";
import Link from "next/link";
import {
  readWorkspaceCache,
  writeWorkspaceCache,
} from "@/lib/colleges/workspace-cache";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { type ModuleHub, hubIcons } from "@/lib/colleges/module-hubs";
import {
  loadModuleHub,
  type ModuleHubData,
  type HubActivity,
} from "@/services/api/modules/module-hubs";
import { errorText } from "@/services/api";
import {
  BarList,
  Donut,
  Empty,
  FilterDate,
  FilterSelect,
  nice,
  Panel,
  rupees,
  shortDate,
  Stat,
} from "./AnalyticsParts";
import ModuleWorkspaceSection from "./ModuleWorkspaceSection";
import "./module-hub.css";
const INITIAL = { academic_year: "", start: "", end: "" };
const format = (value: string | number | null, kind: string) =>
  value === null
    ? "Not marked"
    : kind === "money"
      ? rupees(Number(value))
      : kind === "percent"
        ? `${value}%`
        : Number(value).toLocaleString("en-IN");

export default function ModuleHubDashboard({
  hub,
  labels,
  nav,
  cacheScope,
  canCreateCampus,
}: {
  hub: ModuleHub;
  labels: Record<string, string>;
  nav: (screen: string) => string;
  cacheScope: string;
  canCreateCampus: boolean;
}) {
  const [data, setData] = useState<ModuleHubData | null>(null);
  const [filters, setFilters] = useState(INITIAL);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, refresh] = useState(0);
  const invalid = !!(
    filters.start &&
    filters.end &&
    filters.start > filters.end
  );
  useEffect(() => {
    if (invalid) return;
    const controller = new AbortController();
    let current = true;
    void Promise.resolve().then(async () => {
      if (!current) return;
      setLoading(true);
      setError("");
      try {
        const cacheKey = `${cacheScope}:module-hub:${hub.key}:${JSON.stringify(filters)}`;
        const cached = !revision
          ? readWorkspaceCache<ModuleHubData>(cacheKey)
          : undefined;
        const result =
          cached || (await loadModuleHub(hub.key, filters, controller.signal));
        if (current) {
          setData(result);
          if (!cached) writeWorkspaceCache(cacheKey, result);
        }
      } catch (e) {
        if (current && !controller.signal.aborted) {
          setData(null);
          setError(errorText(e));
        }
      } finally {
        if (current) setLoading(false);
      }
    });
    return () => {
      current = false;
      controller.abort();
    };
  }, [hub.key, filters, revision, invalid, cacheScope]);
  const Icon = hubIcons[hub.key] || BookOpen;
  const update = (patch: Partial<typeof INITIAL>) =>
    setFilters((old) => ({ ...old, ...patch }));
  const busy = loading || invalid;
  const activity = (rows: HubActivity[], empty: string) =>
    rows.length ? (
      <ul className="mhub-activity">
        {rows.map((row) => (
          <li key={`${row.type}-${row.code}`}>
            <Link href={nav(row.module)}>
              <span>
                <strong>{row.title}</strong>
                <small>
                  {row.type} · {shortDate(row.date)}
                  {row.method ? ` · ${nice(row.method)}` : ""}
                </small>
              </span>
              <span>
                {row.amount !== null && <b>{rupees(Number(row.amount))}</b>}
                <small>{nice(row.status)}</small>
              </span>
              <ChevronRight size={15} />
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <Empty>{empty}</Empty>
    );
  return (
    <div className="mhub anw">
      <nav className="mhub-breadcrumb" aria-label="Module breadcrumb">
        <span>Campus workspace</span>
        <ChevronRight size={13} />
        <span aria-current="page">{hub.title}</span>
      </nav>
      <header className="mhub-header">
        <span className="mhub-icon">
          <Icon size={25} />
        </span>
        <div>
          <h1>{hub.title}</h1>
          <p>{hub.description}</p>
        </div>
        {hub.key === "admissions" &&
          hub.screens.includes("module-admissions") && (
            <Link
              className="mhub-related"
              href={`${nav("module-admissions")}?records=documents`}
            >
              More admission records
            </Link>
          )}
        <Link
          className="mhub-primary"
          href={
            hub.screens[0] === "module-admissions"
              ? `${nav("module-admissions")}?records=documents`
              : nav(hub.screens[0])
          }
        >
          Open workspace <ArrowRight size={15} />
        </Link>
        <button
          className="mhub-refresh"
          onClick={() => refresh((n) => n + 1)}
          disabled={loading || invalid}
        >
          <RefreshCw size={15} className={loading ? "mhub-spinning" : ""} />
          Refresh
        </button>
      </header>
      <div className="mhub-filters">
        {!!data?.years.length && (
          <FilterSelect
            label="Academic year"
            value={filters.academic_year}
            onChange={(v) => update({ academic_year: v })}
            all="All academic years"
            options={data.years.map((y) => ({ value: y.code, label: y.name }))}
          />
        )}
        <FilterDate
          label="From"
          value={filters.start}
          onChange={(v) => update({ start: v })}
        />
        <FilterDate
          label="To"
          value={filters.end}
          onChange={(v) => update({ end: v })}
        />
        <button
          onClick={() => setFilters(INITIAL)}
          disabled={!Object.values(filters).some(Boolean)}
        >
          Reset filters
        </button>
        <small>
          {hub.key === "finance"
            ? "Ledger balances reflect the selected academic year. Collections and expenses use the date range. Cashbook is today's cash."
            : "Dates filter dated records. Academic year applies to linked records; other configuration counts remain current."}
        </small>
      </div>
      {invalid && (
        <p role="alert" className="mhub-error">
          From date must be on or before To date.
        </p>
      )}
      {error && (
        <div role="alert" className="mhub-error">
          <p>Unable to load this module: {error}</p>
          <button onClick={() => refresh((n) => n + 1)}>Retry</button>
        </div>
      )}
      {data?.warnings?.map((warning) => (
        <p role="status" key={warning} className="mhub-error">
          {warning}
        </p>
      ))}
      {loading && (
        <div
          className="mhub-loading"
          role="status"
          aria-label="Loading module summary"
        >
          <div />
          <div />
          <div />
          <div />
        </div>
      )}
      {!busy && data && (
        <>
          <section className="mhub-kpis" aria-label="Module overview">
            {data.metrics.map((m) => {
              const stat = (
                <Stat
                  icon={Icon}
                  label={m.label}
                  value={format(m.value, m.kind)}
                  hint={m.hint || undefined}
                />
              );
              return m.module && hub.screens.includes(m.module) ? (
                <Link href={nav(m.module)} key={m.label}>
                  {stat}
                </Link>
              ) : (
                <div key={m.label}>{stat}</div>
              );
            })}
          </section>
          {!data.metrics.length && (
            <Empty>
              No overview metrics are available with your permissions. Open a
              workspace below to continue.
            </Empty>
          )}
        </>
      )}
      <ModuleWorkspaceSection
        moduleKey={hub.key}
        screens={hub.screens.filter(
          (screen) => !data || data.destinations.includes(screen),
        )}
        labels={labels}
        nav={nav}
        canCreateCampus={canCreateCampus}
      />
      {!busy && data && (
        <>
          {data.cashbook && (
            <Panel
              title="Today's cashbook"
              action={
                hub.screens.includes("cashbook") ? (
                  <Link href={nav("cashbook")}>
                    View cashbook <ArrowRight size={14} />
                  </Link>
                ) : undefined
              }
            >
              <div className="mhub-cashbook">
                {(
                  [
                    ["Opening balance", data.cashbook.opening],
                    ["Cash receipts", data.cashbook.receipts],
                    ["Cash payments", data.cashbook.payments],
                    ["Current balance", data.cashbook.closing],
                  ] as const
                ).map(([title, value]) => (
                  <Stat
                    key={title}
                    icon={Wallet}
                    label={title}
                    value={rupees(value)}
                  />
                ))}
              </div>
            </Panel>
          )}
          <div className="mhub-charts">
            {data.charts.map((chart, index) => (
              <Panel key={chart.title} title={chart.title}>
                {chart.items.length ? (
                  index > 0 &&
                  chart.kind !== "percent" &&
                  !/month|trend/i.test(chart.title) &&
                  chart.items.every((i) => i.value >= 0) ? (
                    <Donut
                      title={chart.title}
                      centre={format(
                        chart.items.reduce((sum, i) => sum + i.value, 0),
                        chart.kind,
                      )}
                      centreLabel="Total"
                      slices={chart.items.map((i) => ({
                        key: i.label,
                        label: i.label,
                        value: i.value,
                        display: format(i.value, chart.kind),
                      }))}
                    />
                  ) : (
                    <BarList
                      items={chart.items.map((i) => ({
                        key: i.label,
                        label: i.label,
                        value: i.value,
                        display: format(i.value, chart.kind),
                      }))}
                    />
                  )
                ) : (
                  <Empty>No records available for the selected period.</Empty>
                )}
              </Panel>
            ))}
          </div>
          <div className="mhub-details">
            <Panel title="Recent activity">
              {activity(
                data.recent,
                "No dated activity recorded for the selected period.",
              )}
            </Panel>
            <Panel
              title={`Pending actions${data.pending_count ? ` (${data.pending_count})` : ""}`}
            >
              {activity(
                data.pending,
                "No pending actions in the records you can access.",
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
