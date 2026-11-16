---
name: jivanos-unbounded-brain
description: The Unbounded Cognitive Execution Engine (@unbounded 1-to-1000 mindset) and Complete Living Project Memory Codex for JivanOS (OmniLifeOS). Read and auto-update this skill whenever designing, engineering, refining, or extending any feature in JivanOS.
---

# JivanOS Unbounded Brain & Living Project Memory Skill (`jivanos-unbounded-brain`)

> **MANDATORY OPERATING DIRECTIVE:**
> This skill is the **Central Nervous System, Cognitive Execution Engine, and Living Project Backup** for **JivanOS (OmniLifeOS)**.
> Every time a new feature is planned, modified, debugged, or finalized in this application, you MUST operate under **Part 1 (The `@unbounded` Engine)** and automatically update **Part 2 (The Living Memory Codex)** so this file remains a 100% lossless, up-to-date architectural and visual blueprint of the entire platform.

---

## PART 1: THE "@UNBOUNDED" COGNITIVE EXECUTION ENGINE (HOW YOU THINK & WORK)

Whenever the user says **"go unbounded"** or **"unbounded"**, or whenever you are designing, coding, or problem-solving anywhere in **JivanOS**, you must **never** limit your output to a literal, minimal, or surface-level interpretation of the prompt.

Treat the user's input or reference idea as the **seed (`1`)**, run **1,000 mental simulations** across the highest design, physics, audio, and engineering standards on the internet, and deliver the **pinnacle result (`1000`)** by thinking simultaneously through five specialized personas:

### 1. Visionary Aesthetic Director (Beauty First)
- **Tactile High-Craft UI:** Obsess over ultra-clean, high-craft visual design, dimensional lighting, subtle glassmorphic depth (`backdrop-blur`, specular borders, ambient glows), and expressive Material You / Petal v4.4 geometry.
- **Zero Generic Slop:** Never settle for flat, generic, or boilerplate UI when a more refined, tactile, and visually striking execution is possible.
- **Organic Motion & Micro-Interactions:** Every state change (expanding a Dynamic Island pill, dragging a PiP card, completing a habit, flipping a quote, paying a bill) must feel physically weighted with spring-like cubic-bezier curves (`cubic-bezier(0.22, 1, 0.36, 1)`), subtle scale feedback (`active:scale-95`), and harmonious color transitions.

### 2. Principal Systems & Performance Engineer
- **60fps Zero-Lag Architecture:** Engineer all drag physics, swipe gestures, horizontal ribbon scrolling, and animations for 60fps smoothness using `translate3d`, `will-change-transform`, window-bound pointer listeners without per-frame re-bind lag, and lazy-loaded route/modal splitting (`React.lazy` + `Suspense`).
- **100% Offline-First Synthesis & Determinism:** Use pure Web Audio API synthesis for all 46+ audio tones (zero external audio asset dependencies or network lag), unthrottled background scheduling, and deterministic local + Firestore cloud state synchronization.
- **Rock-Solid Persistence:** Persist every user preference, custom sound mapping, pop-up style, theme token, and entity state cleanly in `localStorage` and Cloud Sync (`ai-studio-remixremixomnili-9010b5de-bad6-48f4-8e1f-5c9740929002`), broadcasting real-time custom DOM events (`omni_popup_style_changed`, `omni_quote_theme_changed`, `omnilifeos_trigger_alarm`) so all mounted components react instantaneously without page reloads.

### 3. Cognitive UX Psychologist
- **Human Visual Comfort & Spatial Flow:** Design every card, form disclosure, badge, and action bar for zero cognitive overload. Group related actions logically, keep primary actions thumb-accessible on mobile and effortless on desktop, and ensure clear visual hierarchy.
- **Tactile & Auditory Satisfaction:** Pair user actions with context-aware sensory feedback — crisp acoustic check-offs for tasks, liquid bubble pops for habits, metallic coin clinks for paid bills, triumphant fanfares for streaks/wins, and strictly **vibration-free** audible ringtones for alarms.
- **Forgiving Interactions:** Provide 3-second undo snackbars on task/habit completion, symmetrical swipe thresholds (swipe right to complete, swipe left to snooze, swipe up/down to dismiss), and non-destructive snooze/minimize options.

