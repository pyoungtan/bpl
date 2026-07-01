"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ThemePref, WeightUnit } from "@/lib/types";
import type { CloudState } from "@/lib/useCloudSync";
import type { LpCategory } from "@/lib/lighterpack";
import { useAppStore } from "@/lib/store";
import { WEIGHT_UNITS } from "@/lib/units";
import { cn } from "@/lib/cn";
import { Sheet } from "./ui/Sheet";
import { Field } from "./ui/Field";
import { Segmented } from "./ui/Segmented";
import { Button } from "./ui/Button";

const CURRENCIES = ["KRW", "USD", "EUR", "JPY", "GBP"];

function statusText(status: CloudState["status"]): string {
  switch (status) {
    case "syncing":
      return "동기화 중…";
    case "synced":
      return "동기화됨";
    case "error":
      return "동기화 오류";
    default:
      return "";
  }
}

export function SettingsSheet({
  open,
  onClose,
  cloud,
}: {
  open: boolean;
  onClose: () => void;
  cloud: CloudState;
}) {
  const displayUnit = useAppStore((s) => s.displayUnit);
  const setDisplayUnit = useAppStore((s) => s.setDisplayUnit);
  const currency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const resetToSample = useAppStore((s) => s.resetToSample);
  const importLighterpack = useAppStore((s) => s.importLighterpack);

  const [lpUrl, setLpUrl] = useState("");
  const [lpLoading, setLpLoading] = useState(false);
  const [lpMsg, setLpMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lpPending, setLpPending] = useState<{ cats: LpCategory[]; count: number } | null>(
    null,
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    // Keep `sent`/`code` across reopen so the user can leave to fetch the code
    // from their email and come back to the same step.
    if (open) {
      setConfirmReset(false);
      setAuthError(null);
      setVerifying(false);
      setSending(false);
      setConfirmSignOut(false);
      setLpLoading(false);
      setLpMsg(null);
      setLpPending(null);
    }
  }, [open]);

  // Step 1: fetch + validate the list, then ask how to apply it.
  async function handleImport() {
    const url = lpUrl.trim();
    if (!url || lpLoading) return;
    setLpLoading(true);
    setLpMsg(null);
    try {
      const res = await fetch("/api/lighterpack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setLpMsg({ ok: false, text: data.error ?? "가져오기에 실패했어요." });
      } else {
        const cats: LpCategory[] = data.categories ?? [];
        const count = cats.reduce((n, c) => n + (c.items?.length ?? 0), 0);
        if (count === 0) setLpMsg({ ok: false, text: "가져올 장비가 없어요." });
        else setLpPending({ cats, count });
      }
    } catch {
      setLpMsg({ ok: false, text: "네트워크 오류가 발생했어요." });
    }
    setLpLoading(false);
  }

  // Step 2: apply — replace the existing catalog or append to it.
  function finishImport(replace: boolean) {
    if (!lpPending) return;
    const n = importLighterpack(lpPending.cats, replace);
    setLpPending(null);
    setLpUrl("");
    setLpMsg({
      ok: true,
      text: replace
        ? `기존 데이터를 지우고 ${n}개 장비를 가져왔어요.`
        : `${n}개 장비를 가져왔어요. Gear Shelf에서 확인하세요.`,
    });
  }

  async function handleSignIn() {
    if (sending) return;
    setAuthError(null);
    setSending(true);
    const { error } = await cloud.signIn(email.trim());
    setSending(false);
    if (error) setAuthError(error);
    else setSent(true);
  }

  async function handleVerify() {
    setAuthError(null);
    setVerifying(true);
    const { error } = await cloud.verifyCode(email.trim(), code);
    setVerifying(false);
    if (error) setAuthError(error);
    // On success, onAuthStateChange sets the session and the UI switches.
  }

  async function handleSignOut() {
    await cloud.signOut();
    setSent(false);
    setCode("");
    setEmail("");
    setAuthError(null);
    setConfirmSignOut(false);
  }

  return (
    <Sheet open={open} onClose={onClose} title="설정" leftLabel="완료">
      <div className="space-y-6 px-4">
        {cloud.enabled && (
          <Field label="클라우드 동기화">
            {cloud.session ? (
              <div className="flex items-center justify-between gap-3 rounded-[12px] bg-card px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] text-label">
                    {cloud.session.user.email}
                  </div>
                  <div className="text-[13px] text-secondary">
                    {statusText(cloud.status) || "기기 간 자동 동기화"}
                  </div>
                </div>
                <Button
                  variant={confirmSignOut ? "filled" : "gray"}
                  size="sm"
                  onClick={() => {
                    if (!confirmSignOut) {
                      setConfirmSignOut(true);
                      return;
                    }
                    handleSignOut();
                  }}
                >
                  {confirmSignOut ? "확인" : "로그아웃"}
                </Button>
              </div>
            ) : sent ? (
              <div>
                <p className="px-1 text-[14px] leading-relaxed text-secondary">
                  <span className="text-label">{email.trim()}</span> 로 메일을
                  보냈어요. 메일의 <span className="text-label">링크</span>를 누르거나,
                  메일에 적힌 <span className="text-label">6자리 코드</span>를 아래에
                  입력하세요.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6자리 코드"
                    className="h-11 min-w-0 flex-1 rounded-[10px] bg-card px-3.5 text-[16px] tracking-[0.3em] tabular text-label outline-none placeholder:tracking-normal"
                  />
                  <Button
                    variant="filled"
                    onClick={handleVerify}
                    disabled={code.length < 6 || verifying}
                    className="shrink-0"
                  >
                    {verifying ? "확인 중…" : "확인"}
                  </Button>
                </div>
                {authError && (
                  <p className="mt-1.5 px-1 text-[13px] text-red">{authError}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setCode("");
                    setAuthError(null);
                  }}
                  className="mt-2 px-1 text-[13px] text-tint active:opacity-60"
                >
                  이메일 다시 입력
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일 주소"
                    className="h-11 min-w-0 flex-1 rounded-[10px] bg-card px-3.5 text-[15px] text-label outline-none"
                  />
                  <Button
                    variant="filled"
                    onClick={handleSignIn}
                    disabled={!email.includes("@") || sending}
                    className="shrink-0"
                  >
                    {sending ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      "링크 받기"
                    )}
                  </Button>
                </div>
                {authError && (
                  <p className="mt-1.5 px-1 text-[13px] text-red">{authError}</p>
                )}
                <p className="mt-1.5 px-1 text-[13px] leading-snug text-secondary">
                  이메일로 로그인하면 폰·PC 등 여러 기기에서 같은 데이터를 쓸 수 있어요.
                </p>
              </div>
            )}
          </Field>
        )}

        <Field label="무게 단위">
          <Segmented
            className="flex w-full"
            value={displayUnit}
            onChange={(u) => setDisplayUnit(u as WeightUnit)}
            options={WEIGHT_UNITS.map((u) => ({ value: u, label: u }))}
          />
        </Field>
        <Field label="통화">
          <Segmented
            className="flex w-full"
            value={currency}
            onChange={setCurrency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
        </Field>
        <Field label="테마">
          <Segmented
            className="flex w-full"
            value={theme}
            onChange={(t) => setTheme(t as ThemePref)}
            options={[
              { value: "light", label: "라이트" },
              { value: "dark", label: "다크" },
              { value: "system", label: "시스템" },
            ]}
          />
        </Field>

        <Field label="LighterPack 가져오기">
          <div className="flex gap-2">
            <input
              type="url"
              inputMode="url"
              value={lpUrl}
              onChange={(e) => setLpUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleImport();
                }
              }}
              placeholder="lighterpack.com/r/… 링크"
              className="h-11 min-w-0 flex-1 rounded-[10px] bg-card px-3.5 text-[16px] text-label outline-none"
            />
            <Button
              variant="filled"
              onClick={handleImport}
              disabled={!lpUrl.trim() || lpLoading}
              className="shrink-0"
            >
              {lpLoading ? <Loader2 size={18} className="animate-spin" /> : "가져오기"}
            </Button>
          </div>
          {lpMsg && (
            <p
              className={cn(
                "mt-1.5 px-1 text-[13px]",
                lpMsg.ok ? "text-secondary" : "text-red",
              )}
            >
              {lpMsg.text}
            </p>
          )}
          <p className="mt-1.5 px-1 text-[13px] leading-snug text-secondary">
            공유 링크를 붙여넣으면 분류·장비·무게를 그대로 가져옵니다. 기존 데이터를
            삭제할지 추가할지 선택할 수 있어요.
          </p>
        </Field>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              resetToSample();
              setConfirmReset(false);
              onClose();
            }}
            className="flex h-12 w-full items-center justify-center rounded-[12px] bg-card text-[17px] text-red active:opacity-60"
          >
            {confirmReset ? "한 번 더 눌러 초기화" : "샘플 데이터로 초기화"}
          </button>
          <p className="mt-2 px-1 text-[13px] leading-snug text-secondary">
            모든 장비와 트립이 예시 데이터로 대체됩니다.
          </p>
        </div>

        {lpPending && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setLpPending(null)}
            />
            <div className="relative w-full max-w-xs rounded-[16px] bg-card p-5 shadow-2xl">
              <h3 className="text-[17px] font-semibold text-label">
                LighterPack 가져오기
              </h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-secondary">
                <span className="font-medium text-label">{lpPending.count}개</span> 장비를
                가져옵니다. 기존 데이터를{" "}
                <span className="font-medium text-red">모두 삭제</span>하고 가져올까요?
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => finishImport(true)}
                  className="h-11 rounded-[10px] bg-red text-[15px] font-semibold text-white active:opacity-80"
                >
                  삭제하고 가져오기
                </button>
                <button
                  type="button"
                  onClick={() => finishImport(false)}
                  className="h-11 rounded-[10px] bg-fill text-[15px] font-medium text-label active:opacity-60"
                >
                  기존에 추가
                </button>
                <button
                  type="button"
                  onClick={() => setLpPending(null)}
                  className="h-10 text-[14px] text-secondary active:opacity-60"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
