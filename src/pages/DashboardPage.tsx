import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { categories as sampleCategories } from "../data/mock";
import { formatDate } from "../lib/format";
import { FILE_STATUS_LABEL } from "../lib/labels";
import { useCatalog } from "../state/catalog";
import type { Category, DataFile } from "../types";

const ACCEPT = ".csv,.tsv,.xlsx,.xls,.docx,.pdf,.txt,.jpg,.jpeg,.png,.hwpx,.hwp";
const CHOICE_KEY = "datalens.fileCategory";
const RECENT_LIMIT = 5;
const PREVIEW_FILE = "국민의소리_제877호_2026년 8월동향.pdf";

function readChoices(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(CHOICE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

function writeChoices(choices: Record<string, string>) {
  window.localStorage.setItem(CHOICE_KEY, JSON.stringify(choices));
}

function byNewest(a: DataFile, b: DataFile): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export function DashboardPage() {
  const { files, categories, uploadFiles, status, busy } = useCatalog();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>(readChoices);
  const sorted = useMemo(() => [...files].sort(byNewest), [files]);
  const target = sorted.find((file) => file.id === targetId) ?? sorted[0] ?? null;
  const recent = sorted.slice(0, RECENT_LIMIT);
  const usingSample = categories.length === 0;
  const options = usingSample ? sampleCategories : categories;
  const known = new Set(options.map((category) => category.categoryId));
  const fileKey = target?.id ?? "preview";
  const stored = known.has(choices[fileKey] ?? "") ? choices[fileKey] : "";
  const selected = stored || (usingSample ? (options[0]?.categoryId ?? "") : "");
  const groups = groupCategories(options);

  return (
    <div className="page">
      <section className="upload-hero" aria-labelledby="dash-upload">
        <div className="upload-hero-copy">
          <p className="upload-hero-kicker">데이터 수집·정제·분석</p>
          <h2 id="dash-upload">파일 품질을 진단하고 정제합니다</h2>
          <p>
            파일을 올리면 형식을 검증하고, 누락값·중복·형식 오류를 진단합니다. 승인한 규칙으로 정제한
            결과를 비교하고 AI 리포트를 확인합니다.
          </p>
        </div>
        <div className="upload-hero-actions">
          <label className="btn btn-pill upload-hero-upload">
            <input
              className="upload-input"
              type="file"
              multiple
              accept={ACCEPT}
              disabled={busy}
              onChange={(event) => {
                const picked = event.target.files;
                if (!picked || picked.length === 0) return;
                const list = [...picked];
                event.target.value = "";
                void uploadFiles(list).then((ids) => {
                  const newest = ids.at(-1);
                  if (newest) setTargetId(newest);
                });
              }}
            />
            파일 업로드
          </label>
          <Link className="btn upload-hero-report" to={target ? `/files/${target.id}` : "/files"}>
            분석 리포트
          </Link>
        </div>
      </section>

      <section className="card" aria-labelledby="dash-category">
        <div className="card-head">
          <h2 id="dash-category" className="title-sm">
            카테고리
          </h2>
        </div>
        <div className="stack">
          <p className="body">
            대상 파일 <span className="num">{target?.originalName ?? PREVIEW_FILE}</span>
          </p>
          <label className="field">
            <span>DB 카테고리</span>
            <select
              className="select"
              value={selected}
              disabled={busy || options.length === 0}
              onChange={(event) => {
                const categoryId = event.target.value;
                setChoices((current) => {
                  const next = { ...current };
                  if (categoryId) next[fileKey] = categoryId;
                  else delete next[fileKey];
                  writeChoices(next);
                  return next;
                });
              }}
            >
              <option value="">카테고리 선택</option>
              {groups.map((group) => (
                <optgroup key={group.name} label={group.name}>
                  {group.items.map((category) => (
                    <option key={category.categoryId} value={category.categoryId}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {sorted.length > 1 ? (
            <label className="field">
              <span>다른 파일</span>
              <select className="select" value={target?.id ?? ""} onChange={(event) => setTargetId(event.target.value)}>
                {sorted.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.originalName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="caption">
            {usingSample
              ? "서버에 카테고리가 없어 임시 목록으로 보여 줍니다. 교통·주정차, 도로·보행처럼 묶여 있습니다."
              : "고른 카테고리는 이 브라우저에 기억되고, 아래 목록에 표시됩니다."}
            {target ? "" : " 올린 파일이 없어 예시 파일 이름으로 보여 줍니다."}
          </p>
        </div>
      </section>

      <section className="card" aria-labelledby="dash-files">
        <div className="card-head">
          <h2 id="dash-files" className="title-sm">
            최근 파일
          </h2>
          <Button variant="secondary" to="/files">
            더보기
          </Button>
        </div>
        <DataTable
          framed={false}
          rows={recent}
          rowKey={(file) => file.id}
          empty={status === "loading" ? "파일 목록을 불러오는 중입니다." : "올린 파일이 없습니다."}
          columns={[
            {
              key: "name",
              header: "파일",
              render: (file) => (
                <Link className="link" to={`/files/${file.id}`}>
                  {file.originalName}
                </Link>
              ),
            },
            {
              key: "category",
              header: "카테고리",
              render: (file) => categoryName(options, choices[file.id]),
            },
            {
              key: "status",
              header: "상태",
              render: (file) => <span className="pill">{FILE_STATUS_LABEL[file.status]}</span>,
            },
            { key: "date", header: "올린 날", numeric: true, render: (file) => formatDate(file.createdAt) },
          ]}
        />
      </section>
    </div>
  );
}

function groupCategories(categories: Category[]): Array<{ name: string; items: Category[] }> {
  const map = new Map<string, Category[]>();
  for (const category of categories) {
    const items = map.get(category.group) ?? [];
    items.push(category);
    map.set(category.group, items);
  }
  return [...map.entries()].map(([name, items]) => ({
    name,
    items: [...items].sort((a, b) => a.name.localeCompare(b.name, "ko")),
  }));
}

function categoryName(categories: Category[], categoryId: string | undefined): string {
  if (!categoryId) return "—";
  return categories.find((category) => category.categoryId === categoryId)?.name ?? "—";
}