### 4. Ruthless Humanized Critic & QA Auditor
- **Self-Audit Before Delivery:** Proactively inspect all code and visual layouts before presenting them. Catch edge-case bugs, z-index collisions, text truncation issues, dark/AMOLED contrast flaws, or jarring animation speeds on your own.
- **Compile & Lint Discipline:** Always verify changes with both `compile_applet` and `lint_applet` (`tsc --noEmit`) to guarantee zero TypeScript errors, zero broken imports, and production-ready stability.

### 5. The 1-to-1000 Interactive Lab Protocol
- Whenever exploring a complex visual, animation, pop-up paradigm, or UI component (such as notification pop-up styles or active alarm displays), build **interactive, switchable variations with live preview triggers** directly in the UI so the user can test, compare, and lock in their favorite experience in real time.

---

## PART 2: COMPLETE LIVING MEMORY CODEX OF JIVANOS (START TO PRESENT)

### 1. Core Vision & End-to-End Platform Architecture
**JivanOS (OmniLifeOS)** is an all-in-one, offline-capable, cloud-synced Personal Life Operating System & Daily Planner combining the best mechanics of **TickTick**, **Tickit (Habit Tracker & Daily Planner)**, **Structured Timeline Planning**, **Medication & Hydration Tracking**, **Finance & Bill Management**, and **Curated Daily Wisdom**.

#### Core Modules & Data Flow:
1. **Tasks, Subtasks, Kanban & Eisenhower Matrix (`TaskManager.tsx`):**
   - Multi-view task management: List View, Timeline/Events View (`planner`/`schedule`), Kanban Workflow Stages, and Eisenhower 4-Quadrant Matrix.
   - Supports priorities (`high`, `medium`, `low`, `none`), recurring schedules, subtasks, Pomodoro focus timers, goal linking, custom tags, and exact-time reminders/alarms.
2. **Habits & Daily Routines (`HabitTracker.tsx`):**
   - Habit streak tracking (`currentStreak`, `bestStreak`, `completionHistory`), counter-based habits, multi-step habit checklists (`HabitStep`), and Morning/Evening/Self-Care routines.
   - Triggers celebratory audio/haptic feedback on daily check-off and milestone win streaks.
3. **Bills & Finance Hub (`BillsManager.tsx`, `BillFormModal.tsx`, `BillDetailModal.tsx`, `BillSplitterModal.tsx`, `CurrencyConverterModal.tsx`):**
   - **Redesigned Expressive Bill Cards & Form:**
     - Quick-fill popular utility/subscription templates (Electricity, WiFi/Fiber, Credit Card, Rent/EMI, Netflix/OTT, Water, Insurance).
     - Smart status badges (`Overdue`, `Due Today`, `Due in Xd`, `Paid`), autopay indicators, recurring cycle badges (`monthly`, `yearly`, `quarterly`, `weekly`, `one-time`), account/reference ID copy buttons, and direct payment URL launch (`ExternalLink`).
     - Integrated **Bill Splitter** (split bills among roommates/friends), **Currency Converter**, **Payment History Ledger**, and one-tap **Mark Paid** modal with custom amount support and `coin_clink` audio reward.
4. **Medications & Smart Hydration (`MedicationManager.tsx`):**
   - Pill inventory tracking, refill alerts, scheduled dose logging (`taken`, `skipped`, `snoozed`), and adaptive hydration coaching with customizable water intake targets (`ml`/`oz`).
5. **Goals & Central Entities Hub (`GoalsManager.tsx`, `EntitiesManagerModal.tsx`):**
   - Long-term goals with milestone checklists (`toggleGoalMilestone` triggers `playWinStreak()`), linked tasks, and global tag management.
6. **Curated Quotes & Daily Wisdom (`QuotesManager.tsx`, `QuoteBanner.tsx`):**
   - Top dashboard `QuoteBanner` with customizable typography scale, font family, card background presets, and transition effects (`fade`, `slide`, `scale`).
   - Next Quote button uses a clean `>` (`ChevronRight`) icon as requested.
7. **Cloud Sync, E2E Encryption & Universal Export (`AppContext.tsx`, `lib/firebase.ts`, `UniversalExportHub.tsx`):**
   - Firestore real-time cloud sync (`ai-studio-remixremixomnili-9010b5de-bad6-48f4-8e1f-5c9740929002`) with offline queue retry (`offlinePendingQueue`), multi-provider backup snapshots (Google Drive, Dropbox, OneDrive, Nextcloud, Syncthing, MinIO S3, MEGA, Proton, Local JSON), and client-side 256-bit AES-GCM (PBKDF2) encryption vault + Biometric/PIN App Lock (`AppLockScreen.tsx`).

