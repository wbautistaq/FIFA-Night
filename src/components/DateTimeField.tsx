"use client";

import { useState } from "react";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function to24(hour: string, period: string): string {
  const h = Number(hour) % 12;
  return String(period === "pm" ? h + 12 : h).padStart(2, "0");
}

/**
 * Fecha y hora de Colombia con selectores de 12 horas. El campo nativo datetime-local no sirve aquí:
 * su formato depende de la configuración de cada dispositivo. El valor es "yyyy-MM-ddTHH:mm", o "" sin fecha.
 */
export function DateTimeField({ id, defaultValue = "", defaultTime = "20:00", onChange, onBlur }: { id?: string; defaultValue?: string; defaultTime?: string; onChange: (value: string) => void; onBlur?: () => void }) {
  const initial = defaultValue ? defaultValue.slice(11, 16) : defaultTime;
  const initialHour = Number(initial.slice(0, 2));
  const [date, setDate] = useState(defaultValue.slice(0, 10));
  const [hour, setHour] = useState(String(initialHour % 12 || 12));
  const [minute, setMinute] = useState(initial.slice(3, 5));
  const [period, setPeriod] = useState(initialHour < 12 ? "am" : "pm");
  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort();

  const emit = (d: string, h: string, m: string, p: string) => onChange(d ? `${d}T${to24(h, p)}:${m}` : "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input id={id} type="date" className="input min-w-[10rem] flex-1" value={date} onBlur={onBlur} onChange={(e) => { setDate(e.target.value); emit(e.target.value, hour, minute, period); }} />
      <div className="flex items-center gap-1">
        <select aria-label="Hora" className="input !w-[4.25rem] !px-2 tabular-nums" value={hour} onBlur={onBlur} onChange={(e) => { setHour(e.target.value); emit(date, e.target.value, minute, period); }}>
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span aria-hidden className="font-bold text-white/60">:</span>
        <select aria-label="Minutos" className="input !w-[4.25rem] !px-2 tabular-nums" value={minute} onBlur={onBlur} onChange={(e) => { setMinute(e.target.value); emit(date, hour, e.target.value, period); }}>
          {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select aria-label="a. m. o p. m." className="input !w-[5rem] !px-2" value={period} onBlur={onBlur} onChange={(e) => { setPeriod(e.target.value); emit(date, hour, minute, e.target.value); }}>
          <option value="am">a. m.</option>
          <option value="pm">p. m.</option>
        </select>
      </div>
    </div>
  );
}
