import React from 'react';
import {
  Droplets,
  Brain,
  Dumbbell,
  Smile,
  Wallet,
  Briefcase,
  Activity,
  BookOpen,
  Folder,
  Flame,
  Target,
  Heart,
  Sun,
  Moon,
  Pill,
  Syringe,
  Wind,
  Sparkles,
  Clock,
  Coffee,
  Zap,
  Code,
  Music,
  Shield,
  Home,
  CreditCard,
  ReceiptText,
  Wifi,
  Tv,
  Footprints,
  Apple,
  Utensils,
  Bed,
  Check,
  Bell,
  Lock,
  Calendar,
  Laptop,
  Phone,
  Palette,
  Compass,
  MessageCircle,
} from 'lucide-react';

interface IconRendererProps {
  icon?: string | React.ReactNode;
  className?: string;
  fallback?: React.ReactNode;
}

export const renderIconElement = (
  icon?: string | React.ReactNode,
  className = 'w-5 h-5',
  fallback: React.ReactNode = '🎯'
): React.ReactNode => {
  if (!icon) {
    if (typeof fallback === 'string' && !isEmoji(fallback)) {
      return renderIconElement(fallback, className, '🎯');
    }
    return typeof fallback === 'string' ? (
      <span className="inline-block leading-none select-none" role="img">
        {fallback}
      </span>
    ) : (
      fallback
    );
  }

  // Already a React element (e.g. <Droplets />)
  if (React.isValidElement(icon)) {
    return icon;
  }

  // Not a string
  if (typeof icon !== 'string') {
    return fallback;
  }

  const trimmed = icon.trim();
  if (!trimmed) return fallback;

  // Check if it's an emoji (e.g. 💧, 🧠, 🏋️, 🧘, 🍳, etc.)
  if (isEmoji(trimmed)) {
    return (
      <span className={`inline-flex items-center justify-center leading-none select-none shrink-0 ${className}`} role="img">
        <span className="text-[1.1em] leading-none transform translate-y-[-0.5px] inline-block">{trimmed}</span>
      </span>
    );
  }

  // Normalize string for keyword matching
  const key = trimmed.toLowerCase().replace(/[-_\s]+/g, '');

  switch (key) {
    // Water / Hydration / Drop (User explicitly reported this)
    case 'drop':
    case 'drops':
    case 'droplet':
    case 'droplets':
    case 'water':
    case 'hydration':
    case 'drink':
      return <Droplets className={className} />;

    // Mind / Brain / Focus
    case 'brain':
    case 'mind':
    case 'focus':
    case 'think':
    case 'mental':
      return <Brain className={className} />;

    // Fitness / Gym / Workout
    case 'dumbbell':
    case 'gym':
    case 'fitness':
    case 'workout':
    case 'weights':
    case 'exercise':
    case 'lift':
      return <Dumbbell className={className} />;

    // Mood / Smile / Meditation
    case 'smile':
    case 'happy':
    case 'mood':
    case 'joy':
    case 'meditation':
    case 'mindful':
      return <Smile className={className} />;

    // Wallet / Finance / Bills
    case 'wallet':
    case 'finance':
    case 'finances':
    case 'money':
    case 'cash':
    case 'budget':
      return <Wallet className={className} />;

    // Work / Project / Business
    case 'briefcase':
    case 'work':
    case 'job':
    case 'career':
    case 'business':
    case 'office':
      return <Briefcase className={className} />;

    // Activity / Health / Cardio
    case 'activity':
    case 'pulse':
    case 'vitality':
    case 'cardio':
    case 'health':
    case 'heartrate':
      return <Activity className={className} />;

    // Book / Learning / Reading
    case 'book':
    case 'bookopen':
    case 'read':
    case 'reading':
    case 'study':
    case 'learn':
    case 'learning':
      return <BookOpen className={className} />;

    // Folder / Directory
    case 'folder':
    case 'project':
    case 'directory':
      return <Folder className={className} />;

    // Fire / Flame / Streak
    case 'flame':
    case 'fire':
    case 'streak':
    case 'burn':
      return <Flame className={className} />;

    // Target / Goal
    case 'target':
    case 'goal':
    case 'aim':
    case 'objective':
      return <Target className={className} />;

    // Heart / Care
    case 'heart':
    case 'love':
    case 'care':
    case 'wellness':
      return <Heart className={className} />;

    // Sun / Morning
    case 'sun':
    case 'morning':
    case 'day':
    case 'sunrise':
      return <Sun className={className} />;

    // Moon / Night
    case 'moon':
    case 'night':
    case 'evening':
    case 'sleep':
    case 'bedtime':
      return <Moon className={className} />;

    // Medication / Pill / Supplements
    case 'pill':
    case 'tablet':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      );

    case 'capsule':
    case 'medicine':
    case 'med':
    case 'meds':
    case 'supplement':
    case 'vitamin':
      return <Pill className={className} />;

    // Injection / Syringe
    case 'injection':
    case 'syringe':
    case 'shot':
    case 'vaccine':
      return <Syringe className={className} />;

    // Inhaler / Wind / Breath
    case 'inhaler':
    case 'wind':
    case 'breath':
    case 'breathing':
    case 'air':
      return <Wind className={className} />;

    // Sparkles / Magic / Clean
    case 'sparkles':
    case 'sparkle':
    case 'star':
    case 'magic':
    case 'clean':
    case 'tidy':
      return <Sparkles className={className} />;

    // Clock / Time
    case 'clock':
    case 'time':
    case 'timer':
    case 'stopwatch':
    case 'alarm':
      return <Clock className={className} />;

    // Coffee / Tea
    case 'coffee':
    case 'tea':
    case 'cafe':
      return <Coffee className={className} />;

    // Zap / Energy
    case 'zap':
    case 'energy':
    case 'power':
    case 'bolt':
    case 'electric':
    case 'electricity':
      return <Zap className={className} />;

    // Code / Developer
    case 'code':
    case 'dev':
    case 'developer':
    case 'programming':
      return <Code className={className} />;

    // Music / Audio
    case 'music':
    case 'song':
    case 'audio':
    case 'listen':
      return <Music className={className} />;

    // Shield / Security
    case 'shield':
    case 'security':
    case 'protect':
    case 'insurance':
      return <Shield className={className} />;

    // Home / Rent
    case 'home':
    case 'house':
    case 'rent':
    case 'mortgage':
      return <Home className={className} />;

    // Credit Card
    case 'creditcard':
    case 'card':
    case 'payment':
      return <CreditCard className={className} />;

    // Receipt / Bill
    case 'receipt':
    case 'bill':
    case 'expense':
      return <ReceiptText className={className} />;

    // Wifi / Internet
    case 'wifi':
    case 'internet':
    case 'network':
      return <Wifi className={className} />;

    // TV / Entertainment
    case 'tv':
    case 'streaming':
    case 'video':
      return <Tv className={className} />;

    // Running / Walking / Footprints
    case 'running':
    case 'run':
    case 'walk':
    case 'walking':
    case 'steps':
    case 'footprints':
    case 'jog':
    case 'jogging':
      return <Footprints className={className} />;

    // Food / Nutrition
    case 'apple':
    case 'fruit':
    case 'diet':
    case 'nutrition':
    case 'food':
      return <Apple className={className} />;

    // Cooking / Meals
    case 'utensils':
    case 'cook':
    case 'cooking':
    case 'breakfast':
    case 'dinner':
    case 'lunch':
    case 'meal':
      return <Utensils className={className} />;

    // Sleep / Bed
    case 'bed':
    case 'rest':
    case 'nap':
      return <Bed className={className} />;

    // Check
    case 'check':
    case 'checksquare':
    case 'done':
    case 'tick':
      return <Check className={className} />;

    // Bell / Alert
    case 'bell':
    case 'reminder':
    case 'alert':
      return <Bell className={className} />;

    // Lock
    case 'lock':
    case 'private':
    case 'secret':
      return <Lock className={className} />;

    // Calendar
    case 'calendar':
    case 'schedule':
    case 'date':
      return <Calendar className={className} />;

    // Tech
    case 'laptop':
    case 'pc':
    case 'computer':
      return <Laptop className={className} />;

    case 'phone':
    case 'call':
      return <Phone className={className} />;

    case 'palette':
    case 'art':
    case 'design':
      return <Palette className={className} />;

    case 'compass':
    case 'explore':
    case 'travel':
      return <Compass className={className} />;

    case 'messagecircle':
    case 'chat':
    case 'social':
      return <MessageCircle className={className} />;

    default:
      // Fuzzy contains match so words like "water-glass" or "drop_habit" match
      if (key.includes('drop') || key.includes('water')) return <Droplets className={className} />;
      if (key.includes('brain') || key.includes('mind')) return <Brain className={className} />;
      if (key.includes('gym') || key.includes('lift') || key.includes('fit')) return <Dumbbell className={className} />;
      if (key.includes('run') || key.includes('walk') || key.includes('step')) return <Footprints className={className} />;
      if (key.includes('read') || key.includes('book')) return <BookOpen className={className} />;
      if (key.includes('money') || key.includes('cash') || key.includes('bill')) return <Wallet className={className} />;
      if (key.includes('work') || key.includes('task')) return <Briefcase className={className} />;
      if (key.includes('med') || key.includes('pill')) return <Pill className={className} />;
      if (key.includes('sleep') || key.includes('rest')) return <Moon className={className} />;

      // If it's pure alphabetical text, avoid displaying raw words like "drop" or "logo" in icon slots!
      if (/^[a-zA-Z\-_]+$/.test(trimmed)) {
        return <Sparkles className={className} />;
      }

      // If fallback is an icon key or element
      if (typeof fallback === 'string' && !isEmoji(fallback)) {
        return <Sparkles className={className} />;
      }

      return typeof fallback === 'string' ? (
        <span className="inline-block leading-none select-none" role="img">
          {fallback}
        </span>
      ) : (
        fallback
      );
  }
};

/**
 * Checks if a string contains or consists of an emoji
 */
function isEmoji(str: string): boolean {
  try {
    return /\p{Extended_Pictographic}/u.test(str);
  } catch {
    // Fallback regex for older engines
    return /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u.test(str);
  }
}

/**
 * Universal Icon Component for OmniLifeOS
 */
export const IconRenderer: React.FC<IconRendererProps> = ({
  icon,
  className = 'w-5 h-5',
  fallback = '🎯',
}) => {
  return <>{renderIconElement(icon, className, fallback)}</>;
};

export default IconRenderer;