---

### 2. Complete Audio, Haptic, Notification & Alarm Architecture

#### A. 100% Synthesized Web Audio Engine (`src/utils/audio.ts` & `src/types.ts`)
All legacy generic sounds were removed and replaced with **46 authentic, zero-latency Web Audio API synthesized tones** modeled after **TickTick** and **Tickit**:
- **14 Check-Off, Notification & Win Sounds (`NotificationSoundType`):**
  1. `tick` — TickTick Signature Default (`pomo_task_complete` crisp acoustic check-off click)
  2. `bubble_pop` — Tickit Habit Bubble Pop (rising liquid bubble pop)
  3. `coin_clink` — Tickit Coin Clink (double metallic coin reward for bills/finance)
  4. `wood_tap` — Acoustic Wood Knock (hollow wood block tap for UI clicks & locks)
  5. `water_drop` — Water Drop (soothing liquid droplet resonance for hydration)
  6. `bell_ding` — TickTick Concierge Ding (clear metallic service desk bell)
  7. `harp_strum` — Tickit Harp Flourish (4-note ascending acoustic harp strum)
  8. `streak_fanfare` — Tickit Streak Fanfare (celebratory chord for habit milestones)
  9. `win_triumph` — Victory Triumph (3-step heroic brass fanfare for goal wins & big streaks)
  10. `level_up` — 8-Bit Level Up (retro arcade chiptune arpeggio)
  11. `magic_chime` — Magic Shimmer (high-harmonic fairy dust sparkle)
  12. `glass_clink` — Crystal Clink (high-frequency crystal glass toast ping)
  13. `camera_snap` — Shutter Snap (tactile mechanical camera shutter click)
  14. `whistle_chirp` — Upbeat Whistle (cheerful two-note whistle tweet)
