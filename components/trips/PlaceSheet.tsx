"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, PencilLine, Search, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { PinMap } from "../map/PinMap";
import { Sheet } from "../ui/Sheet";

interface Place {
  lat: number;
  lng: number;
  name: string;
  label: string;
}
type Pos = { lat: number; lng: number };

/**
 * A trip's place: search for it, or tap the map to drop a pin (the name is
 * filled in from what's there, and can be edited). When a search finds
 * nothing, the typed words can be kept as the name as they are — then pin it
 * on the map, or leave it unplaced. Saving stores the name and the
 * coordinates, so the Map tab doesn't have to look it up again.
 */
export function PlaceSheet({
  open,
  tripId,
  onClose,
}: {
  open: boolean;
  tripId: string;
  onClose: () => void;
}) {
  const trip = useAppStore((s) => s.trips[tripId]);
  const updateTrip = useAppStore((s) => s.updateTrip);
  const [name, setName] = useState("");
  const [pos, setPos] = useState<Pos | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState<"search" | "pin" | null>(null);
  const reverseSeq = useRef(0);
  /** The name is the user's own (typed, or kept from the search box): a pin
   *  dropped afterwards places it without renaming it. */
  const [ownName, setOwnName] = useState(false);

  // Each opening starts from the trip as it is.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(trip?.place ?? "");
      setPos(trip?.lat != null && trip?.lng != null ? { lat: trip.lat, lng: trip.lng } : null);
      setQuery("");
      setResults(null);
      setOwnName(Boolean(trip?.place?.trim()));
    }
  }

  // A place typed earlier but never located: find it to show on the map.
  useEffect(() => {
    const q = trip?.place?.trim();
    if (!open || !q || trip?.lat != null) return;
    let dead = false;
    fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Pos | null) => {
        if (!dead && j) setPos((p) => p ?? { lat: j.lat, lng: j.lng });
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
    // only on opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Search as you type (debounced; Nominatim wants ≤1 request/s).
  const q = query.trim();
  useEffect(() => {
    if (!open || q.length < 2) return;
    let dead = false;
    const t = window.setTimeout(() => {
      setBusy("search");
      fetch(`/api/geocode?list=1&q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((j: { results?: Place[] }) => {
          if (!dead) setResults(j.results ?? []);
        })
        .catch(() => {
          if (!dead) setResults([]);
        })
        .finally(() => {
          if (!dead) setBusy(null);
        });
    }, 600);
    return () => {
      dead = true;
      window.clearTimeout(t);
    };
  }, [open, q]);

  function choose(p: Place) {
    setPos({ lat: p.lat, lng: p.lng });
    setName(p.name);
    setOwnName(false);
    setQuery("");
    setResults(null);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  /** Keep the searched words as the place's name, as typed. */
  function keepTyped() {
    setName(q);
    setOwnName(true);
    setQuery("");
    setResults(null);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  const ownNameRef = useRef(ownName);
  useEffect(() => {
    ownNameRef.current = ownName;
  }, [ownName]);

  function pin(lat: number, lng: number) {
    setPos({ lat, lng });
    setResults(null);
    const seq = ++reverseSeq.current;
    setBusy("pin");
    fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Place | null) => {
        if (seq === reverseSeq.current && j?.name && !ownNameRef.current) setName(j.name);
      })
      .catch(() => {})
      .finally(() => {
        if (seq === reverseSeq.current) setBusy(null);
      });
  }

  function save() {
    const place = name.trim();
    updateTrip(
      tripId,
      place && pos
        ? { place, lat: pos.lat, lng: pos.lng, geoQ: place }
        : // a name alone is looked up later by the Map tab; nothing clears it all
          { place, lat: undefined, lng: undefined, geoQ: undefined },
    );
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="장소"
      rightAction={{ label: "완료", onClick: save, prominent: true }}
    >
      <div className="px-4">
        <div className="flex h-11 items-center gap-2.5 rounded-full bg-fill px-4">
          <Search size={17} className="shrink-0 text-tertiary" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 2) setResults(null);
            }}
            placeholder="산, 공원, 지역 검색…"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[16px] text-label outline-none placeholder:text-tertiary"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults(null);
              }}
              aria-label="검색 지우기"
              className="shrink-0 text-tertiary active:opacity-50"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {results && (
        <div className="mt-1">
          {results.length === 0 && (
            <p className="px-5 pb-1 pt-3 text-[14px] text-secondary">
              {busy === "search"
                ? "찾는 중…"
                : "검색 결과가 없어요. 이 이름 그대로 정하거나, 아래 지도를 눌러 핀을 찍어 보세요."}
            </p>
          )}
          {results.map((r) => (
              <button
                key={`${r.lat},${r.lng}`}
                type="button"
                onClick={() => choose(r)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left active:opacity-60"
              >
                <MapPin size={16} className="shrink-0 text-tertiary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold leading-tight text-label">
                    {r.name}
                  </div>
                  <div className="mt-0.5 truncate text-[12.5px] leading-tight text-secondary">
                    {r.label}
                  </div>
                </div>
              </button>
          ))}
          {busy !== "search" && q && (
            <button
              type="button"
              onClick={keepTyped}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left active:opacity-60"
            >
              <PencilLine size={16} className="shrink-0 text-tertiary" />
              <div className="min-w-0 flex-1 truncate text-[15px] leading-tight text-label">
                <span className="font-semibold">‘{q}’</span>
                <span className="text-secondary"> 이름으로 정하기</span>
              </div>
            </button>
          )}
        </div>
      )}

      <div className="mx-4 mt-3 h-[min(300px,42dvh)] overflow-hidden rounded-[20px] bg-fill">
        <PinMap pos={pos} onPick={pin} />
      </div>
      <p className="mt-2 px-5 text-[12.5px] text-tertiary">
        {busy === "pin"
          ? "이 위치의 이름을 찾는 중…"
          : ownName && name.trim()
            ? `지도를 눌러 ‘${name.trim()}’의 위치를 찍을 수 있어요.`
            : "지도를 눌러 위치를 찍을 수 있어요."}
      </p>

      <div className="mt-3 px-4">
        <div className="flex h-11 items-center gap-2.5 rounded-full bg-fill px-4">
          <MapPin size={17} className="shrink-0 text-tertiary" />
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setOwnName(Boolean(e.target.value.trim()));
            }}
            placeholder="장소 이름"
            enterKeyHint="done"
            className="min-w-0 flex-1 bg-transparent text-[16px] text-label outline-none placeholder:text-tertiary"
          />
          {(name || pos) && (
            <button
              type="button"
              onClick={() => {
                setName("");
                setOwnName(false);
                setPos(null);
              }}
              aria-label="장소 지우기"
              className="shrink-0 text-tertiary active:opacity-50"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
