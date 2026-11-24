import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { notificationService } from '../../utils/notifications';
import { toSentenceCase } from '../../utils/quoteText';

export const QUOTE_REMINDER_ENABLED_KEY = 'omni_quote_reminder_enabled';
export const QUOTE_REMINDER_MORNING_KEY = 'omni_quote_reminder_morning';
export const QUOTE_REMINDER_EVENING_KEY = 'omni_quote_reminder_evening';
export const QUOTE_REMINDER_LAST_FIRED_KEY = 'omni_quote_reminder_last_fired';
export const QUOTE_REMINDER_PREFS_EVENT = 'jivanos_quote_reminder_prefs_updated';

interface LastFiredState {
  morning?: string;
  evening?: string;
}

function readReminderPrefs() {
  try {
    return {
      enabled: localStorage.getItem(QUOTE_REMINDER_ENABLED_KEY) === 'true',
      morning: localStorage.getItem(QUOTE_REMINDER_MORNING_KEY) || '08:00',
      evening: localStorage.getItem(QUOTE_REMINDER_EVENING_KEY) || '20:00',
    };
  } catch {
    return { enabled: false, morning: '08:00', evening: '20:00' };
  }
}

function readLastFired(): LastFiredState {
  try {
    const raw = localStorage.getItem(QUOTE_REMINDER_LAST_FIRED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLastFired(state: LastFiredState): void {
  try {
    localStorage.setItem(QUOTE_REMINDER_LAST_FIRED_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

/**
 * Always-mounted headless service that triggers morning & evening daily quote
 * reminders regardless of which tab the user is currently viewing.
 */
export const QuoteReminderService: React.FC = () => {
  const { quotes } = useApp();
  const [prefs, setPrefs] = useState(readReminderPrefs);

  useEffect(() => {
    const refresh = () => setPrefs(readReminderPrefs());
    window.addEventListener(QUOTE_REMINDER_PREFS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(QUOTE_REMINDER_PREFS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (!prefs.enabled) return;

    const checkAndTriggerReminder = () => {
      if (quotes.length === 0) return;

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const todayKey = `${yyyy}-${mm}-${dd}`;

      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${mins}`;

      let slot: 'morning' | 'evening' | null = null;
      let label = '';

      if (currentTimeStr === prefs.morning) {
        slot = 'morning';
        label = 'Morning Wisdom';
      } else if (currentTimeStr === prefs.evening) {
        slot = 'evening';
        label = 'Evening Wisdom';
      }

      if (!slot) return;

      const lastFired = readLastFired();
      if (lastFired[slot] === todayKey) return;

      writeLastFired({ ...lastFired, [slot]: todayKey });

      const randomIndex = Math.floor(Math.random() * quotes.length);
      const selectedQuote = quotes[randomIndex] || quotes[0];
      const formattedQuoteText = toSentenceCase(selectedQuote.text);

      notificationService.notify(`🌅 ${label}`, {
        body: `"${formattedQuoteText}" — ${selectedQuote.author}`,
        sound: 'task',
        tag: `quote_reminder_${slot}_${todayKey}`,
      });
    };

    const unsubscribe = notificationService.subscribeTick(checkAndTriggerReminder);
    checkAndTriggerReminder();

    return () => {
      unsubscribe();
    };
  }, [prefs.enabled, prefs.morning, prefs.evening, quotes]);

  return null;
};
