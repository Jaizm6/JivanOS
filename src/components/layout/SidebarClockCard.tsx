import React, { useEffect, useMemo, useState } from 'react';

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const DIAL_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const SidebarClockCard: React.FC = () => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    let intervalId: number | undefined;

    const tick = () => setNow(new Date());
    // Sync initial tick close to the start of the next second for crisp seconds alignment
    const msUntilNextSecond = 1000 - (Date.now() % 1000);
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 1000);
    }, msUntilNextSecond);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const clock = useMemo(() => {
    const hours24 = now.getHours();
    const rawMinutes = now.getMinutes();
    const rawSeconds = now.getSeconds();
    const displayHours = hours24 % 12 || 12;

    return {
      hours: String(displayHours),
      minutes: String(rawMinutes).padStart(2, '0'),
      seconds: `:${String(rawSeconds).padStart(2, '0')}`,
      ampm: hours24 >= 12 ? 'PM' : 'AM',
      day: DAY_NAMES[now.getDay()],
      dateLabel: `${now.getDate()} ${MONTH_NAMES[now.getMonth()]}`,
      year: String(now.getFullYear()),
      secondAngle: rawSeconds * 6,
      minuteAngle: rawMinutes * 6 + rawSeconds * 0.1,
      hourAngle: (hours24 % 12) * 30 + rawMinutes * 0.5 + rawSeconds / 120,
    };
  }, [now]);

  return (
    <section
      aria-label="Live digital and analog clock"
      className="w-full grid grid-cols-[minmax(0,1fr)_1px_auto] items-center gap-x-2 sm:gap-x-2.5 px-2.5 py-2.5 sm:px-3 sm:py-3 overflow-hidden rounded-[24px] bg-gradient-to-br from-white via-white to-[#fbfdff] dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950/95 border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_12px_28px_rgba(15,23,42,0.065),0_2px_6px_rgba(15,23,42,0.03)] dark:shadow-2xs select-none"
    >
      {/* Left Section: Digital Time + Connected AM/PM & Seconds Capsule + Date Row */}
      <div className="min-w-0" aria-label="Digital time and date">
        <div className="flex items-center min-w-0 tabular-nums">
          <div
            className="inline-flex items-center shrink-0 whitespace-nowrap text-[28px] sm:text-[32px] font-black leading-[0.98] tracking-[-0.045em]"
            aria-label="Hours and minutes"
          >
            <span className="text-[#e11d48] dark:text-rose-500">{clock.hours}</span>
            <span
              aria-hidden="true"
              className="inline-block ml-[0.09em] mr-[0.08em] text-[#0f172a] dark:text-white text-[0.78em] font-extrabold leading-none -translate-y-[0.025em]"
            >
              :
            </span>
            <span className="text-[#0f172a] dark:text-white">{clock.minutes}</span>
          </div>

          {/* Connected Capsule: AM/PM on top, :SS on bottom */}
          <div
            className="shrink-0 w-[32px] sm:w-[35px] h-[40px] sm:h-[44px] grid grid-rows-2 items-center justify-items-center ml-1.5 sm:ml-2 overflow-hidden rounded-[10px] border border-[#dcefe2] dark:border-emerald-800/60 bg-[#f0fdf4] dark:bg-emerald-950/45 tabular-nums leading-none"
            aria-label="AM or PM and seconds"
          >
            <span className="w-full h-full flex items-center justify-center text-[#0f172a] dark:text-zinc-100 text-[8.5px] sm:text-[9px] font-black tracking-[0.045em]">
              {clock.ampm}
            </span>
            <span className="w-full h-full flex items-center justify-center border-t border-[#dcefe2] dark:border-emerald-800/60 text-[#16a34a] dark:text-emerald-400 text-[10px] sm:text-[10.5px] font-black tracking-[-0.035em]">
              {clock.seconds}
            </span>
          </div>
        </div>

        {/* Date Row */}
        <div
          className="flex items-center gap-1.5 sm:gap-2 mt-2.5 pt-2 border-t border-[#e2e8f0] dark:border-zinc-800 whitespace-nowrap leading-[1.1] tabular-nums"
          aria-label="Current date"
        >
          <span className="shrink-0 px-[6px] py-[4px] rounded-[7px] bg-[#fff1f2] dark:bg-rose-950/60 text-[#e11d48] dark:text-rose-400 text-[7.5px] sm:text-[8px] font-black tracking-[0.055em]">
            {clock.day}
          </span>
          <span className="inline-flex items-baseline gap-[4px] min-w-0 text-[#0f172a] dark:text-zinc-100 text-[10px] sm:text-[11px] font-extrabold tracking-[-0.025em]">
            <span>{clock.dateLabel}</span>
            <span className="text-[#16a34a] dark:text-emerald-400 font-black">
              {clock.year}
            </span>
          </span>
        </div>
      </div>

      {/* Vertical Gradient Divider */}
      <div
        aria-hidden="true"
        className="w-px h-[74px] sm:h-[80px] bg-gradient-to-b from-transparent via-[#e2e8f0] to-transparent dark:via-zinc-800 shrink-0"
      />

      {/* Right Section: Recessed Well + Crisp Analog Clock Face */}
      <div
        aria-hidden="true"
        className="grid place-items-center w-[76px] h-[76px] sm:w-[82px] sm:h-[82px] rounded-full bg-gradient-to-br from-[#f8fbff] to-[#edf3f9] dark:from-zinc-900 dark:to-zinc-950 border border-[#e8eef5] dark:border-zinc-800 shrink-0"
      >
        <div className="relative w-[66px] h-[66px] sm:w-[72px] sm:h-[72px] rounded-full border border-[#dbe3ed] dark:border-zinc-700/80 bg-white dark:bg-zinc-900 shadow-[inset_0_1px_4px_rgba(15,23,42,0.035),0_2px_4px_rgba(15,23,42,0.025)]">
          {/* Upright Dial Numbers 1-12 */}
          {DIAL_NUMBERS.map(number => {
            const angle = number * 30;
            return (
              <div
                key={number}
                style={{ transform: `rotate(${angle}deg)` }}
                className={`absolute inset-0 pt-[4px] text-center text-[7px] sm:text-[7.5px] font-extrabold leading-none ${
                  number === 12
                    ? 'text-[#e11d48] dark:text-rose-500'
                    : 'text-[#64748b] dark:text-zinc-400'
                }`}
              >
                <span
                  className="inline-block"
                  style={{ transform: `rotate(-${angle}deg)` }}
                >
                  {number}
                </span>
              </div>
            );
          })}

          {/* Hour Hand */}
          <div
            style={{
              transform: `rotate(${clock.hourAngle}deg)`,
              transformOrigin: 'bottom center',
            }}
            className="absolute bottom-1/2 left-1/2 z-[2] w-[2.5px] h-[16px] sm:h-[18px] -ml-[1.25px] rounded-full bg-[#0f172a] dark:bg-white"
          />

          {/* Minute Hand */}
          <div
            style={{
              transform: `rotate(${clock.minuteAngle}deg)`,
              transformOrigin: 'bottom center',
            }}
            className="absolute bottom-1/2 left-1/2 z-[2] w-[2px] h-[22px] sm:h-[25px] -ml-[1px] rounded-full bg-[#3b82f6] dark:bg-blue-400"
          />

          {/* Second Hand */}
          <div
            style={{
              transform: `rotate(${clock.secondAngle}deg)`,
              transformOrigin: 'bottom center',
            }}
            className="absolute bottom-1/2 left-1/2 z-[2] w-[1.25px] h-[25px] sm:h-[28px] -ml-[0.625px] rounded-full bg-[#e11d48] dark:bg-rose-500"
          />

          {/* Hollow Center Cap */}
          <div className="absolute top-1/2 left-1/2 z-[4] w-[7px] h-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.75px] border-[#e11d48] dark:border-rose-500 bg-white dark:bg-zinc-900" />
        </div>
      </div>
    </section>
  );
};