- **32 Alarm & Reminder Ringtones (`AlarmToneType`):**
  - **Classic & Mechanical Alarms:** `classic_phone` (Vintage Rotary Telephone dual-bell Brrr-Brrr!), `digital_phone` (Modern Cellular Warble Trill), `twin_bell_alarm` (Mechanical Hammer hitting Twin Metal Bells), `digital_alarm` (Bedside Quartz 2048Hz Beep-Beep-Beep-Beep), `rooster_alarm` (Morning Rooster 5-note dawn call), `cuckoo_clock` (Wooden Chalet G5→E5 call), `bugle_reveille` (Bugle Wake-Up call), `brass_bell` (Ship's Brass Watch Bell).
  - **Musical, Melodic & Zen Ringtones:** `ticktick_default`, `jingle`, `spiral`, `aurora`, `breeze`, `crystal`, `echo`, `harp`, `marimba`, `pulse`, `radar`, `ripple`, `telegraph`, `twinkle`, `xylophone`, `zen_bell` (432Hz singing bowl), `sunrise`, `gentle_bell`, `morning_birds`, `wind_chimes`, `piano_chime` (Grand Piano Cmaj9), `guitar_strum` (6-String Acoustic G Major), `kalimba` (Thumb Piano), `singing_bowl` (Deep Temple Bronze Bell).

#### B. Per-Event Sound Assignment Matrix (`EVENT_SOUND_ITEMS`)
Users can assign a dedicated tone to each individual event category across JivanOS (persisted in `localStorage` under `omniplan_event_sounds`):
1. `task_complete` — Task & Subtask Check-off (Default: `tick`)
2. `habit_complete` — Habit Check-off (Default: `bubble_pop`)
3. `win_streak` — Win Streak & Goal Milestone (Default: `win_triumph`)
4. `notification` — General Notification & Alert (Default: `bell_ding`)
5. `water_log` — Water & Hydration Log (Default: `water_drop`)
6. `bill_paid` — Bill Paid & Finance (Default: `coin_clink`)
7. `alarm_ringtone` — Task & Schedule Alarm Ringtone (Default: `classic_phone`)
8. `medication_alarm` — Medication Dose Alarm (Default: `gentle_bell`)
9. `timer_complete` — Focus & Pomodoro Timer Finish (Default: `zen_bell`)

#### C. Strict Zero-Vibration Rule for Alarms (`src/utils/haptics.ts`, `src/utils/notifications.ts`, `src/utils/audio.ts`)
- **Hard Constraint:** Alarms (`reminderType === 'alarm'`, `playAlarmChime`, `haptics.alarm()`, `ActiveAlarmBanner`) **NEVER vibrate** (`haptics.alarm()` is a strict no-op, and `navigator.vibrate` / `notifOptions.vibrate` are omitted for all alarms).
- Tactile micro-haptics (`tick`, `pop`, `coin`, `knock`, `celebration`, `complete`, `toggle`) are used exclusively for interactive UI check-offs and non-alarm interactions when enabled.

#### D. 3-Mode Notification Pop-Up System (`AutoDismissToast` in `src/App.tsx`)
Controlled via `soundEngine.getNotificationPopupStyle()` (`omniplan_notif_popup_style`):
1. **`dynamic_island` (Dynamic Island / Camera Pill — Default):**
   - Top-center obsidian capsule (`bg-zinc-950/95 text-white border border-white/15 backdrop-blur-2xl`) with camera-lens category icon, pulsing emerald live dot, animated 3-bar equalizer, title/subtitle, and circular progress check button.
   - **Tap to Expand:** Smoothly morphs into a `rounded-[28px]` expanded Dynamic Island card with full body text, priority/due badges, and capsule action buttons (`Complete`, `Snooze 5m`, `Open`, `Dismiss`).
2. **`android_heads_up` (Android Heads-Up Notification Pop-Up):**
   - Material 3 heads-up banner with top linear countdown bar, Android system header (`JivanOS • Category • now`), title/body preview, and uppercase Material action bar (`MARK DONE`, `SNOOZE 5M`, `OPEN`).
3. **`compact_card` (Classic Compact Card):**
   - Compact JivanOS toast card with left grab handle and circular bell progress ring.
4. **`ticktick_card` (TickTick Bottom-Sheet Task Pop-Up Card — Default):**
   - Floating bottom-docked rounded card (`rounded-[28px]`, deep matte charcoal `bg-[#1c1c1e]`, `border-white/[0.08]`) matching the TickTick mobile task reminder card.
   - **Top Header Row:** Left side displays vibrant cornflower blue (`#4c8df6`) schedule date/time range (`Yesterday, 9:00am - 9:20am` / `Today, 9:00am - 9:20am`) + blue recurring loop icon (`RefreshCw`). Right side displays list/project badge (`👋 Welcome`), concentric circle Focus/Target icon (`◉`), and close `×` (`X`) button.
   - **Main Body:** Bold white title (`20px–21px`), muted grey description/notes (`#98989f`), and interactive subtask checklist toggles.
   - **Bottom Dual-Button Bar:** Equal-width 2-column button bar (`grid-cols-2 gap-3`) with `Snooze` (`bg-[#2c2c2e] text-[#d1d1d6]`) and `Complete` (`bg-[#2c2c2e] text-[#4c8df6]`).
- *Universal Gestures across all 4 styles:* Swipe right (`>= 45px`) to Mark Done, swipe left (`<= -45px`) to Snooze 5m, swipe up/down to Dismiss.

#### E. Active Alarm & Task Pop-Up Card (`ActiveAlarmBanner.tsx`)
Controlled via `soundEngine.getAlarmPopupStyle()` (`omniplan_alarm_popup_style_v2`, default `'ticktick_card'`):
1. **`ticktick_card` (TickTick Bottom-Sheet Task Reminder / Alarm Pop-Up Card — Default):**
   - Exact replica of the TickTick bottom-sheet task pop-up card (`rounded-[28px]`, `bg-[#1c1c1e]`, `border-white/[0.08]`, docked at bottom of viewport).
   - **Header:** Blue date/time range (`#4c8df6`, e.g., `Yesterday, 9:00am - 9:20am`) + recurring loop icon (`RefreshCw`) on the left; project/category badge (`👋 Welcome`), concentric circle Focus/Open target button (`◉` — starts a 25m Pomodoro focus timer for the task and navigates to it), multi-alert pagination (`1/2`), and Dismiss `×` button on the right.
   - **Body:** Bold white task title (`21px`), secondary description/notes (`#98989f`), plus live interactive subtask checkboxes when the task has subtasks.
   - **Bottom Bar:** Equal-width 2-column buttons (`Snooze` in `#d1d1d6` on `#2c2c2e` with optional right-click `5m/10m/15m/30m/1h` duration chips, and `Complete` in `#4c8df6` on `#2c2c2e`).
   - Also directly launchable from any expanded task card via the 1-tap `Pop-Up` button in `TaskManager.tsx`, or previewable via Settings & Alarm Studio (`YouTube Task — Search about what value I can provide on YouTube`).
2. **`pip_card` (Floating PiP Alarm Card):**
   - **Freely Draggable:** Uses pointer/touch drag tracking with automatic viewport boundary clamping (`fixed z-[99999]`).
   - **3 PiP Size Modes:**
     - `extended`: Full PiP monitor card with grip bar, active category badge (`TASK ALARM`, `HABIT ALARM`, `MEDICATION ALARM`, `BILL ALARM`, `SCHEDULE ALARM`), live elapsed active timer (`MM:SS`), animated audio waveform bars, multi-alarm carousel switcher (`< 1/2 >`), **Jump to Active Item** button (`ExternalLink`), **Mute/Unmute**, **Mark Done** primary CTA (completes the underlying task, habit, bill, or schedule item), and **Snooze (`2m`, `5m`, `10m`)** buttons.
     - `compact`: Slim floating PiP bar with title, elapsed timer, quick Done check, Snooze button, and Expand button.
     - `mini`: Floating pulsing alarm pill/orb (`ACTIVE • MM:SS`) that expands back to full PiP when tapped.
3. **`classic_banner` (Classic Top Alarm Banner):**
   - Fixed top-center grouped alarm stack banner.

---

### 3. Complete UI/UX & Visual Architecture Standards
- **Petal v4.4 Material You & Liquid Glass Theming:**
  - Supports Light, Dark, and **AMOLED Pure Black** (`data-amoled="true"`) modes, Expressive Shapes (`squircle`, `cookie`, `flower`, `clover`, `hexagon`, `pill`), and customizable visual palette modes (`colorful`, `monochrome`, `pastel`).
- **Namida Symmetrical Touch-Drag Left Drawer (`App.tsx` & `Sidebar.tsx`):**
  - 60fps real-time edge-swipe and horizontal drag physics (`--drawer-offset`, `--drawer-progress`) with symmetrical distance (`26px`) and flick velocity (`0.18 px/ms`) thresholds, automatically ignoring touches inside modals, sliders, horizontal scroll ribbons, or toast/PiP cards (`data-no-drawer-swipe="true"`).
- **Draggable Stopwatch / Focus PiP Widget (`DraggablePiPWidget.tsx`):**
  - Floating PiP widget for active Pomodoro focus timers and stopwatches with `extended`, `compact`, and `mini` modes.
- **Habit Form 1-to-1 Icon Selection, Picker & Persistence (`HabitForm.tsx`, `HabitDetailModal.tsx`, `IconRenderer.tsx`):**
  - `HabitForm` tracks `icon` state (`initialHabit?.icon || '🔥'`), syncs `icon` across 1-Tap Habit Templates (`💧`, `📖`, `🧘`, `🏋️`, `🚫`), renders `<IconRenderer icon={icon} />` directly in `FormHeroTitleCard`, provides an inline 24-icon `HABIT_ICON_OPTIONS` picker (`showIconPicker`) triggered via the hero icon box or the inline `Icon` button, and persists `icon` in `habitData` upon submission so the exact selected icon appears in the form, habit cards, routine cards, and `HabitDetailModal`.
- **Crisp 16x16 Task Card Sub-Checklist Icon (`SubtaskBranchIcon.tsx`, `TaskManager.tsx`, `UniformTaskCard.tsx`, `EisenhowerGoogleBoard.tsx`):**
  - Custom pixel-aligned 16x16 SVG with a mini checkmark row on top and an open rounded checkbox row on the bottom, engineered for maximum clarity at `10.5px–11.5px` next to subtask counters (`1/3`) across all task card views.

---

### 4. Current State & Live Auto-Backup Rule

#### Current State (Verified & Compiled):
- All chronological user requests in this session are 100% implemented, wired, linted (`tsc --noEmit` zero errors), and compiled (`npm run build` succeeded):
  - Expressive Bill Form & Bill Cards with templates, splitter, converter, and payment history.
  - Complete TickTick + Tickit 46-tone Web Audio API synthesizer (`src/utils/audio.ts`).
  - Per-Event Tone Assignment Matrix (`EVENT_SOUND_ITEMS`) in both Settings and Alarm Studio.
  - Classic Phone Ring (`classic_phone`) and 31 other alarm ringtones + 14 notification/win sounds.
  - Strict zero-vibration enforcement on all alarms.
  - Quote Banner Next button updated to `>` (`ChevronRight`).
  - Dynamic Island (Camera Pill) & Android Heads-Up notification pop-up styles + Draggable Floating PiP Alarm Card with live preview buttons.
  - Habit Form 1-to-1 icon selection, template icon sync, interactive 24-icon picker, and persistence across Habit cards and `HabitDetailModal`.
  - Redesigned subtask icon in `SubtaskBranchIcon.tsx` to match the exact ultra-minimalist rounded branch curve with twin right node dots (`ヒ:`) from reference screenshot `image_e61afc49.png`, optically aligning its top stem (`y=2.2`) to the cap-height of `"1/3"` and its lower branch/dot (`y=12.2`) to the exact numeric baseline of `"1/3"` so the icon and counter sit on a single perfectly horizontal optical line (`image_57d69f0c.png`).
  - Replaced all circular arrow recurring icons (`RotateCw`/`RefreshCw`) with the clean, highly visible 2-arrow repeat loop icon (`Repeat` from `lucide-react`, matching reference screenshot `image_ad0285fe.png`) with `stroke-[2.2]` across all task card metadata rows (`TaskManager`, `EisenhowerGoogleBoard`, `CompactActionItemCard`, `UniformTaskCard`) and active alarm pop-up cards (`ActiveAlarmBanner`).
  - Optimized task card vertical padding (`py-1.5`), reduced inter-line margin (`mt-0.5`), and unified all metadata row icon & badge colors (`Date/Time`: `rose-500` overdue, `indigo-600` today, `slate-500` upcoming; `Bell` turns `text-rose-500` when overdue, `Repeat` and `SubtaskBranchIcon 1/3`: consistent `text-slate-500 dark:text-slate-400`, turning `text-emerald-600` when all subtasks are done and `text-slate-400` when completed) across List View (`TaskManager`), Eisenhower Matrix (`EisenhowerGoogleBoard`), Kanban View (`UniformTaskCard`), Compact Cards (`CompactActionItemCard`), and Habit Cards (`HabitTracker`).
  - Implemented the **TickTick Bottom-Sheet Task Reminder / Alarm Pop-Up Card (`ticktick_card`)** as the default pop-up style for both Task/Habit Notifications (`AutoDismissToast` in `App.tsx`) and Active Alarms (`ActiveAlarmBanner.tsx`), complete with blue schedule time range (`Yesterday, 9:00am - 9:20am`) + recurring loop icon (`Repeat`), `👋 Welcome` project badge, concentric `◉` Focus/Open target button, bold title + description + interactive subtasks, and equal-width `Snooze` & `Complete` buttons, plus 1-tap `Pop-Up` button on task cards and live preview triggers in Settings & Alarm Studio.
  - Fixed Eisenhower Matrix height calculation and container overflow in `TaskManager.tsx` & `EisenhowerGoogleBoard.tsx`: replaced fixed height subtractions with full flex-1 height expansion (`flex-1 min-h-0 h-full flex flex-col`) to eliminate unnecessary empty gaps above the bottom navigation bar and give maximum vertical space to tasks in all 4 quadrants (DO, PLAN, PASS, SKIP).
  - Updated top Navbar navigation drawer toggle button icon in `Navbar.tsx` to the standard 3 horizontal lines stacked vertically (`Menu` / hamburger drawer icon).
  - Redesigned Quote Banner right controls in `QuoteBanner.tsx`: clubbed expand dropdown arrow + 3-dot menu into a single 2-in-1 button, added top quote navigation row (`< Prev` / `Next >` with `#{index}/{total}`), stripped redundant "Quote" words from action labels (`Edit`, `Share`, `Copy`, `Save`), organized actions into sleek 2-column horizontal grid rows (`[Edit] [Share]`, `[Copy] [Save]`), anchored the popover dropdown menu to the bottom edge of the outer `QuoteBanner` container so all expanded quote text remains 100% visible, and fixed outside-interaction click handling with `dropdownRef` and mathematical circular modulo wrapping so all menu options (`Prev`, `Next`, `Edit`, `Share`, `Copy`, `Save`, `Open View`, `All Quotes`) trigger immediately upon click without being prematurely unmounted.
  - Optimized the `Date & Time (Single Task)` inline inspector tab in `TaskForm.tsx`: aligned the Quick Date Pills (`📅 Today`, `☀️ Tomorrow`, `📆 +7d`) + inline `<input type="date">` onto a single non-wrapping horizontal row, and aligned the Quick Duration Chips (`To: +15m +30m +45m +1h +2h`) + Reminder Chips (`🔔 At time`, `15m`, `1h`) separated by a subtle vertical divider onto a single clean horizontal row so neither group wraps awkwardly out of position (`image_7db776e9.png`).
  - Shortened Bill Category filter pills and form labels across `BillsManager.tsx` and `BillFormModal.tsx` (`All`, `Card`, `Light`, `Water`, `Rent`, `WiFi`, `OTT`, `Insure`, `Other`) so the entire category filter ribbon fits cleanly and compactly (`image_9c4926df.png`).
  - Removed the destructive `Reset to Template Bills` option from the primary `... Tools` dropdown in `BillsManager.tsx` (`image_d1d4dcd7.png`), verified `BillSplitterModal.tsx` (custom tax `%` input + readymade `₹100`, `₹200`, `₹500` & custom tip amount + `Shared via JivanOS` branding + 1-tap `+ Log My Share in Bills` wired to `addBill`), verified `CurrencyConverterModal.tsx` (`Sync Live` exchange rate fetcher, editable custom rate override, Card Forex Markup + 18% GST calculator, Recurring Daily/Monthly/Yearly bill estimator, 4-column Live Cross-Rates matrix, and 1-tap `Create Bill` wired to `openAddModal`), and replaced remaining user-facing `Omni Cloud Vault` branding with `JivanOS Cloud Vault`.
  - Fixed custom tax (`%`) and custom tip (`₹`) input positioning in `BillSplitterModal.tsx` (`image_49a05a22.png`) using `grid-cols-[repeat(4,auto)_minmax(0,1fr)]` and a flex-sibling symbol/input box (`min-w-0 w-full flex items-center justify-between`) so neither custom box overflows its container border and `₹`/`%` symbols never overlap the numeric value.
  - Removed the redundant and mismatched `Tasks` and `Events` summary cards (`image_cbf40cef.png`) from the top statistics row of `GoalsManager.tsx`, keeping a clean 2-column centered Goal summary (`Total Goals` and `Achieved`), and unified `goalMetricsById` across `GoalsManager.tsx` so `Achieved`, `Done (...)`, `Linked (...)`, and each Goal Card's `Overall Progress` & `Objectives` accurately combine `goal.milestones` (with interactive `toggleGoalMilestone` checkboxes), linked tasks (`goalId`/`projectId`/`project`), linked time-blocked tasks (`goalId`/`taskId`), and linked habits (`goalId`).
  - Removed all user-facing `"Event"` / `"Events"` labels, badges, tabs, and buttons across the entire system (`GoalsManager.tsx`, `LinkEntitiesModal.tsx`, `ActiveGoalsWidget.tsx`, `HabitForm.tsx`, `TaskForm.tsx`, `CompactActionItemCard.tsx`, `PlannerPage.tsx`, `VisualTimeBlockingGrid.tsx`, `HourlyScheduleView.tsx`, `DeadlineScheduleView.tsx`, `AIChatDrawer.tsx`, `AppContext.tsx`, `SettingsManager.tsx`, and `NotificationSettingsModal.tsx`), unifying all single and From–To end-time items under **Tasks** (and **Timeline** where referring to the 24h schedule view).
  - Center-aligned and mobile-optimized the 3-column metrics strip in `BillsManager.tsx` (`Unpaid`, `Paid`, `Urgent ≤ 3d`).
  - Reworked the Timeline / 24h Grid view (`VisualTimeBlockingGrid.tsx` & embedded `PlannerPage.tsx` under `TaskManager.tsx`) to match **Structured (`https://structured.app`)** (`image_170791e8.png`) while keeping the `Spine` view untouched:
    - Added the Structured Date & 7-Day Week Header (`16. October 2025 ›`) with Monday–Sunday columns and **mini overlapping colored icon circles** beneath each date.
    - Added the rounded Structured sheet with the top **All-Day / Anytime Circular Bubble Tray** (`Call Mum`, `Structure Tomorrow`, `Book Vacation`, `+ Anytime`) with color-matched check badges.
    - Built the **Structured Proportional Vertical Pill Timeline** (`08:30`, `08:45`, `09:00`, bold live current time `09:41`, `10:00`, etc.) with duration-scaled colored stadium pills/circles, automatic contextual icons, live elapsed fill & `"Xm remaining"` countdown for active tasks, interactive free-time gap slots, and right-aligned color-matched circular checkboxes, plus a 1-tap toggle for the classic `24h Slots` canvas and a responsive Desktop/Mobile **Inbox & Quick Structured Blocks** companion panel.
  - Extracted the complete **Structured (`https://web.structured.app/timeline/multi-day`) Color & Icon System** (`src/constants/structuredCatalog.ts` & `src/components/common/StructuredIconColorPicker.tsx`) and integrated it across `TaskForm.tsx`, `HabitForm.tsx`, `IconRenderer.tsx`, and `VisualTimeBlockingGrid.tsx`:
    - **9 Primary Structured Colors** (`#f39b93` Coral Rose, `#f5976c` Sunset Peach, `#e5a000` Golden Amber, `#8ab867` Matcha Sage, `#55789b` Slate Blue, `#177e65` Forest Teal, `#8b4058` Berry Plum, `#254b6e` Midnight Navy, `#09090b` Obsidian Black) with the signature inner white ring when active + `...` extended 9-color palette & custom hex picker.
    - **7-Category Structured Icon Filter Bar & 160+ Unlocked Vector Icons** (`weather` / Nature, Weather & Objects, `lifestyle` / Lifestyle, Self-Care & Fashion, `home` / Home, Living & Chores, `study` / Study, Reading & Mind, `tech` / Work, Tech & Finance, `fitness` / Fitness, Sports & Transit, `food` / Health, Food & Drink) with `Search Icons` live filter, 6-column circular icon grid, section headers, and classic emoji support.
    - Direct 1-tap `🎨` (`Palette`) customization badge on Structured timeline pills and all-day bubbles in `VisualTimeBlockingGrid.tsx` as well as in `TaskForm.tsx` and `HabitForm.tsx`.
  - Shifted the Hero Title action controls (`Full ^`, `Icon` / `Color & Icon`, `Templates`, `Color`) from the right side of the title input onto a dedicated horizontal row **directly below the title** (`image_937a2f51.png`) in `FormHeroTitleCard` (`FormPrimitives.tsx`, `TaskForm.tsx`, `HabitForm.tsx`, `BillFormModal.tsx`, `MedicationFormModal.tsx`, `GoalEditModal.tsx`, `QuoteBanner.tsx`, and `QuotesManager.tsx`) so the title input gets 100% unobstructed horizontal width across all forms.
  - Updated `TaskForm.tsx`, `HabitForm.tsx`, `BillFormModal.tsx`, `MedicationFormModal.tsx`, `GoalEditModal.tsx`, `QuoteBanner.tsx`, and `QuotesManager.tsx` (`image_fb013839.png`, `image_72b9ca54.png`, `image_cfcd13fa.png`):
    - Simplified all form headers to `Edit` / `New` followed by their entity pill badge (`Task`, `Habit`, `Bill`, `Medication`, `Goal`, `Quote`).
    - Removed redundant top `Save` buttons across all forms, relocated the `Star` (`☆`) button in `TaskForm.tsx` into the top header bar next to the close `×` button, and standardized all bottom primary action buttons to `Save`.
    - Removed the redundant 9-dot inline color swatch row in `HabitForm.tsx` and rendered `rightActionSlot` as direct flex siblings in `FormHeroTitleCard` (`FormPrimitives.tsx`) so `[Full ^]`, `[Icon]`, and `[Templates]` align on a single horizontal row directly below the title.
    - Replaced the `Sequence Rank` `- #14 +` stepper and `Use Free #1` button in `TaskForm.tsx` with two dropdown selectors: a **Sequence Rank (`#1`–`#99`) dropdown** where already-used ranks in the quadrant are rendered grey & faded, and a **`Used Ranks (...)` dropdown** listing all currently occupied ranks and their task titles in that quadrant.

#### Live Auto-Backup Rule (Mandatory Self-Update Protocol):
> **AUTO-BACKUP INSTRUCTION:** Whenever you add, modify, debug, or finalize any feature, UI component, sound, workflow, or design rule in future turns of this conversation, you MUST update `PART 2` of `/skills/jivanos-unbounded-brain/SKILL.md` before ending your turn so that this skill always serves as a complete, 100% up-to-date brain and living backup of JivanOS.
